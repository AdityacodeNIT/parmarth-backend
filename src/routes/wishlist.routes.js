import { Router } from "express";

import {
        wishlistedItems,
        retrieveWishlisted,
        removeWishlistedItem,
} from "../controllers/wishlist.controller.js";

const WishListRouter = Router();

WishListRouter.route("/addWishlist").post(wishlistedItems);

WishListRouter.route("/Wishlists/:userId").get(retrieveWishlisted);

WishListRouter.route("/removeWishlistItem").delete(removeWishlistedItem);

export default WishListRouter;
