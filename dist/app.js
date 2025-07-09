"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middleware/error");
// Load environment variables
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv_1.default.config({ path: envFile });
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use((0, cookie_parser_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// CORS Configurations
app.use((0, cors_1.default)({
    origin: [process.env.FRONTEND_URL || "https://fullstackadnan.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight request for 10 minutes
}));
// Add a debug middleware to log requests
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log("Headers:", req.headers);
    next();
});
// Routes
app.use("/api", routes_1.default);
// Error handling
app.use(error_1.notFoundHandler);
app.use(error_1.errorHandler);
exports.default = app;
