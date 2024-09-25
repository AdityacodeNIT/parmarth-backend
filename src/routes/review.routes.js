import { Router } from "express";

import {
  review,
  averageReview,
  setAverageReview,
} from "../controllers/review.controllers.js";

const Reviewrouter = Router();

Reviewrouter.route("/review").post(review);
Reviewrouter.route("/average").post(averageReview);
Reviewrouter.route("/setAverage").post(setAverageReview);

export default Reviewrouter;
