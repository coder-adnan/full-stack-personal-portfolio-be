"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.post("/register", auth_1.register);
router.post("/login", auth_1.login);
router.post("/logout", auth_1.logout);
// Protected routes
router.get("/profile", auth_2.authenticate, auth_1.getProfile);
exports.default = router;
