import { Router } from "express";
import pool from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT player_name, score, rounds, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { player_name, score, rounds } = req.body;
    const name = String(player_name || "").trim().slice(0, 30);
    if (!name) return res.status(400).json({ error: "player_name required" });
    const s = Number(score);
    const r = Number(rounds);
    if (!Number.isFinite(s) || s < 0 || s > 500)
      return res.status(400).json({ error: "Invalid score" });

    await pool.execute(
      "INSERT INTO leaderboard (player_name, score, rounds) VALUES (?, ?, ?)",
      [name, Math.round(s), Math.round(r)]
    );
    res.status(201).json({ message: "Score saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
