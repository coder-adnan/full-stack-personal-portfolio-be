"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payment_1 = require("../controllers/payment");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// Protected routes
router.use(auth_1.authenticate);
router.post("/", payment_1.createPayment);
router.get("/", payment_1.getPayments);
router.get("/:id", payment_1.getPayment);
router.patch("/:id", payment_1.updatePayment);
// Admin only routes
router.get("/admin/all", (0, auth_1.requireRole)(client_1.Role.ADMIN), payment_1.getPayments);
exports.default = router;
