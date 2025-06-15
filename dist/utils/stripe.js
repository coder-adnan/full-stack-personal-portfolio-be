"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPaymentIntent = exports.getPaymentIntent = exports.constructWebhookEvent = exports.createPaymentIntent = exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
exports.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16",
});
const createPaymentIntent = async ({ appointmentId, amount, currency = "USD", }) => {
    try {
        const paymentIntent = await exports.stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency,
            metadata: {
                appointmentId,
            },
        });
        return paymentIntent;
    }
    catch (error) {
        console.error("Failed to create payment intent:", error);
        throw new Error("Failed to create payment intent");
    }
};
exports.createPaymentIntent = createPaymentIntent;
const constructWebhookEvent = (payload, signature) => {
    try {
        return exports.stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
    }
    catch (error) {
        console.error("Failed to construct webhook event:", error);
        throw new Error("Failed to verify webhook signature");
    }
};
exports.constructWebhookEvent = constructWebhookEvent;
const getPaymentIntent = async (paymentIntentId) => {
    try {
        return await exports.stripe.paymentIntents.retrieve(paymentIntentId);
    }
    catch (error) {
        console.error("Failed to retrieve payment intent:", error);
        throw new Error("Failed to retrieve payment intent");
    }
};
exports.getPaymentIntent = getPaymentIntent;
const cancelPaymentIntent = async (paymentIntentId) => {
    try {
        return await exports.stripe.paymentIntents.cancel(paymentIntentId);
    }
    catch (error) {
        console.error("Failed to cancel payment intent:", error);
        throw new Error("Failed to cancel payment intent");
    }
};
exports.cancelPaymentIntent = cancelPaymentIntent;
