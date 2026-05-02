import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 1,
  idleTimeout: 60000,
});

// AWS_REGION is injected automatically by the Lambda runtime
const s3 = new S3Client({});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { filename, contentType, difficulty, locationName, x, y, photographer } = body;

    if (!filename || !contentType || x == null || y == null) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const bucket = process.env.AWS_BUCKET;
    const region = process.env.AWS_REGION;
    const ext = path.extname(filename) || ".jpg";
    const key = `photos/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    const [result] = await pool.execute(
      "INSERT INTO photos (url, coord_x, coord_y, diff, location_name, photographer, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [publicUrl, Number(x), Number(y), difficulty || null, locationName || null, photographer || "anonymous", "Pending"]
    );

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadUrl,
        photo: {
          id: result.insertId,
          url: publicUrl,
          coord: { x: Number(x), y: Number(y) },
          diff: difficulty || null,
          locationN: locationName || null,
          photographer: photographer || "anonymous",
          status: "Pending",
        },
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Upload failed" }),
    };
  }
};
