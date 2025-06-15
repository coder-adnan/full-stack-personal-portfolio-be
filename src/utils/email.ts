import nodemailer from "nodemailer";
import { EmailConfig } from "../types";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (config: EmailConfig): Promise<void> => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      ...config,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email");
  }
};

export const generateWelcomeEmail = (
  email: string,
  name: string
): EmailConfig => ({
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

export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    await sendEmail(generateWelcomeEmail(email, name));
  } catch (error) {
    // Log the error but don't throw it - we don't want to block registration if email fails
    console.error("Failed to send welcome email:", error);
  }
};

export const generateAppointmentConfirmationEmail = (
  email: string,
  name: string,
  appointmentDate: Date,
  appointmentTime: string,
  topic: string
): EmailConfig => ({
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

export const generatePaymentConfirmationEmail = (
  email: string,
  name: string,
  amount: number,
  appointmentDate: Date,
  appointmentTime: string
): EmailConfig => ({
  to: email,
  subject: "Payment Confirmation",
  html: `
    <h1>Payment Confirmed!</h1>
    <p>Dear ${name},</p>
    <p>Your payment of $${amount.toFixed(
      2
    )} has been confirmed for your appointment on:</p>
    <ul>
      <li>Date: ${appointmentDate.toLocaleDateString()}</li>
      <li>Time: ${appointmentTime}</li>
    </ul>
    <p>Thank you for your payment!</p>
    <p>Best regards,<br>Your Appointment System</p>
  `,
});
