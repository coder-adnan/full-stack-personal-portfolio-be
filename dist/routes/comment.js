"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const comment_1 = require("../controllers/comment");
const router = express_1.default.Router();
// Public routes
router.get("/post/:postId", comment_1.getComments);
// Protected routes
router.post("/post/:postId", auth_1.authenticate, comment_1.createComment);
router.put("/:commentId", auth_1.authenticate, comment_1.updateComment);
router.delete("/:commentId", auth_1.authenticate, comment_1.deleteComment);
exports.default = router;
