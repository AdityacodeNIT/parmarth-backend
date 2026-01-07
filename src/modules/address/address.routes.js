import { Router } from "express";

import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { addAddress, getAddress, getAllAddresses } from "./address.controller.js";

const addressrouter = Router();

addressrouter.route("/").post(verifyJWT, addAddress);
addressrouter.route("/").get(verifyJWT,getAllAddresses)

addressrouter.route("/getAddress/:id").get(verifyJWT, getAddress);



export default addressrouter;
