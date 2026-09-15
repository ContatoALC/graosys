import "reflect-metadata";
import "express-async-errors";
import express from "express";
import cors from "cors";
import routes from "./app/routes";
import { errorMiddleware } from "./app/middlewares/errorMiddleware";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(routes);
app.use(errorMiddleware);

export default app;
