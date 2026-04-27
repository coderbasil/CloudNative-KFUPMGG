import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import photos from "./routes/photos.js";
import upload from "./routes/upload.js";
import auth from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/api/photos", photos);
app.use("/api/upload", upload);
app.use("/api/auth", auth);

await pool.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    type ENUM('admin','player','photographer') NOT NULL DEFAULT 'player'
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

const server = app.listen(PORT, () =>
  console.log(`🚀 API listening at http://localhost:${PORT}`)
);

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
