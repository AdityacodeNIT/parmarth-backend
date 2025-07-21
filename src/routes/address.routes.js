import { Router } from "express";

import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addAddress, getAddress, getAllAddresses } from "../controllers/address.controller.js";

const addressrouter = Router();

addressrouter.route("/addAddress").post(verifyJWT, addAddress);
addressrouter.route("/getAddress/:id").get(verifyJWT, getAddress);

addressrouter.route("/getAllAddresses").get(verifyJWT,getAllAddresses)

export default addressrouter;
