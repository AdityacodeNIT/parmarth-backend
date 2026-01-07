import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { razorpay } from "../../utils/razorPay.js";
import crypto from "crypto";
import {Payment} from "./payment.model.js"

const checkout = asyncHandler(async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: amount * 100, // Razorpay uses paise
      currency: "INR",
    };

    const order = await razorpay.orders.create(options)
    ;

    // ✅ Save new payment entry
    await Payment.create({
      razorpayOrderId: order.id,
      amount,
      currency: "INR",
      status: "created",
      userId: req.user?._id,
     emailAtPayment:req.user?.email // optional, only if you're using auth
    });

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error(error);
    throw new ApiError(500, error, "Error in the payments section");
  }
});

const paymentVerification = asyncHandler(async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!(razorpay_order_id && razorpay_payment_id && razorpay_signature)) {
      throw new ApiError(400, "Missing payment verification fields");
    }

    const secret = process.env.RAZORPAY_API_SECRET;

    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).send("Invalid payment signature");
    }

    // ✅ Update payment status and save payment ID + signature
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "captured",
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error handling payment verification");
  }
});

const transactionVerification = asyncHandler(async (req, res) => {
  try {
    const orderId = req.body.payload?.payment?.entity?.order_id;
    const paymentId = req.body.payload?.payment?.entity?.id;

    if (!(orderId && paymentId)) {
      throw new ApiError(500, "Incomplete webhook data");
    }

    // ✅ Optionally update status here (for extra safety via webhook)
    await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      {
        razorpayPaymentId: paymentId,
        status: "captured",
      }
    );

    res.status(200).send("Webhook received successfully");
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error verifying transaction");
  }
});

export { checkout, paymentVerification, transactionVerification };
