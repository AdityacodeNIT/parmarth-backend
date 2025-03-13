import { Router } from "express";
import { saveUserInteraction } from "../controllers/Interaction.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const interactionRouter=Router();

interactionRouter.route("/record").post(verifyJWT,saveUserInteraction);


export default interactionRouter;