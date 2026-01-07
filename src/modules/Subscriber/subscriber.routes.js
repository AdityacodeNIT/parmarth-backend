import express from "express";
import { subscribeUser } from "./SubscriberController.js";


const Subscriberouter = express.Router();
Subscriberouter.post("/subscribe", subscribeUser);

export default Subscriberouter;
