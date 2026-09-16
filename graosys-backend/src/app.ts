import "reflect-metadata";
import "express-async-errors";
import express from "express";
import cors from "cors";
import routes from "./app/routes";
import { errorMiddleware } from "./app/middlewares/errorMiddleware";

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
  // Sem FRONTEND_URL configurado (dev), reflete a origem da requisição sem
  // credentials — nunca usamos "*" combinado com credentials: true.
  origin: allowedOrigin || true,
  credentials: Boolean(allowedOrigin),
}));
app.use(express.json());
app.use(routes);
app.use(errorMiddleware);

export default app;
