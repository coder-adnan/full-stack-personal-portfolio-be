import { Router, Request, Response } from "express";
import authRoutes from "./auth";
import appointmentRoutes from "./appointment";
import paymentRoutes from "./payment";
import blogRoutes from "./blog";
import adminRoutes from "./admin";
import commentRoutes from "./comment";

const router = Router();

// Health check
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Routes
router.use("/auth", authRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/blog", blogRoutes);
router.use("/admin", adminRoutes);
router.use("/comments", commentRoutes);

export default router;
