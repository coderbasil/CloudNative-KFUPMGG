import express from "express";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../middleware/auth.js";
import { findAllUsers, findUserById, findUserByEmailOrUsername, createUser, updateUser, deleteUser } from "../models/User.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    res.json(await findAllUsers());
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { username, email, password, type } = req.body;
    const existing = await findUserByEmailOrUsername(email, username);
    if (existing) {
      return res.status(400).json({ message: existing.email === email ? "Email already in use" : "Username already taken" });
    }
    const user = await createUser({ username, email, password: await bcrypt.hash(password, 10), type: type || "player" });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const user = await deleteUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
