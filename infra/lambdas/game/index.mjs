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

export const handler = async () => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, url, coord_x, coord_y FROM photos WHERE status = 'Approved' ORDER BY RAND()"
    );

    if (!rows.length) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No approved photos found" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photos: rows.map((p) => ({
          id: p.id,
          url: p.url,
          coord: { x: p.coord_x, y: p.coord_y },
        })),
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
