import { Router } from "express";
import { createPhoto, getAllPhotos, updatePhotoStatus, updatePhotoCoords } from "../models/Photo.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const photos = await getAllPhotos();
    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status))
      return res.status(400).json({ error: "Invalid status" });

    await updatePhotoStatus(req.params.id, status);
    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/coords", async (req, res) => {
  try {
    const { x, y } = req.body;
    if (x == null || y == null) return res.status(400).json({ error: "x and y required" });
    await updatePhotoCoords(req.params.id, x, y);
    res.json({ message: "Coordinates updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { url, coord } = req.body;

    if (!url || !coord?.x || !coord?.y)
      return res.status(400).json({ error: "url and coord {x,y} required" });

    const doc = await createPhoto({ url, coord });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
