import express from "express";
import { authenticate } from "../middleware/auth";
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
} from "../controllers/comment";

const router = express.Router();

// Public routes
router.get("/post/:postId", getComments);

// Protected routes
router.post("/post/:postId", authenticate, createComment);
router.put("/:commentId", authenticate, updateComment);
router.delete("/:commentId", authenticate, deleteComment);

export default router;
