import express from "express";
import {
  createPayment,
  handleWebhook,
  getPayment,
  getAllPayments,
} from "../controllers/payment";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../types";
import { RequestHandler } from "express";

const router = express.Router();

// Public webhook route (no authentication required)
router.post("/webhook", handleWebhook as RequestHandler);

// Protected routes
router.use(authenticate as RequestHandler);

router.post("/", createPayment as RequestHandler);
router.get("/:id", getPayment as RequestHandler);

// Admin routes
router.get(
  "/admin/all",
  requireRole([Role.ADMIN]) as RequestHandler,
  getAllPayments as RequestHandler
);

export default router;
