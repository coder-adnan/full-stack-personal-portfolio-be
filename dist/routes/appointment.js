"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const appointment_1 = require("../controllers/appointment");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// Protected routes
router.use(auth_1.authenticate);
router.post("/", appointment_1.createAppointment);
router.get("/", appointment_1.getAppointments);
router.get("/:id", appointment_1.getAppointment);
router.patch("/:id", appointment_1.updateAppointment);
router.delete("/:id", appointment_1.deleteAppointment);
router.post("/:id/cancel", appointment_1.cancelAppointment);
// Admin only routes
router.get("/admin/all", (0, auth_1.requireRole)(client_1.Role.ADMIN), appointment_1.getAppointments);
exports.default = router;
