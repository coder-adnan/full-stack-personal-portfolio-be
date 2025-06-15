import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, BlogPostStatus } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import slugify from "slugify";
import NodeCache from "node-cache";

const prisma = new PrismaClient();

// Initialize cache with 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300 });

// Validation schemas
const createBlogPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(100),
  excerpt: z.string().max(300).nullable().optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().url().nullable().optional(),
  published: z.boolean().optional(),
});

const updateBlogPostSchema = createBlogPostSchema.partial();

// Helper function to generate slug
const generateSlug = (title: string): string => {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
};

// Create a new blog post
export const createBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const data = createBlogPostSchema.parse(req.body);
    const slug = generateSlug(data.title);

    // Calculate read time (assuming average reading speed of 200 words per minute)
    const wordCount = data.content.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200);

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        slug,
        authorId: userId,
        readTime,
        status: BlogPostStatus.PENDING, // Set initial status to PENDING
        published: false, // Always start as unpublished
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

    res.status(201).json({
      status: "success",
      data: {
        post,
      },
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
) => {
  try {
    const { page = 1, limit = 10, tag, authorId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter conditions
    const where = {
      status: BlogPostStatus.APPROVED, // Only show approved posts
      published: true, // Only show published posts
      ...(tag && { tags: { has: tag as string } }),
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

// Get a single blog post (public view - only approved and published)
export const getBlogPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
        status: BlogPostStatus.APPROVED, // Only show approved posts
        published: true, // Only show published posts
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

    if (!post) {
      throw new AppError(404, "Blog post not found");
    }

    res.json({
      status: "success",
      data: {
        post,
      },
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
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const data = updateBlogPostSchema.parse(req.body);

    // Check if post exists and belongs to user
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new AppError(404, "Blog post not found");
    }

    if (existingPost.authorId !== userId) {
      throw new AppError(403, "Not authorized to update this post");
    }

    // If title is being updated, generate new slug
    let slug = existingPost.slug;
    if (data.title && data.title !== existingPost.title) {
      slug = generateSlug(data.title);
    }

    // Calculate read time if content is updated
    let readTime = existingPost.readTime;
    if (data.content) {
      const wordCount = data.content.split(/\s+/).length;
      readTime = Math.ceil(wordCount / 200);
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: {
        ...data,
        slug,
        readTime,
        status: BlogPostStatus.PENDING, // Reset status to PENDING when post is updated
        published: false, // Reset published status when post is updated
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

// Delete a blog post (author only)
export const deleteBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    // Check if post exists and belongs to user
    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new AppError(404, "Blog post not found");
    }

    if (existingPost.authorId !== userId) {
      throw new AppError(403, "Not authorized to delete this post");
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
