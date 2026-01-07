import { Router } from "express";
import { saveUserInteraction,getUserRecommendations } from "./Interaction.controllers.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";


const interactionRouter=Router();

interactionRouter.route("/record").post(verifyJWT,saveUserInteraction);

interactionRouter.route("/recommendations").get(verifyJWT,getUserRecommendations);


export default interactionRouter;