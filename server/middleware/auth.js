import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.type !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
