import {Router} from "express"

import { getUserAddress } from "../controllers/address.controller.js";

const addressrouter=Router();

addressrouter.route("/getAddress").post(
    getUserAddress
    
    )

export default addressrouter;