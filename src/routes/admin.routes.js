import { Router } from "express";

import {
        orderlist,
        userlist,
        productList,
} from "../controllers/admin.controllers.js";

const adminRouter = Router();

adminRouter.route("/getOrderList").get(orderlist);
adminRouter.route("/getUserList").get(userlist);
adminRouter.route("/getProductList").get(productList);

export default adminRouter;
