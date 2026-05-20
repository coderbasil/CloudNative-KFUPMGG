import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 1,
  idleTimeout: 60000,
});

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function handleGameRandom() {
  const [rows] = await pool.execute(
    "SELECT id, url, coord_x, coord_y FROM photos WHERE status = 'Approved' ORDER BY RAND()"
  );
  if (!rows.length) return json(404, { error: "No approved photos found" });
  return json(200, {
    photos: rows.map((p) => ({
      id: p.id,
      url: p.url,
      coord: { x: p.coord_x, y: p.coord_y },
    })),
  });
}

async function handleLeaderboardGet() {
  const [rows] = await pool.execute(
    "SELECT player_name, score, rounds, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10"
  );
  return json(200, rows);
}

async function handleLeaderboardPost(event) {
  const body = JSON.parse(event.body || "{}");
  const name = String(body.player_name || "").trim().slice(0, 30);
  if (!name) return json(400, { error: "player_name required" });
  const score = Number(body.score);
  const rounds = Number(body.rounds);
  if (!Number.isFinite(score) || score < 0 || score > 500)
    return json(400, { error: "Invalid score" });
  await pool.execute(
    "INSERT INTO leaderboard (player_name, score, rounds) VALUES (?, ?, ?)",
    [name, Math.round(score), Math.round(rounds)]
  );
  return json(201, { message: "Score saved" });
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "";
  const path = event.rawPath ?? "";
  try {
    if (path === "/api/game/random" && method === "GET") return await handleGameRandom();
    if (path === "/api/leaderboard" && method === "GET")  return await handleLeaderboardGet();
    if (path === "/api/leaderboard" && method === "POST") return await handleLeaderboardPost(event);
    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Server error" });
  }
};
