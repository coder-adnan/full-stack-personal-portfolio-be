"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.getComment = exports.getComments = exports.getBlogPost = exports.getBlogPosts = exports.deletePayment = exports.updatePayment = exports.getPayment = exports.getPayments = exports.deleteAppointment = exports.updateAppointment = exports.getAppointment = exports.getAppointments = exports.deleteUser = exports.updateUser = exports.getUser = exports.getUsers = exports.updateUserRole = exports.getAllUsers = exports.getDashboardStats = exports.deleteBlogPost = exports.updateBlogPost = exports.reviewBlogPost = exports.getAllBlogPosts = exports.isAdmin = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const node_cache_1 = __importDefault(require("node-cache"));
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const cache = new node_cache_1.default({ stdTTL: 300 });
// Validation schemas
const reviewBlogPostSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.BlogPostStatus),
    reviewNotes: zod_1.z.string().max(500).optional(),
});
const updateBlogPostSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200).optional(),
    content: zod_1.z.string().min(100).optional(),
    excerpt: zod_1.z.string().max(300).nullable().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    imageUrl: zod_1.z.string().url().nullable().optional(),
    published: zod_1.z.boolean().optional(),
    status: zod_1.z.nativeEnum(client_1.BlogPostStatus).optional(),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    role: zod_1.z.enum(["USER", "ADMIN"]).optional(),
});
// Middleware to check if user is admin
const isAdmin = async (req, _res, next) => {
    try {
        if (!req.user?.id) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user || user.role !== client_1.Role.ADMIN) {
            throw new error_1.AppError(403, "Admin access required");
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.isAdmin = isAdmin;
// Get all blog posts (admin view)
const getAllBlogPosts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, authorId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            ...(status && { status: status }),
            ...(authorId && { authorId: authorId }),
        };
        const [posts, total] = await Promise.all([
            prisma.blogPost.findMany({
                where,
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: Number(limit),
            }),
            prisma.blogPost.count({ where }),
        ]);
        res.json({
            status: "success",
            data: {
                posts,
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
exports.getAllBlogPosts = getAllBlogPosts;
// Review a blog post
const reviewBlogPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        if (!adminId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { status, reviewNotes } = reviewBlogPostSchema.parse(req.body);
        const existingPost = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!existingPost) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        const updatedPost = await prisma.blogPost.update({
            where: { id },
            data: {
                status,
                reviewedBy: adminId,
                reviewedAt: new Date(),
                reviewNotes,
                published: status === client_1.BlogPostStatus.APPROVED, // Auto-publish when approved
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        // Invalidate cache
        cache.flushAll();
        res.json({
            status: "success",
            data: {
                post: updatedPost,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.reviewBlogPost = reviewBlogPost;
// Update a blog post (admin)
const updateBlogPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        if (!adminId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const data = updateBlogPostSchema.parse(req.body);
        const existingPost = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!existingPost) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        const updatedPost = await prisma.blogPost.update({
            where: { id },
            data: {
                ...data,
                reviewedBy: adminId,
                reviewedAt: new Date(),
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        // Invalidate cache
        cache.flushAll();
        res.json({
            status: "success",
            data: {
                post: updatedPost,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateBlogPost = updateBlogPost;
// Delete a blog post (admin)
const deleteBlogPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existingPost = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!existingPost) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        await prisma.blogPost.delete({
            where: { id },
        });
        // Invalidate cache
        cache.flushAll();
        res.json({
            status: "success",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteBlogPost = deleteBlogPost;
const getDashboardStats = async (req, _res, next) => {
    try {
        if (!req.user?.id) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        // Verify admin role
        const admin = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true },
        });
        if (!admin || admin.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        // Get counts
        const [users, appointments, payments] = await Promise.all([
            prisma.user.count(),
            prisma.appointment.count(),
            prisma.payment.count(),
        ]);
        // Get recent appointments
        const recentAppointments = await prisma.appointment.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });
        // Get recent payments
        const recentPayments = await prisma.payment.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                appointment: {
                    select: {
                        date: true,
                        time: true,
                        topic: true,
                    },
                },
            },
        });
        // Calculate total revenue
        const totalRevenue = await prisma.payment.aggregate({
            where: {
                status: "COMPLETED",
            },
            _sum: {
                amount: true,
            },
        });
        _res.json({
            status: "success",
            data: {
                stats: {
                    users,
                    appointments,
                    payments,
                    totalRevenue: totalRevenue._sum.amount || 0,
                },
                recentAppointments,
                recentPayments,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardStats = getDashboardStats;
const getAllUsers = async (req, res, next) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        // Verify admin role
        const admin = await prisma.user.findUnique({
            where: { id: adminId },
            select: { role: true },
        });
        if (!admin || admin.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        res.json({
            status: "success",
            data: { users },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllUsers = getAllUsers;
const updateUserRole = async (req, res, next) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        // Verify admin role
        const admin = await prisma.user.findUnique({
            where: { id: adminId },
            select: { role: true },
        });
        if (!admin || admin.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        const { userId } = req.params;
        const { role } = req.body;
        if (!["USER", "ADMIN"].includes(role)) {
            throw new error_1.AppError(400, "Invalid role");
        }
        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });
        res.json({
            status: "success",
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserRole = updateUserRole;
const getUsers = async (_req, res, _next) => {
    try {
        const users = await prisma.user.findMany({
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
            data: { users },
        });
    }
    catch (error) {
        _next(error);
    }
};
exports.getUsers = getUsers;
const getUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
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
exports.getUser = getUser;
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, role } = updateUserSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                role,
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
exports.updateUser = updateUser;
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new error_1.AppError(404, "User not found");
        }
        await prisma.user.delete({
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
exports.deleteUser = deleteUser;
const getAppointments = async (_req, res, next) => {
    try {
        const appointments = await prisma.appointment.findMany({
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                date: "desc",
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
        const { id } = req.params;
        const { status, date, time } = req.body;
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });
        if (!appointment) {
            throw new error_1.AppError(404, "Appointment not found");
        }
        const updatedAppointment = await prisma.appointment.update({
            where: { id },
            data: {
                status,
                date,
                time,
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
exports.updateAppointment = updateAppointment;
const deleteAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });
        if (!appointment) {
            throw new error_1.AppError(404, "Appointment not found");
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
const getPayments = async (_req, res, next) => {
    try {
        const payments = await prisma.payment.findMany({
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
        const { id } = req.params;
        const { status, amount, currency } = req.body;
        const payment = await prisma.payment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new error_1.AppError(404, "Payment not found");
        }
        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: {
                status,
                amount,
                currency,
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
        const { id } = req.params;
        const payment = await prisma.payment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new error_1.AppError(404, "Payment not found");
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
const getBlogPosts = async (_req, res, next) => {
    try {
        const posts = await prisma.blogPost.findMany({
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        res.json({
            status: "success",
            data: { posts },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBlogPosts = getBlogPosts;
const getBlogPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await prisma.blogPost.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
                comments: {
                    include: {
                        author: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!post) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        res.json({
            status: "success",
            data: { post },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBlogPost = getBlogPost;
const getComments = async (_req, res, next) => {
    try {
        const comments = await prisma.comment.findMany({
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
                post: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        res.json({
            status: "success",
            data: { comments },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getComments = getComments;
const getComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const comment = await prisma.comment.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
                post: true,
            },
        });
        if (!comment) {
            throw new error_1.AppError(404, "Comment not found");
        }
        res.json({
            status: "success",
            data: { comment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getComment = getComment;
const updateComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const comment = await prisma.comment.findUnique({
            where: { id },
        });
        if (!comment) {
            throw new error_1.AppError(404, "Comment not found");
        }
        const updatedComment = await prisma.comment.update({
            where: { id },
            data: {
                content,
            },
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
                post: true,
            },
        });
        res.json({
            status: "success",
            data: { comment: updatedComment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateComment = updateComment;
const deleteComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const comment = await prisma.comment.findUnique({
            where: { id },
        });
        if (!comment) {
            throw new error_1.AppError(404, "Comment not found");
        }
        await prisma.comment.delete({
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
exports.deleteComment = deleteComment;
