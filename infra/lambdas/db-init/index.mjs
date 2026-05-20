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
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        player_name VARCHAR(30)  NOT NULL,
        score       INT          NOT NULL,
        rounds      INT          NOT NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("leaderboard table ensured");

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "DB init complete" }),
    };
  } catch (err) {
    console.error("DB init failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
