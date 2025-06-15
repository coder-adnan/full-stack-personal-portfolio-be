"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMe = exports.updatePassword = exports.updateMe = exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const register = async (req, res, next) => {
    try {
        const { name, email, password } = registerSchema.parse(req.body);
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new error_1.AppError(400, "Email already registered");
        }
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({
            status: "success",
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user || user.password !== password) {
            throw new error_1.AppError(401, "Invalid email or password");
        }
        const token = "dummy-token"; // TODO: Implement JWT
        res.json({
            status: "success",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const logout = async (_req, res, next) => {
    try {
        // TODO: Implement proper logout (e.g., invalidate token)
        res.json({
            status: "success",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const getProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        res.json({
            status: "success",
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { name, email } = registerSchema
            .omit({ password: true })
            .partial()
            .parse(req.body);
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        if (email && email !== user.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                throw new error_1.AppError(400, "Email already registered");
            }
        }
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({
            status: "success",
            data: { user: updatedUser },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMe = updateMe;
const updatePassword = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { currentPassword, newPassword } = zod_1.z
            .object({
            currentPassword: zod_1.z.string(),
            newPassword: zod_1.z.string().min(6),
        })
            .parse(req.body);
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        if (user.password !== currentPassword) {
            throw new error_1.AppError(401, "Current password is incorrect");
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: newPassword,
            },
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
exports.updatePassword = updatePassword;
const deleteMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        await prisma.user.delete({
            where: { id: userId },
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
exports.deleteMe = deleteMe;
