"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePaymentConfirmationEmail = exports.generateAppointmentConfirmationEmail = exports.sendWelcomeEmail = exports.generateWelcomeEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendEmail = async (config) => {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            ...config,
        });
    }
    catch (error) {
        console.error("Failed to send email:", error);
        throw new Error("Failed to send email");
    }
};
exports.sendEmail = sendEmail;
const generateWelcomeEmail = (email, name) => ({
    to: email,
    subject: "Welcome to Our Platform!",
    html: `
    <h1>Welcome to Our Platform!</h1>
    <p>Dear ${name},</p>
    <p>Thank you for registering with us. We're excited to have you on board!</p>
    <p>You can now:</p>
    <ul>
      <li>Schedule appointments</li>
      <li>Manage your profile</li>
      <li>View your appointment history</li>
    </ul>
    <p>If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>Adnan Ahmad</p>
  `,
});
exports.generateWelcomeEmail = generateWelcomeEmail;
const sendWelcomeEmail = async (email, name) => {
    try {
        await (0, exports.sendEmail)((0, exports.generateWelcomeEmail)(email, name));
    }
    catch (error) {
        // Log the error but don't throw it - we don't want to block registration if email fails
        console.error("Failed to send welcome email:", error);
    }
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const generateAppointmentConfirmationEmail = (email, name, appointmentDate, appointmentTime, topic) => ({
    to: email,
    subject: "Appointment Confirmation",
    html: `
    <h1>Appointment Confirmed!</h1>
    <p>Dear ${name},</p>
    <p>Your appointment has been confirmed with the following details:</p>
    <ul>
      <li>Date: ${appointmentDate.toLocaleDateString()}</li>
      <li>Time: ${appointmentTime}</li>
      <li>Topic: ${topic}</li>
    </ul>
    <p>We look forward to meeting with you!</p>
    <p>Best regards,<br>Your Appointment System</p>
  `,
});
exports.generateAppointmentConfirmationEmail = generateAppointmentConfirmationEmail;
const generatePaymentConfirmationEmail = (email, name, amount, appointmentDate, appointmentTime) => ({
    to: email,
    subject: "Payment Confirmation",
    html: `
    <h1>Payment Confirmed!</h1>
    <p>Dear ${name},</p>
    <p>Your payment of $${amount.toFixed(2)} has been confirmed for your appointment on:</p>
    <ul>
      <li>Date: ${appointmentDate.toLocaleDateString()}</li>
      <li>Time: ${appointmentTime}</li>
    </ul>
    <p>Thank you for your payment!</p>
    <p>Best regards,<br>Your Appointment System</p>
  `,
});
exports.generatePaymentConfirmationEmail = generatePaymentConfirmationEmail;
