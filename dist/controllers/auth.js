"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseLogin = exports.deleteMe = exports.updatePassword = exports.updateMe = exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebaseAdmin_1 = require("../config/firebaseAdmin");
const prisma = new client_1.PrismaClient();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
});
// Helper function to generate JWT token
const generateToken = (userId, role) => {
    return jsonwebtoken_1.default.sign({ id: userId, role }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });
};
// Helper to get cookie options based on environment
const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        domain: isProd ? ".fullstackadnan.com" : undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};
const register = async (req, res, next) => {
    try {
        const { name, email, password } = registerSchema.parse(req.body);
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new error_1.AppError(400, "Email already registered");
        }
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
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
        // Generate JWT token
        const token = generateToken(user.id, user.role);
        // Set cookie
        res.cookie("token", token, getCookieOptions());
        res.status(201).json({
            status: "success",
            data: {
                user,
                token,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            next(new error_1.AppError(400, error.errors[0].message));
            return;
        }
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
        if (!user) {
            throw new error_1.AppError(401, "Invalid email or password");
        }
        // Verify password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new error_1.AppError(401, "Invalid email or password");
        }
        // Generate JWT token
        const token = generateToken(user.id, user.role);
        // Set cookie
        res.cookie("token", token, getCookieOptions());
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
        if (error instanceof zod_1.z.ZodError) {
            next(new error_1.AppError(400, error.errors[0].message));
            return;
        }
        next(error);
    }
};
exports.login = login;
const logout = async (_req, res, next) => {
    try {
        res.clearCookie("token", getCookieOptions());
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
// This line is to trigger the CI/CD
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
const firebaseLogin = async (req, res, next) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ message: "Missing Firebase ID token" });
            return;
        }
        // Verify token
        const decoded = await firebaseAdmin_1.adminAuth.verifyIdToken(idToken);
        // Find or create user in your DB
        let user = await prisma.user.findUnique({
            where: { email: decoded.email },
        });
        if (!user) {
            // Hash the dummy password for social login
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash("firebase", salt);
            user = await prisma.user.create({
                data: {
                    email: decoded.email,
                    name: decoded.name || decoded.email.split("@")[0],
                    password: hashedPassword,
                },
            });
        }
        // Issue session/cookie/JWT (reuse your existing logic)
        // For example, if you use JWT:
        const token = jsonwebtoken_1.default.sign({ id: user.id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        res.cookie("token", token, getCookieOptions());
        res.json({ status: "success", data: { user } });
        return;
    }
    catch (error) {
        next(error);
        return;
    }
};
exports.firebaseLogin = firebaseLogin;
