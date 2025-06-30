import express from "express";
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
  cancelAppointment,
  getAvailableSlots,
} from "../controllers/appointment";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";
import { RequestHandler } from "express";

const router = express.Router();

// Protected routes
router.use(authenticate as RequestHandler);

router.post("/", createAppointment as RequestHandler);
router.get("/slots", getAvailableSlots as RequestHandler);
router.get("/", getAppointments as RequestHandler);
router.get("/:id", getAppointment as RequestHandler);
router.patch("/:id", updateAppointment as RequestHandler);
router.delete("/:id", deleteAppointment as RequestHandler);
router.post("/:id/cancel", cancelAppointment as RequestHandler);

// Admin only routes
router.get(
  "/admin/all",
  requireRole(Role.ADMIN) as RequestHandler,
  getAppointments as RequestHandler
);

export default router;
