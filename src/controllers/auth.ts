import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { adminAuth } from "../config/firebaseAdmin";

const prisma = new PrismaClient();

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Helper function to generate JWT token
const generateToken = (userId: string, role: string): string => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// Helper to get cookie options based on environment
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    domain: isProd ? ".fullstackadnan.com" : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    // Check if user already exists
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
    const token = generateToken(user.id, user.role);

    // Set cookie
    res.cookie("token", token, getCookieOptions());

    res.status(201).json({
      status: "success",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
      return;
    }
    next(error);
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

    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, "Invalid email or password");
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie
    res.cookie("token", token, getCookieOptions());

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
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
      return;
    }
    next(error);
  }
};

export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.clearCookie("token", getCookieOptions());
    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// This line is to trigger the CI/CD
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

export const firebaseLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: "Missing Firebase ID token" });
      return;
    }

    // Verify token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Find or create user in your DB
    let user = await prisma.user.findUnique({
      where: { email: decoded.email! },
    });
    if (!user) {
      // Hash the dummy password for social login
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("firebase", salt);
      user = await prisma.user.create({
        data: {
          email: decoded.email!,
          name: decoded.name || decoded.email!.split("@")[0],
          password: hashedPassword,
        },
      });
    }

    // Issue session/cookie/JWT (reuse your existing logic)
    // For example, if you use JWT:
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });
    res.cookie("token", token, getCookieOptions());

    res.json({ status: "success", data: { user } });
    return;
  } catch (error) {
    next(error);
    return;
  }
};
