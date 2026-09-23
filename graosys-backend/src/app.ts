import "reflect-metadata";
import "express-async-errors";
import express from "express";
import cors from "cors";
import routes from "./app/routes";
import { errorMiddleware } from "./app/middlewares/errorMiddleware";
import { AppDataSource, initializeDataSource } from "./database/data-source";

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
  // Sem FRONTEND_URL configurado (dev), reflete a origem da requisição sem
  // credentials — nunca usamos "*" combinado com credentials: true.
  origin: allowedOrigin || true,
  credentials: Boolean(allowedOrigin),
}));
app.use(express.json());

// Em serverless o entrypoint pode ser este arquivo (sem passar por server.ts
// ou api/index.ts), então garantimos a conexão antes de tratar a requisição.
let dbReady: Promise<unknown> | null = null;
app.use(async (_req, _res, next) => {
  if (!AppDataSource.isInitialized) {
    dbReady = dbReady || initializeDataSource(3, 1000).catch((err) => {
      dbReady = null;
      throw err;
    });
    await dbReady;
  }
  next();
});
app.use(routes);
app.use(errorMiddleware);

export default app;
