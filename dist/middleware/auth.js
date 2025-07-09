"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const error_1 = require("./error");
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie = __importStar(require("cookie"));
const firebaseAdmin_1 = require("../config/firebaseAdmin");
const prisma = new client_1.PrismaClient();
const authenticate = async (req, _res, next) => {
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
            throw new error_1.AppError(401, "Not authorized to access this route");
        }
        // Try JWT verification first (existing logic)
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "your-secret-key");
            const userId = decoded.id;
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    role: true,
                },
            });
            if (!user) {
                throw new error_1.AppError(401, "User not found");
            }
            req.user = user;
            return next();
        }
        catch (error) {
            // If JWT fails, try Firebase
            try {
                const decoded = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
                req.user = {
                    id: decoded.uid,
                    role: "USER", // or map custom claims if you use them
                };
                return next();
            }
            catch (firebaseError) {
                throw new error_1.AppError(401, "Invalid token");
            }
        }
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
