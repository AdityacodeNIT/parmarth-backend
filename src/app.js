import express from "express";
import cors from cors
import cookieParser from cookieParser

const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    Credential:true
}));

app.use(express.json({limit:"20kb"}))

app.use(express.urlencoded({limit:"20kb"}))

app.use(express.static("public"))

app.use(express.cookieParser())

export { app };
