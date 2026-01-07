import express from "express";

import userRoutes from "../modules/user/user.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import sellerRoutes from "../modules/seller/seller.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import wishlistRoutes from "../modules/wishlist/wishlist.routes.js";
import shiprouter from "../modules/shipRocket/shiprocket.routes.js";
import healthRoutes from "./infra/health.routes.js";
import addressRoutes from "../modules/address/address.routes.js";
import paymentRoutes from "../modules/payment/payment.routes.js";
import Reviewrouter from "../modules/review/review.routes.js";

import Subscriberouter from "../modules/Subscriber/subscriber.routes.js";


const router = express.Router();

/* API v1 */
router.use("/users", userRoutes);
router.use("/seller", sellerRoutes);
router.use("/products", productRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/address", addressRoutes);
router.use("/shiprocket", shiprouter);

/* API v2 */
router.use("/payment", paymentRoutes);
router.use("/review", Reviewrouter);
router.use("/subscribe", Subscriberouter);

/* Infra */
router.use("/", healthRoutes);

export default router;
