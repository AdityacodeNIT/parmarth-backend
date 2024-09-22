import { Router } from "express";
import {
  checkout,
  paymentCallback,
} from "../controllers/payment.controller.js";
const paymentRouter = Router();

paymentRouter.route("/paid").post(checkout);

paymentRouter.route("/paymentcallback").post(paymentCallback);
export default paymentRouter;
