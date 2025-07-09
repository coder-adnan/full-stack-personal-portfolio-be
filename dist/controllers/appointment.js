"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAppointments = exports.deleteAppointment = exports.cancelAppointment = exports.updateAppointment = exports.getAppointment = exports.getAppointments = exports.createAppointment = exports.getAvailableSlots = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const generateSlots_1 = __importDefault(require("../utils/generateSlots"));
const prisma = new client_1.PrismaClient();
// Helper to get slot rules for a given day
function getSlotRangeForDay(day) {
    // 0 = Sunday, 5 = Friday, 6 = Saturday
    if (day === 6) {
        // Saturday: 00:00 to 14:00
        return { start: "00:00", end: "14:00" };
    }
    else if (day === 5) {
        // Friday: 14:00 to 23:30 (assuming you meant 2PM to 11:30PM)
        return { start: "14:00", end: "23:30" };
    }
    else {
        // Other days: 18:00 to 23:30
        return { start: "18:00", end: "23:30" };
    }
}
// Get available slots for a specific date
const getAvailableSlots = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date || typeof date !== "string") {
            throw new error_1.AppError(400, "Date is required");
        }
        const selectedDate = new Date(date);
        const availableSlots = await getAvailableSlotsForDate(selectedDate);
        // If no slots available, find the next available day
        let nextAvailableDay = null;
        if (availableSlots.length === 0) {
            let attempts = 0;
            let nextDate = new Date(selectedDate);
            while (attempts < 30) {
                nextDate.setDate(nextDate.getDate() + 1);
                const slots = await getAvailableSlotsForDate(nextDate);
                if (slots.length > 0) {
                    nextAvailableDay = nextDate;
                    break;
                }
                attempts++;
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableSlots = getAvailableSlots;
// Helper function to get available slots for a date
async function getAvailableSlotsForDate(date) {
    const day = date.getDay();
    const { start, end } = getSlotRangeForDay(day);
    const allSlots = (0, generateSlots_1.default)(start, end);
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
    const bookedTimes = new Set(bookedAppointments.map((apt) => apt.time.slice(0, 5)));
    // Filter out booked slots
    return allSlots.filter((slot) => !bookedTimes.has(slot));
}
// Validation schemas
const createAppointmentSchema = zod_1.z.object({
    startTime: zod_1.z.string().datetime(),
    endTime: zod_1.z.string().datetime(),
    topic: zod_1.z.string().min(1),
    company: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
const updateAppointmentSchema = createAppointmentSchema.partial();
const createAppointment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { startTime, topic, company, message } = createAppointmentSchema.parse(req.body);
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
    }
    catch (error) {
        next(error);
    }
};
exports.createAppointment = createAppointment;
const getAppointments = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAppointments = getAppointments;
const getAppointment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
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
            throw new error_1.AppError(404, "Appointment not found");
        }
        if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        res.json({
            status: "success",
            data: { appointment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAppointment = getAppointment;
const updateAppointment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const { startTime, topic, company, message } = updateAppointmentSchema.parse(req.body);
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateAppointment = updateAppointment;
const cancelAppointment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });
        if (!appointment) {
            throw new error_1.AppError(404, "Appointment not found");
        }
        if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
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
    }
    catch (error) {
        next(error);
    }
};
exports.cancelAppointment = cancelAppointment;
const deleteAppointment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });
        if (!appointment) {
            throw new error_1.AppError(404, "Appointment not found");
        }
        if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        await prisma.appointment.delete({
            where: { id },
        });
        res.json({
            status: "success",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAppointment = deleteAppointment;
const getAllAppointments = async (req, res, next) => {
    try {
        const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        // Build filter conditions
        const where = {};
        if (status) {
            where.status = status;
        }
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAllAppointments = getAllAppointments;
