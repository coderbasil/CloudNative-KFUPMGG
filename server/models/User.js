import pool from "../db.js";

export async function findUserByEmail(email) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

export async function findUserByEmailOrUsername(email, username) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [email, username]
  );
  return rows[0] || null;
}

export async function findAllUsers() {
  const [rows] = await pool.execute(
    "SELECT id, username, email, type FROM users"
  );
  return rows;
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    "SELECT id, username, email, type FROM users WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

export async function createUser({ username, email, password, type = "player" }) {
  const [result] = await pool.execute(
    "INSERT INTO users (username, email, password, type) VALUES (?, ?, ?, ?)",
    [username, email, password, type]
  );
  return { id: result.insertId, username, email, type };
}

export async function updateUser(id, data) {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(data), id];
  await pool.execute(`UPDATE users SET ${fields} WHERE id = ?`, values);
  return findUserById(id);
}

export async function deleteUser(id) {
  const user = await findUserById(id);
  if (!user) return null;
  await pool.execute("DELETE FROM users WHERE id = ?", [id]);
  return user;
}
