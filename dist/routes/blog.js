"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const blog_1 = require("../controllers/blog");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.get("/", blog_1.getBlogPosts);
router.get("/:slug", blog_1.getBlogPost);
// Protected routes (require authentication)
router.post("/", auth_1.authenticate, blog_1.createBlogPost);
router.put("/:id", auth_1.authenticate, blog_1.updateBlogPost);
router.delete("/:id", auth_1.authenticate, blog_1.deleteBlogPost);
exports.default = router;
