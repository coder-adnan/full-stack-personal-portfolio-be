import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";
import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";

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
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new AppError(401, "Not authorized to access this route");
    }

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
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, "Invalid token");
      }
      throw error;
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
