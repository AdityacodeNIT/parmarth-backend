import { Router } from "express";
import express from "express";
import {
  checkout,
  paymentVerification,
  transactionVerification,
} from "./payment.controller.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { razorpayWebhook } from "./razorpay.webhook.js";
const paymentRouter = Router();

paymentRouter.route("/paid").post(verifyJWT,checkout);

paymentRouter.route("/paymentcallback").post(verifyJWT,paymentVerification);
paymentRouter.route("/razorpay").post(express.raw({ type: "application/json" }),razorpayWebhook); // razorpayWebhook

paymentRouter.route("/paymentVerification").post(transactionVerification);
export default paymentRouter;
