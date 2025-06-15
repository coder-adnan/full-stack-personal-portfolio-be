import express from "express";
import { authenticate } from "../middleware/auth";
import {
  isAdmin,
  getAllBlogPosts,
  reviewBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "../controllers/admin";
import { RequestHandler } from "express";

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate as RequestHandler, isAdmin as RequestHandler);

// Get all blog posts (admin view)
router.get("/blog-posts", getAllBlogPosts as RequestHandler);

// Review a blog post
router.patch("/blog-posts/:id/review", reviewBlogPost as RequestHandler);

// Update a blog post (admin)
router.put("/blog-posts/:id", updateBlogPost as RequestHandler);

// Delete a blog post (admin)
router.delete("/blog-posts/:id", deleteBlogPost as RequestHandler);

export default router;
