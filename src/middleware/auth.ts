import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";
import { PrismaClient, Role } from "@prisma/client";

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

    // TODO: Implement JWT verification
    const userId = "dummy-user-id"; // This should come from JWT verification

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(401, "Not authorized to access this route");
    }

    req.user = user;
    next();
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
