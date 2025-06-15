"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBlogPost = exports.updateBlogPost = exports.getBlogPost = exports.getBlogPosts = exports.createBlogPost = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const slugify_1 = __importDefault(require("slugify"));
const prisma = new client_1.PrismaClient();
// Validation schemas
const createBlogPostSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200),
    content: zod_1.z.string().min(100),
    excerpt: zod_1.z.string().max(300).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    imageUrl: zod_1.z.string().url().optional(),
});
// Helper function to generate slug
const generateSlug = (title) => {
    return (0, slugify_1.default)(title, { lower: true, strict: true });
};
const createBlogPost = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { title, content, excerpt, tags, imageUrl } = createBlogPostSchema.parse(req.body);
        const slug = generateSlug(title);
        const blogPost = await prisma.blogPost.create({
            data: {
                title,
                content,
                excerpt,
                tags,
                imageUrl,
                slug,
                authorId: userId,
            },
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        res.status(201).json({
            status: "success",
            data: { blogPost },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createBlogPost = createBlogPost;
// Get all blog posts (public view - only approved and published)
const getBlogPosts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, tag } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = tag ? { tags: { has: tag } } : {};
        const [posts, total] = await Promise.all([
            prisma.blogPost.findMany({
                where,
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
exports.getBlogPosts = getBlogPosts;
// Get a single blog post (public view - only approved and published)
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
// Update a blog post (author only)
const updateBlogPost = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const { title, content, tags } = createBlogPostSchema.parse(req.body);
        const post = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!post) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        if (post.authorId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        const updatedPost = await prisma.blogPost.update({
            where: { id },
            data: {
                title,
                content,
                tags,
            },
        });
        res.json({
            status: "success",
            data: { post: updatedPost },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateBlogPost = updateBlogPost;
// Delete a blog post (author only)
const deleteBlogPost = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const post = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!post) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        if (post.authorId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        await prisma.blogPost.delete({
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
exports.deleteBlogPost = deleteBlogPost;
