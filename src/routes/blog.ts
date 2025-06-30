import express from "express";
import {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadImage,
  getBlogPostById,
} from "../controllers/blog";
import { authenticate } from "../middleware/auth";
import { RequestHandler } from "express";

const router = express.Router();

// Public routes
router.get("/", getBlogPosts as RequestHandler);
router.get("/:slug", getBlogPost as RequestHandler);
router.get("/id/:id", getBlogPostById as RequestHandler);

// Protected routes (require authentication)
router.post(
  "/",
  authenticate as RequestHandler,
  createBlogPost as RequestHandler
);
router.put(
  "/:id",
  authenticate as RequestHandler,
  updateBlogPost as RequestHandler
);
router.delete(
  "/:id",
  authenticate as RequestHandler,
  deleteBlogPost as RequestHandler
);

// Image upload route
router.post(
  "/upload-image",
  authenticate as RequestHandler,
  uploadImage as RequestHandler
);

export default router;
