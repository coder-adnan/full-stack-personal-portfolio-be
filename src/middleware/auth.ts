import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";
import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import { adminAuth } from "../config/firebaseAdmin";

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export type AuthRequest = Request;

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    console.log("Token from header:", token);

    // If not in header, try to get from cookies
    if (!token && req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie);
      token = cookies.token;
      console.log("Token from cookie:", token);
    }

    if (!token) {
      throw new AppError(401, "Not authorized to access this route");
    }

    // Try JWT verification first (existing logic)
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as { id: string };
      const userId = decoded.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user) {
        throw new AppError(401, "User not found");
      }

      req.user = user;
      return next();
    } catch (error) {
      // If JWT fails, try Firebase
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        req.user = {
          id: decoded.uid,
          role: "USER", // or map custom claims if you use them
        };
        return next();
      } catch (firebaseError) {
        throw new AppError(401, "Invalid token");
      }
    }
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Not authorized to access this route"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Not authorized to access this route"));
      return;
    }

    next();
  };
};
