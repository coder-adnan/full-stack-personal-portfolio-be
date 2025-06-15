import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";

const prisma = new PrismaClient();

const createPaymentSchema = z.object({
  appointmentId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
});

export const createPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { appointmentId, amount, currency } = createPaymentSchema.parse(
      req.body
    );

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    const payment = await prisma.payment.create({
      data: {
        appointmentId,
        userId,
        amount,
        currency,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        appointment: true,
      },
    });

    res.status(201).json({
      status: "success",
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const payments = await prisma.payment.findMany({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        appointment: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      status: "success",
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        appointment: true,
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

export const updatePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = req.params;
    const { status } = z
      .object({
        status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]),
      })
      .parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    if (payment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        appointment: true,
      },
    });

    res.json({
      status: "success",
      data: { payment: updatedPayment },
    });
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    if (payment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    await prisma.payment.delete({
      where: { id },
    });

    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
