import express from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  createAppointment,
  getAppointments,
  getAppointment,
  cancelAppointment,
  getAllAppointments,
  getAvailableSlots,
} from "../controllers/appointment";
import { Role } from "../types";
import { RequestHandler } from "express";

const router = express.Router();

// Public routes
router.get("/slots", getAvailableSlots as RequestHandler);

// Protected routes
router.use(authenticate as RequestHandler);
router.post("/", createAppointment as RequestHandler);
router.get("/", getAppointments as RequestHandler);
router.get("/:id", getAppointment as RequestHandler);
router.post("/:id/cancel", cancelAppointment as RequestHandler);

// Admin routes
router.get(
  "/admin/all",
  requireRole([Role.ADMIN]) as RequestHandler,
  getAllAppointments as RequestHandler
);

export default router;
