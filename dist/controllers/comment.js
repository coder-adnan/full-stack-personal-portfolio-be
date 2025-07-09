"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.createComment = exports.getComments = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const node_cache_1 = __importDefault(require("node-cache"));
const prisma = new client_1.PrismaClient();
const cache = new node_cache_1.default({ stdTTL: 300 }); // 5 minutes cache
// Validation schemas
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    postId: zod_1.z.string(),
    parentId: zod_1.z.string().optional(),
});
// Get comments for a post
const getComments = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where: {
                    postId,
                    parentId: null, // Only get top-level comments
                },
                include: {
                    author: {
                        select: {
                            name: true,
                        },
                    },
                    replies: {
                        include: {
                            author: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                        orderBy: {
                            createdAt: "asc",
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: Number(limit),
            }),
            prisma.comment.count({
                where: {
                    postId,
                    parentId: null,
                },
            }),
        ]);
        res.json({
            status: "success",
            data: {
                comments,
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
exports.getComments = getComments;
// Helper function to invalidate all comment caches for a post
const invalidateCommentCache = (postId) => {
    // Get all keys in the cache
    const keys = cache.keys();
    // Find all keys that start with post-comments-${postId}
    const commentKeys = keys.filter((key) => key.startsWith(`post-comments-${postId}`));
    // Delete all matching keys
    commentKeys.forEach((key) => {
        console.log("Invalidating cache key:", key);
        cache.del(key);
    });
};
// Create a new comment
const createComment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { content, postId, parentId } = createCommentSchema.parse(req.body);
        // Verify post exists
        const post = await prisma.blogPost.findUnique({
            where: { id: postId },
        });
        if (!post) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        // If this is a reply, verify parent comment exists
        if (parentId) {
            const parentComment = await prisma.comment.findUnique({
                where: { id: parentId },
            });
            if (!parentComment) {
                throw new error_1.AppError(404, "Parent comment not found");
            }
            if (parentComment.postId !== postId) {
                throw new error_1.AppError(400, "Parent comment does not belong to this post");
            }
        }
        const comment = await prisma.comment.create({
            data: {
                content,
                postId,
                parentId,
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
        // Invalidate all comment caches for this post
        invalidateCommentCache(postId);
        res.status(201).json({
            status: "success",
            data: { comment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createComment = createComment;
// Update a comment
const updateComment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const { content } = createCommentSchema
            .pick({ content: true })
            .parse(req.body);
        const comment = await prisma.comment.findUnique({
            where: { id },
        });
        if (!comment) {
            throw new error_1.AppError(404, "Comment not found");
        }
        if (comment.authorId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        const updatedComment = await prisma.comment.update({
            where: { id },
            data: { content },
            include: {
                author: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        // Invalidate cache
        invalidateCommentCache(comment.postId);
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
// Delete a comment
const deleteComment = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const comment = await prisma.comment.findUnique({
            where: { id },
        });
        if (!comment) {
            throw new error_1.AppError(404, "Comment not found");
        }
        if (comment.authorId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        await prisma.comment.delete({
            where: { id },
        });
        // Invalidate all comment caches for this post
        invalidateCommentCache(comment.postId);
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
