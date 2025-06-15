import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Registration attempt:", { body: req.body });

    const { name, email, password } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(400, "Email already registered");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

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
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      status: "success",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      next(new AppError(400, "Invalid input data", error.errors));
    } else {
      next(error);
    }
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.password !== password) {
      throw new AppError(401, "Invalid email or password");
    }

    const token = "dummy-token"; // TODO: Implement JWT

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
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Implement proper logout (e.g., invalidate token)
    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
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

export const updateMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { name, email } = registerSchema
      .omit({ password: true })
      .partial()
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new AppError(400, "Email already registered");
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
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.password !== currentPassword) {
      throw new AppError(401, "Current password is incorrect");
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
  } catch (error) {
    next(error);
  }
};

export const deleteMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
