import "reflect-metadata";
import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initializeDataSource } from "./database/data-source";
import routes from "./app/routes";
import { errorMiddleware } from "./app/middlewares/errorMiddleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(routes);
app.use(errorMiddleware);

async function bootstrap() {
  await initializeDataSource();
  app.listen(PORT, () => {
    console.log(`🌾 GraoSys Backend rodando na porta ${PORT}`);
  });
}

bootstrap();
