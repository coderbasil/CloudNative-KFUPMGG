import express from "express";
import multer from "multer";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPhoto } from "../models/Photo.js";

const router = express.Router();

const s3 = new S3Client({ region: process.env.AWS_REGION });

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

    const ext = path.extname(req.file.originalname) || ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const s3Key = `photos/${unique}${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }),
    );

    const publicUrl = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

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
