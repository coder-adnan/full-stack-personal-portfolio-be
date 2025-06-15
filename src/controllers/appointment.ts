import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();

// Business hours configuration
const BUSINESS_HOURS = {
  start: 9, // 9 AM
  end: 17, // 5 PM
  slotDuration: 60, // 60 minutes per slot
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
};

// Generate time slots for a given date
const generateTimeSlots = (date: Date) => {
  const slots: string[] = [];
  const dayOfWeek = date.getDay();

  // Check if it's a working day
  if (!BUSINESS_HOURS.workingDays.includes(dayOfWeek)) {
    return slots;
  }

  // Generate slots for the day
  for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
    const time = `${hour.toString().padStart(2, "0")}:00`;
    slots.push(time);
  }

  return slots;
};

// Get the next available day
const getNextAvailableDay = async (startDate: Date): Promise<Date> => {
  let currentDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = 30; // Look ahead up to 30 days

  while (attempts < maxAttempts) {
    // Check if it's a working day
    if (BUSINESS_HOURS.workingDays.includes(currentDate.getDay())) {
      // Check if there are any available slots
      const slots = await getAvailableSlotsForDate(currentDate);
      if (slots.length > 0) {
        return currentDate;
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

  throw new AppError(404, "No available slots found in the next 30 days");
};

// Get available slots for a specific date
export const getAvailableSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      throw new AppError(400, "Date is required");
    }

    const selectedDate = new Date(date);
    const availableSlots = await getAvailableSlotsForDate(selectedDate);

    // If no slots available, find the next available day
    let nextAvailableDay = null;
    if (availableSlots.length === 0) {
      try {
        nextAvailableDay = await getNextAvailableDay(selectedDate);
      } catch (error) {
        // If no next available day found, we'll just return empty slots
      }
    }

    res.json({
      status: "success",
      data: {
        date: selectedDate.toISOString(),
        availableSlots,
        nextAvailableDay: nextAvailableDay?.toISOString() || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get available slots for a date
async function getAvailableSlotsForDate(date: Date): Promise<string[]> {
  // Get all slots for the day
  const allSlots = generateTimeSlots(date);
  if (allSlots.length === 0) {
    return [];
  }

  // Get booked slots for the day
  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      date,
      status: {
        notIn: ["CANCELLED"],
      },
    },
    select: {
      time: true,
    },
  });

  const bookedTimes = new Set(bookedAppointments.map((apt) => apt.time));

  // Filter out booked slots
  return allSlots.filter((slot) => !bookedTimes.has(slot));
}

// Validation schemas
const createAppointmentSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  topic: z.string().min(1),
  company: z.string().optional(),
  message: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial();

export const createAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { startTime, topic, company, message } =
      createAppointmentSchema.parse(req.body);

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(startTime),
        time: new Date(startTime).toTimeString().slice(0, 5),
        topic,
        company,
        message,
        userId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      data: { appointment },
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const appointments = await prisma.appointment.findMany({
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      status: "success",
      data: { appointments },
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (
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

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    res.json({
      status: "success",
      data: { appointment },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAppointment = async (
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
    const { startTime, topic, company, message } =
      updateAppointmentSchema.parse(req.body);

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        date: startTime ? new Date(startTime) : undefined,
        time: startTime
          ? new Date(startTime).toTimeString().slice(0, 5)
          : undefined,
        topic,
        company,
        message,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      status: "success",
      data: { appointment },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (
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

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      status: "success",
      data: { appointment: updatedAppointment },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAppointment = async (
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

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    await prisma.appointment.delete({
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

export const getAllAppointments = async (
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
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get appointments with pagination
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payment: {
            select: {
              status: true,
              amount: true,
              stripePaymentId: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
        skip,
        take: Number(limit),
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      status: "success",
      data: {
        appointments,
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
