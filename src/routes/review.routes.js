import { Router } from "express";

import { review, averageReview, getReview } from "../controllers/review.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const Reviewrouter = Router();

Reviewrouter.route("/review").post(review);
Reviewrouter.route("/average").post(averageReview);
Reviewrouter.route("/getReview").get(getReview);

export default Reviewrouter;
