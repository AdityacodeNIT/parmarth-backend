import { Router } from "express";

import {
        addToWishlist,
        retrieveWishlisted,
       removeWishlistedItem,
} from "../controllers/wishlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const WishListRouter = Router();

WishListRouter.route("/").post(verifyJWT,addToWishlist);

WishListRouter.route("/").get(verifyJWT,retrieveWishlisted);

WishListRouter.route("/:productId").delete(verifyJWT,removeWishlistedItem);

export default WishListRouter;
