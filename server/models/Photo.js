import pool from "../db.js";

export async function getRandomPhoto(excludeIds = []) {
  const ids = excludeIds.filter(Boolean);
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT * FROM photos WHERE status = 'Approved' AND id NOT IN (${placeholders}) ORDER BY RAND() LIMIT 1`,
      ids
    );
    return rows[0] || null;
  }
  const [rows] = await pool.execute(
    "SELECT * FROM photos WHERE status = 'Approved' ORDER BY RAND() LIMIT 1"
  );
  return rows[0] || null;
}

export async function getApprovedPhotoCount() {
  const [[{ count }]] = await pool.execute(
    "SELECT COUNT(*) as count FROM photos WHERE status = 'Approved'"
  );
  return Number(count);
}

export async function getAllPhotos() {
  const [rows] = await pool.execute(
    "SELECT * FROM photos ORDER BY created_at DESC"
  );
  return rows;
}

export async function updatePhotoStatus(id, status) {
  await pool.execute("UPDATE photos SET status = ? WHERE id = ?", [status, id]);
}

export async function updatePhotoCoords(id, x, y) {
  await pool.execute("UPDATE photos SET coord_x = ?, coord_y = ? WHERE id = ?", [x, y, id]);
}

export async function createPhoto({ url, coord, diff, locationN, photographer, status = "Pending" }) {
  const [result] = await pool.execute(
    "INSERT INTO photos (url, coord_x, coord_y, diff, location_name, photographer, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [url, coord.x, coord.y, diff || null, locationN || null, photographer || null, status]
  );
  return {
    id: result.insertId,
    url,
    coord,
    diff,
    locationN,
    photographer,
    status,
  };
}
