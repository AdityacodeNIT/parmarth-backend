import { Router } from "express";

import { addReview, averageReview, getReview } from "../controllers/review.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const Reviewrouter = Router();

Reviewrouter.route("/addreview").post(verifyJWT,addReview);

// Add JWT verification middleware to the addReview route

Reviewrouter.route("/average").post(averageReview);
Reviewrouter.route("/getReview/:id").get(getReview);

export default Reviewrouter;
