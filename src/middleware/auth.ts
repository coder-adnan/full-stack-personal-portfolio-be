import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { AppError } from "./error";
import { PrismaClient } from "@prisma/client";
import { Role } from "../types";

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Auth middleware - Request cookies:", req.cookies);
    const token = req.cookies.token;

    if (!token) {
      console.log("Auth middleware - No token found in cookies");
      throw new AppError(401, "Authentication required");
    }

    try {
      console.log("Auth middleware - Verifying token");
      const decoded = verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as {
        userId: string;
      };
      console.log("Auth middleware - Token decoded:", decoded);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (!user) {
        console.log(
          "Auth middleware - User not found in database:",
          decoded.userId
        );
        throw new AppError(401, "User no longer exists");
      }

      console.log("Auth middleware - User found:", {
        id: user.id,
        email: user.email,
      });
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      console.error("Auth middleware - Token verification error:", error);
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      throw new AppError(401, "Invalid or expired token");
    }
  } catch (error) {
    console.error("Auth middleware - Error:", error);
    next(error);
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
};
