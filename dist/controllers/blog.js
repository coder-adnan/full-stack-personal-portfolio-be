"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = exports.deleteBlogPost = exports.updateBlogPost = exports.getBlogPostById = exports.getBlogPost = exports.getBlogPosts = exports.createBlogPost = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const zod_1 = require("zod");
const slugify_1 = __importDefault(require("slugify"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("../config/cloudinary");
const cloudinary_2 = __importDefault(require("../config/cloudinary"));
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
// Configure multer for Cloudinary uploads
const upload = (0, multer_1.default)({
    storage: cloudinary_1.cloudinaryStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit (Cloudinary supports larger files)
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) {
            return cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed!"));
        }
    },
});
// Validation schemas
const blockSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(["text", "image", "heading"]),
    content: zod_1.z.string(),
    imageUrl: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val || val === "")
            return true; // Allow empty string
        try {
            new URL(val);
            return true;
        }
        catch {
            return false;
        }
    }, "Invalid URL format"),
    order: zod_1.z.number(),
});
const createBlogPostSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200),
    content: zod_1.z.array(blockSchema), // Now accepts array of blocks
    excerpt: zod_1.z.string().max(300).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    imageUrl: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val || val === "")
            return true; // Allow empty string
        try {
            new URL(val);
            return true;
        }
        catch {
            return false;
        }
    }, "Invalid URL format"),
    turnstileToken: zod_1.z.string().min(1, "Security check is required"),
});
const updateBlogPostSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200),
    content: zod_1.z.array(blockSchema), // Now accepts array of blocks
    excerpt: zod_1.z.string().max(300).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    imageUrl: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val || val === "")
            return true; // Allow empty string
        try {
            new URL(val);
            return true;
        }
        catch {
            return false;
        }
    }, "Invalid URL format"),
});
// Helper function to generate slug
const generateSlug = (title) => {
    return (0, slugify_1.default)(title, { lower: true, strict: true });
};
const generateUniqueSlug = async (title) => {
    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    // Check if slug exists and keep trying with incremented numbers
    while (true) {
        const existingPost = await prisma.blogPost.findUnique({
            where: { slug },
        });
        if (!existingPost) {
            break; // Slug is unique, we can use it
        }
        // Slug exists, try with a number suffix
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
};
// Helper function to extract Cloudinary public ID from URL
const extractCloudinaryPublicId = (url) => {
    try {
        const urlParts = url.split("/");
        const uploadIndex = urlParts.findIndex((part) => part === "upload");
        if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
            const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join("/");
            // Remove file extension
            return publicIdWithExtension.split(".")[0];
        }
        return null;
    }
    catch (error) {
        return null;
    }
};
// Helper function to delete image from Cloudinary
const deleteImageFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl)
            return;
        const publicId = extractCloudinaryPublicId(imageUrl);
        if (publicId) {
            await cloudinary_2.default.uploader.destroy(publicId);
        }
    }
    catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
    }
};
// Helper function to extract and delete images from content blocks
const deleteImagesFromContent = async (content) => {
    try {
        if (!Array.isArray(content))
            return;
        for (const block of content) {
            if (block.type === "image" && block.imageUrl) {
                await deleteImageFromCloudinary(block.imageUrl);
            }
        }
    }
    catch (error) {
        console.error("Error deleting images from content:", error);
    }
};
// Turnstile verification function
const verifyTurnstileToken = async (token) => {
    try {
        const response = await axios_1.default.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", new URLSearchParams({
            secret: process.env.TURNSTILE_SECRET_KEY || "",
            response: token,
        }), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        return response.data.success === true;
    }
    catch (error) {
        console.error("Turnstile verification error:", error);
        return false;
    }
};
const createBlogPost = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { title, content, excerpt, tags, imageUrl, turnstileToken } = createBlogPostSchema.parse(req.body);
        // Verify Turnstile token
        const isTokenValid = await verifyTurnstileToken(turnstileToken);
        if (!isTokenValid) {
            res.status(400).json({
                success: false,
                message: "Security check failed. Please try again.",
            });
            return;
        }
        const slug = await generateUniqueSlug(title);
        const userRole = req.user?.role;
        const blogPost = await prisma.blogPost.create({
            data: {
                title,
                content: content, // Cast to any since Prisma will handle JSON
                excerpt,
                tags,
                imageUrl,
                slug,
                authorId: userId,
                status: userRole === "ADMIN" ? "APPROVED" : "PENDING",
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
        // Only return approved blogs for public endpoint
        const where = { status: "APPROVED" };
        if (tag)
            where.tags = { has: tag };
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
exports.getBlogPosts = getBlogPosts;
// Get a single blog post (public view - only approved and published)
const getBlogPost = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const post = await prisma.blogPost.findFirst({
            where: {
                slug,
                status: "APPROVED", // Only return approved posts for public access
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                comments: {
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
// Get a single blog post by ID (for editing - no status filter)
const getBlogPostById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await prisma.blogPost.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                comments: {
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
exports.getBlogPostById = getBlogPostById;
// Update a blog post (author only)
const updateBlogPost = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        const { id } = req.params;
        const { title, content, tags, excerpt, imageUrl } = updateBlogPostSchema.parse(req.body);
        const post = await prisma.blogPost.findUnique({
            where: { id },
        });
        if (!post) {
            throw new error_1.AppError(404, "Blog post not found");
        }
        if (post.authorId !== userId && req.user?.role !== "ADMIN") {
            throw new error_1.AppError(403, "Forbidden");
        }
        // Clean up old featured image if it's being replaced
        if (post.imageUrl && post.imageUrl !== imageUrl) {
            await deleteImageFromCloudinary(post.imageUrl);
        }
        const updatedPost = await prisma.blogPost.update({
            where: { id },
            data: {
                title,
                content: content,
                tags,
                excerpt,
                imageUrl,
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
        // Clean up images from Cloudinary
        await deleteImageFromCloudinary(post.imageUrl);
        // Clean up images from content blocks
        if (post.content && typeof post.content === "object") {
            await deleteImagesFromContent(post.content);
        }
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
// Image upload endpoint
const uploadImage = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new error_1.AppError(401, "Unauthorized");
        }
        upload.single("image")(req, res, async (err) => {
            if (err) {
                return next(new error_1.AppError(400, err.message));
            }
            if (!req.file) {
                return next(new error_1.AppError(400, "No image file provided"));
            }
            // Cloudinary returns the file object with different properties
            const file = req.file;
            res.json({
                status: "success",
                data: {
                    imageUrl: file.path, // Cloudinary URL
                    publicId: file.filename, // Cloudinary public ID
                    originalName: file.originalname,
                    size: file.size,
                    format: file.format,
                    width: file.width,
                    height: file.height,
                },
            });
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadImage = uploadImage;
