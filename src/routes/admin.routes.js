import { Router } from "express";

import {
        orderlist,
        userlist,
        productList,
} from "../controllers/admin.controllers.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";

import { checkadmin } from "../middlewares/checkadmin.middleware.js";

const adminRouter = Router();

adminRouter.route("/getOrderList").get(verifyJWT, checkadmin, orderlist);
adminRouter.route("/getUserList").get(verifyJWT, checkadmin, userlist);
adminRouter.route("/getProductList").get(verifyJWT, checkadmin, productList);

export default adminRouter;
