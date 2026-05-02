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

export const handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const excludeIds = qs.exclude
      ? qs.exclude.split(",").map(Number).filter(Boolean)
      : [];

    const [photoRows] = excludeIds.length
      ? await pool.execute(
          `SELECT * FROM photos WHERE status = 'Approved' AND id NOT IN (${excludeIds.map(() => "?").join(",")}) ORDER BY RAND() LIMIT 1`,
          excludeIds
        )
      : await pool.execute(
          "SELECT * FROM photos WHERE status = 'Approved' ORDER BY RAND() LIMIT 1"
        );

    if (!photoRows[0]) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No photos found" }),
      };
    }

    const [countRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM photos WHERE status = 'Approved'"
    );

    const photo = photoRows[0];
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: photo.id,
        url: photo.url,
        coord: { x: photo.coord_x, y: photo.coord_y },
        total: Number(countRows[0].count),
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
