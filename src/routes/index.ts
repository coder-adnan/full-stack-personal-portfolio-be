import express from "express";
import authRoutes from "./auth";
import appointmentRoutes from "./appointment";
import paymentRoutes from "./payment";
import blogRoutes from "./blog";
import adminRoutes from "./admin";
import commentRoutes from "./comment";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
router.use("/auth", authRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/blog", blogRoutes);
router.use("/admin", adminRoutes);
router.use("/comments", commentRoutes);

export default router;
