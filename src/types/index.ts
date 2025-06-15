import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type User = Awaited<ReturnType<typeof prisma.user.findUnique>>;
export type Appointment = Awaited<
  ReturnType<typeof prisma.appointment.findUnique>
>;
export type Payment = Awaited<ReturnType<typeof prisma.payment.findUnique>>;

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

export enum AppointmentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateAppointmentInput {
  date: Date;
  time: string;
  topic: string;
  company?: string;
  message?: string;
}

export interface CreatePaymentInput {
  appointmentId: string;
  amount: number;
  currency?: string;
}

export interface EmailConfig {
  to: string;
  subject: string;
  html: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      amount: number;
      currency: string;
      customer: string;
      payment_intent?: string;
    };
  };
}
