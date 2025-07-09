"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayment = exports.updatePayment = exports.getPayment = exports.getPayments = exports.createPayment = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const createPaymentSchema = zod_1.z.object({
    appointmentId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3),
});
const createPayment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { appointmentId, amount, currency } = createPaymentSchema.parse(req.body);
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });
        if (!appointment) {
            throw new error_1.AppError(404, "Appointment not found");
        }
        if (appointment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
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
    }
    catch (error) {
        next(error);
    }
};
exports.createPayment = createPayment;
const getPayments = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
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
    }
    catch (error) {
        next(error);
    }
};
exports.getPayments = getPayments;
const getPayment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
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
            throw new error_1.AppError(404, "Payment not found");
        }
        if (payment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        res.json({
            status: "success",
            data: { payment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayment = getPayment;
const updatePayment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const { status } = zod_1.z
            .object({
            status: zod_1.z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]),
        })
            .parse(req.body);
        const payment = await prisma.payment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new error_1.AppError(404, "Payment not found");
        }
        if (payment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
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
    }
    catch (error) {
        next(error);
    }
};
exports.updatePayment = updatePayment;
const deletePayment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const payment = await prisma.payment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new error_1.AppError(404, "Payment not found");
        }
        if (payment.userId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        await prisma.payment.delete({
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
exports.deletePayment = deletePayment;
