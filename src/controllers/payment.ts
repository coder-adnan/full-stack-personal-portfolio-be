import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { createPaymentIntent, constructWebhookEvent } from "../utils/stripe";
import { generatePaymentConfirmationEmail, sendEmail } from "../utils/email";

const prisma = new PrismaClient();

const createPaymentSchema = z.object({
  appointmentId: z.string(),
  amount: z.number().positive(),
  currency: z.string().optional(),
});

export const createPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { appointmentId, amount, currency } = createPaymentSchema.parse(
      req.body
    );

    // Verify appointment exists and belongs to user
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.userId !== userId) {
      throw new AppError(403, "Forbidden");
    }

    if (appointment.status === "CANCELLED") {
      throw new AppError(
        400,
        "Cannot process payment for cancelled appointment"
      );
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { appointmentId },
    });

    if (existingPayment) {
      throw new AppError(400, "Payment already exists for this appointment");
    }

    // Create payment intent with Stripe
    const paymentIntent = await createPaymentIntent({
      appointmentId,
      amount,
      currency,
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        appointmentId,
        amount,
        currency: currency || "USD",
        stripePaymentId: paymentIntent.id,
      },
    });

    res.status(201).json({
      status: "success",
      data: {
        payment,
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      throw new AppError(400, "Invalid signature header");
    }

    const event = constructWebhookEvent(req.body, signature);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const appointmentId = paymentIntent.metadata.appointmentId;

        // Update payment status
        const payment = await prisma.payment.update({
          where: { stripePaymentId: paymentIntent.id },
          data: {
            status: "COMPLETED",
          },
          include: {
            appointment: {
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Update appointment status
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            status: "CONFIRMED",
          },
        });

        // Send payment confirmation email
        await sendEmail(
          generatePaymentConfirmationEmail(
            payment.appointment.user.email,
            payment.appointment.user.name,
            payment.amount,
            payment.appointment.date,
            payment.appointment.time
          )
        );

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;

        await prisma.payment.update({
          where: { stripePaymentId: paymentIntent.id },
          data: {
            status: "FAILED",
          },
        });

        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        appointment: {
          select: {
            date: true,
            time: true,
            topic: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    if (payment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    res.json({
      status: "success",
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPayments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter conditions
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get payments with pagination
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          appointment: {
            select: {
              id: true,
              date: true,
              time: true,
              topic: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: Number(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      status: "success",
      data: {
        payments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
