import express from "express";
import { register, login, logout, getProfile } from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import { RequestHandler } from "express";

const router = express.Router();

// Public routes
router.post("/register", register as RequestHandler);
router.post("/login", login as RequestHandler);
router.post("/logout", logout as RequestHandler);

// Protected routes
router.get(
  "/profile",
  authenticate as RequestHandler,
  getProfile as RequestHandler
);

export default router;
