"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const admin_1 = require("../controllers/admin");
const router = express_1.default.Router();
// All routes require authentication and admin role
router.use(auth_1.authenticate, admin_1.isAdmin);
// Get all blog posts (admin view)
router.get("/blog-posts", admin_1.getAllBlogPosts);
// Review a blog post
router.patch("/blog-posts/:id/review", admin_1.reviewBlogPost);
// Update a blog post (admin)
router.put("/blog-posts/:id", admin_1.updateBlogPost);
// Delete a blog post (admin)
router.delete("/blog-posts/:id", admin_1.deleteBlogPost);
exports.default = router;
