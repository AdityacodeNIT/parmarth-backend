import { Router } from "express";
import {
  checkout,
  paymentVerification,
  transactionVerification,
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const paymentRouter = Router();

paymentRouter.route("/paid").post(verifyJWT,checkout);

paymentRouter.route("/paymentcallback").post(verifyJWT,paymentVerification);

paymentRouter.route("/paymentVerification").post(transactionVerification);
export default paymentRouter;
