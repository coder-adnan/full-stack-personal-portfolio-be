import { User } from "@prisma/client";
import { Role } from "./index";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
      };
    }
  }
}

export interface AuthRequest extends Express.Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}
