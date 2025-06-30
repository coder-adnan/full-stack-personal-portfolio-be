import type { Response, NextFunction } from "express";
import { PrismaClient, BlogPostStatus, Role } from "@prisma/client";
import { AppError } from "../middleware/error";
import type { AuthRequest } from "../middleware/auth";
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

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

// Middleware to check if user is admin
export const isAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
          reviewedByUser: {
            select: {
              id: true,
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

// Review a blog post
export const reviewBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

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
    const adminId = req.user?.id;

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

export const getDashboardStats = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AppError(401, "Unauthorized");
    }

    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
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
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new AppError(401, "Unauthorized");
    }

    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
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
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new AppError(401, "Unauthorized");
    }

    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw new AppError(403, "Forbidden");
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!["USER", "ADMIN"].includes(role)) {
      throw new AppError(400, "Invalid role");
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
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (
  _req: AuthRequest,
  res: Response,
  _next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    _next(error);
  }
};

export const getUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      throw new AppError(404, "User not found");
    }

    res.json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role } = updateUserSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError(404, "User not found");
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
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    await prisma.user.delete({
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

export const getAppointments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      throw new AppError(404, "Appointment not found");
    }

    res.json({
      status: "success",
      data: { appointment },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, date, time } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
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
  } catch (error) {
    next(error);
  }
};

export const deleteAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new AppError(404, "Appointment not found");
    }

    await prisma.appointment.delete({
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

export const getPayments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      throw new AppError(404, "Payment not found");
    }

    res.json({
      status: "success",
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminBlogPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true } },
      },
    });
    if (!post) {
      res.status(404).json({ status: "error", message: "Blog post not found" });
      return;
    }
    res.json({ status: "success", data: { post } });
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, amount, currency } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
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
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    await prisma.payment.delete({
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

export const getBlogPosts = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    next(error);
  }
};

export const getBlogPost = async (
  req: AuthRequest,
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

export const getComments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
  } catch (error) {
    next(error);
  }
};

export const getComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
      throw new AppError(404, "Comment not found");
    }

    res.json({
      status: "success",
      data: { comment },
    });
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new AppError(404, "Comment not found");
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
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new AppError(404, "Comment not found");
    }

    await prisma.comment.delete({
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
