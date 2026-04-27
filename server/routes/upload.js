import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPhoto } from "../models/Photo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const router = express.Router();

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_BUCKET;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/photos", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No photo file received." });
    }

    const { difficulty, locationName, x, y, photographer } = req.body;

    if (x == null || y == null) {
      return res.status(400).json({ error: "Missing coordinates." });
    }

    if (!REGION || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
      return res
        .status(500)
        .json({ error: "Missing AWS S3 environment configuration." });
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const s3Key = `photos/${unique}${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }),
    );

    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;

    const photoDoc = await createPhoto({
      url: publicUrl,
      coord: { x: Number(x), y: Number(y) },
      diff: difficulty || null,
      locationN: locationName || null,
      photographer: photographer || "anonymous",
      status: "Pending",
    });

    res.status(201).json(photoDoc);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
