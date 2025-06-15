import Stripe from "stripe";
import { CreatePaymentInput } from "../types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export const createPaymentIntent = async ({
  appointmentId,
  amount,
  currency = "USD",
}: CreatePaymentInput): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        appointmentId,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Failed to create payment intent:", error);
    throw new Error("Failed to create payment intent");
  }
};

export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (error) {
    console.error("Failed to construct webhook event:", error);
    throw new Error("Failed to verify webhook signature");
  }
};

export const getPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error("Failed to retrieve payment intent:", error);
    throw new Error("Failed to retrieve payment intent");
  }
};

export const cancelPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  try {
    return await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    console.error("Failed to cancel payment intent:", error);
    throw new Error("Failed to cancel payment intent");
  }
};
