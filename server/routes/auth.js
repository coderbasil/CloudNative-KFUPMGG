import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByEmail, createUser } from "../models/User.js";

const router = Router();

const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });
    if (!password) return res.status(400).json({ message: "Password is required" });
    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters long" });

    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({ username: email, email, password: hashedPassword });
    res.status(201).json({ message: "User created successfully", role: user.type });
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });
    if (!password) return res.status(400).json({ message: "Password is required" });
    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters long" });

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, type: user.type },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ message: "Login successful", role: user.type, token });
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
