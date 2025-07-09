"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
const errorHandler = (err, _req, res, _next) => {
    console.error("Error:", err);
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: "error",
            message: err.message,
        });
    }
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            status: "error",
            message: "Validation error",
            errors: err.errors,
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            return res.status(400).json({
                status: "error",
                message: "A record with this value already exists",
            });
        }
        if (err.code === "P2025") {
            return res.status(404).json({
                status: "error",
                message: "Record not found",
            });
        }
    }
    return res.status(500).json({
        status: "error",
        message: "Internal server error",
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (_req, res, _next) => {
    res.status(404).json({
        status: "error",
        message: "Not found",
    });
};
exports.notFoundHandler = notFoundHandler;
