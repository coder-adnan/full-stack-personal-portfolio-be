import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import slugify from "slugify";

const prisma = new PrismaClient();

// Validation schemas
const createBlogPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(100),
  excerpt: z.string().max(300).optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
});

// Helper function to generate slug
const generateSlug = (title: string): string => {
  return slugify(title, { lower: true, strict: true });
};

export const createBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { title, content, excerpt, tags, imageUrl } =
      createBlogPostSchema.parse(req.body);
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
  } catch (error) {
    next(error);
  }
};

// Get all blog posts (public view - only approved and published)
export const getBlogPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, tag } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = tag ? { tags: { has: tag as string } } : {};

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
  } catch (error) {
    next(error);
  }
};

// Get a single blog post (public view - only approved and published)
export const getBlogPost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      throw new AppError(404, "Blog post not found");
    }

    res.json({
      status: "success",
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

// Update a blog post (author only)
export const updateBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = req.params;
    const { title, content, tags } = createBlogPostSchema.parse(req.body);

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new AppError(404, "Blog post not found");
    }

    if (post.authorId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
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
  } catch (error) {
    next(error);
  }
};

// Delete a blog post (author only)
export const deleteBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new AppError(404, "Blog post not found");
    }

    if (post.authorId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    await prisma.blogPost.delete({
      where: { id },
    });

    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
