"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const appointment_1 = __importDefault(require("./appointment"));
const payment_1 = __importDefault(require("./payment"));
const blog_1 = __importDefault(require("./blog"));
const admin_1 = __importDefault(require("./admin"));
const comment_1 = __importDefault(require("./comment"));
const router = (0, express_1.Router)();
// Health check
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Routes
router.use("/auth", auth_1.default);
router.use("/appointments", appointment_1.default);
router.use("/payments", payment_1.default);
router.use("/blog", blog_1.default);
router.use("/admin", admin_1.default);
router.use("/comments", comment_1.default);
exports.default = router;
