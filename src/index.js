//require("dotenv").config({ path: "./env" });
import dotenv from "dotenv";
import mongoose from "mongoose";

import express from "express";
import connectDB from "./db/index.js";
const app = express();
dotenv.config({
  path: "./env",
});
connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log("errr", error);
      throw error;
    });
    app.listen(process.env.PORT || 8000, () => {
      console.log(`0|Server is listeninig at port :${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGODB ERROR", err);
  });

/*
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/{DB_NAME}`);
    app.on("error", (error) => {
      console.log("ERR", error);
      throw error;
    });
    app.listen(process.env.PORT, () => {
      console.log(`App is listening on ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("Error", error);
  }
})();*/
