import dotenv from "dotenv";
import app from "../src/app";
import { AppDataSource, initializeDataSource } from "../src/database/data-source";

dotenv.config();

let dbReady: Promise<unknown> | null = null;

export default async function handler(req: any, res: any) {
  if (!AppDataSource.isInitialized) {
    dbReady = dbReady || initializeDataSource(3, 1000);
    await dbReady;
  }
  return (app as any)(req, res);
}
