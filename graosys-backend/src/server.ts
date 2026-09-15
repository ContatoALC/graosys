import dotenv from "dotenv";
import app from "./app";
import { initializeDataSource } from "./database/data-source";

dotenv.config();

const PORT = process.env.PORT || 3333;

async function bootstrap() {
  await initializeDataSource();
  app.listen(PORT, () => {
    console.log(`🌾 GraoSys Backend rodando na porta ${PORT}`);
  });
}

bootstrap();
