"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const error_1 = require("./error");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticate = async (req, _res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            throw new error_1.AppError(401, "Not authorized to access this route");
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
            throw new error_1.AppError(401, "Not authorized to access this route");
        }
        req.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
const requireRole = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            next(new error_1.AppError(401, "Not authorized to access this route"));
            return;
        }
        if (!roles.includes(req.user.role)) {
            next(new error_1.AppError(403, "Not authorized to access this route"));
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
