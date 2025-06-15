import express from "express";
import {
  createPayment,
  getPayments,
  getPayment,
  updatePayment,
} from "../controllers/payment";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";
import { RequestHandler } from "express";

const router = express.Router();

// Protected routes
router.use(authenticate as RequestHandler);

router.post("/", createPayment as RequestHandler);
router.get("/", getPayments as RequestHandler);
router.get("/:id", getPayment as RequestHandler);
router.patch("/:id", updatePayment as RequestHandler);

// Admin only routes
router.get(
  "/admin/all",
  requireRole(Role.ADMIN) as RequestHandler,
  getPayments as RequestHandler
);

export default router;
