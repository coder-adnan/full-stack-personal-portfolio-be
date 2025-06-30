import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import slugify from "slugify";
import multer from "multer";
import { cloudinaryStorage } from "../config/cloudinary";
import cloudinary from "../config/cloudinary";
import axios from "axios";

const prisma = new PrismaClient();

// Configure multer for Cloudinary uploads
const upload = multer({
  storage: cloudinaryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (Cloudinary supports larger files)
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Validation schemas
const blockSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "heading"]),
  content: z.string(),
  imageUrl: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true; // Allow empty string
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Invalid URL format"),
  order: z.number(),
});

const createBlogPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.array(blockSchema), // Now accepts array of blocks
  excerpt: z.string().max(300).optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true; // Allow empty string
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Invalid URL format"),
  turnstileToken: z.string().min(1, "Security check is required"),
});

const updateBlogPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.array(blockSchema), // Now accepts array of blocks
  excerpt: z.string().max(300).optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true; // Allow empty string
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Invalid URL format"),
});

// Helper function to generate slug
const generateSlug = (title: string): string => {
  return slugify(title, { lower: true, strict: true });
};

const generateUniqueSlug = async (title: string): Promise<string> => {
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
const extractCloudinaryPublicId = (url: string): string | null => {
  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
      const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join("/");
      // Remove file extension
      return publicIdWithExtension.split(".")[0];
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Helper function to delete image from Cloudinary
const deleteImageFromCloudinary = async (
  imageUrl: string | null
): Promise<void> => {
  try {
    if (!imageUrl) return;

    const publicId = extractCloudinaryPublicId(imageUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

// Helper function to extract and delete images from content blocks
const deleteImagesFromContent = async (content: any[]): Promise<void> => {
  try {
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (block.type === "image" && block.imageUrl) {
        await deleteImageFromCloudinary(block.imageUrl);
      }
    }
  } catch (error) {
    console.error("Error deleting images from content:", error);
  }
};

// Turnstile verification function
const verifyTurnstileToken = async (token: string): Promise<boolean> => {
  try {
    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY || "",
        response: token,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return (response.data as { success: boolean }).success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
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

    const { title, content, excerpt, tags, imageUrl, turnstileToken } =
      createBlogPostSchema.parse(req.body);

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
        content: content as any, // Cast to any since Prisma will handle JSON
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

    // Only return approved blogs for public endpoint
    const where: any = { status: "APPROVED" };
    if (tag) where.tags = { has: tag as string };

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
): Promise<void> => {
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

// Get a single blog post by ID (for editing - no status filter)
export const getBlogPostById = async (
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
    const { title, content, tags, excerpt, imageUrl } =
      updateBlogPostSchema.parse(req.body);

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new AppError(404, "Blog post not found");
    }

    if (post.authorId !== userId && req.user?.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    // Clean up old featured image if it's being replaced
    if (post.imageUrl && post.imageUrl !== imageUrl) {
      await deleteImageFromCloudinary(post.imageUrl);
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: {
        title,
        content: content as any,
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

    // Clean up images from Cloudinary
    await deleteImageFromCloudinary(post.imageUrl);

    // Clean up images from content blocks
    if (post.content && typeof post.content === "object") {
      await deleteImagesFromContent(post.content as any[]);
    }

    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Image upload endpoint
export const uploadImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    upload.single("image")(req as any, res as any, async (err: any) => {
      if (err) {
        return next(new AppError(400, err.message));
      }

      if (!req.file) {
        return next(new AppError(400, "No image file provided"));
      }

      // Cloudinary returns the file object with different properties
      const file = req.file as any;

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
  } catch (error) {
    next(error);
  }
};
