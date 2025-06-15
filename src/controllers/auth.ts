import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { sendWelcomeEmail } from "../utils/email";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate token
    const token = sign(
      { userId: user.id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set HTTP-only cookie
    res.cookie("token", token, COOKIE_OPTIONS);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name);

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      status: "success",
      data: {
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Login attempt:", { email: req.body.email });
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log("Login failed: User not found");
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      console.log("Login failed: Invalid password");
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    console.log("Login successful for user:", {
      id: user.id,
      email: user.email,
    });

    // Generate token
    const token = sign(
      { userId: user.id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set HTTP-only cookie
    res.cookie("token", token, COOKIE_OPTIONS);

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      status: "success",
      data: {
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  // Clear the cookie
  res.clearCookie("token", {
    ...COOKIE_OPTIONS,
    maxAge: undefined,
  });

  res.json({
    status: "success",
    message: "Logged out successfully",
  });
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Profile request received:", { user: req.user });

    if (!req.user?.userId) {
      console.error("No user ID in request");
      throw new AppError(401, "Authentication required");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      console.error("User not found:", { userId: req.user.userId });
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    console.log("Profile retrieved successfully:", { userId: user.id });

    res.json({
      status: "success",
      data: {
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);
    next(error);
  }
};
