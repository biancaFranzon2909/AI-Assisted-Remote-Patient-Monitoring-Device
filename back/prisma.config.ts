import { defineConfig, env} from "prisma/config";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"], override: false});

export default defineConfig({
  schema: "./src/schema_db",
  migrations: {
    path: "./src/schema_db/migrations",
    seed: "tsx ./mockup/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
