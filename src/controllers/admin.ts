import { Request, Response, NextFunction } from "express";
import { PrismaClient, BlogPostStatus, Role } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import NodeCache from "node-cache";
import { z } from "zod";

const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 300 });

// Validation schemas
const reviewBlogPostSchema = z.object({
  status: z.nativeEnum(BlogPostStatus),
  reviewNotes: z.string().max(500).optional(),
});

const updateBlogPostSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(100).optional(),
  excerpt: z.string().max(300).nullable().optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().url().nullable().optional(),
  published: z.boolean().optional(),
  status: z.nativeEnum(BlogPostStatus).optional(),
});

// Middleware to check if user is admin
export const isAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user || user.role !== Role.ADMIN) {
      throw new AppError(403, "Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Get all blog posts (admin view)
export const getAllBlogPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status, authorId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(status && { status: status as BlogPostStatus }),
      ...(authorId && { authorId: authorId as string }),
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
  } catch (error) {
    next(error);
  }
};

// Review a blog post
export const reviewBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId;

    if (!adminId) {
      throw new AppError(401, "Unauthorized");
    }

    const { status, reviewNotes } = reviewBlogPostSchema.parse(req.body);

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new AppError(404, "Blog post not found");
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: {
        status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes,
        published: status === BlogPostStatus.APPROVED, // Auto-publish when approved
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
  } catch (error) {
    next(error);
  }
};

// Update a blog post (admin)
export const updateBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId;

    if (!adminId) {
      throw new AppError(401, "Unauthorized");
    }

    const data = updateBlogPostSchema.parse(req.body);

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new AppError(404, "Blog post not found");
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
  } catch (error) {
    next(error);
  }
};

// Delete a blog post (admin)
export const deleteBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new AppError(404, "Blog post not found");
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
  } catch (error) {
    next(error);
  }
};
