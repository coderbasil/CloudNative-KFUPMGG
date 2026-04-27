import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";
import photos from "./routes/photos.js";
import upload from "./routes/upload.js";
import auth from "./routes/auth.js";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

const app = express();
const PORT = 5000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/photos", photos);
app.use("/api/upload", upload);
app.use("/api/auth", auth);

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });
  const dbName = process.env.DB_NAME || "kfupm_guess";
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.end();
}

async function initDb() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      type ENUM('admin', 'player', 'photographer') NOT NULL DEFAULT 'player'
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      url VARCHAR(2048) NOT NULL,
      coord_x FLOAT NOT NULL,
      coord_y FLOAT NOT NULL,
      diff VARCHAR(50),
      location_name VARCHAR(255),
      photographer VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

(async () => {
  try {
    await ensureDatabase();
    await initDb();
    console.log("✅ MySQL connected and tables ready");

    app.listen(PORT, () =>
      console.log(`🚀 API listening at http://localhost:${PORT}`),
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
// aaaaa
