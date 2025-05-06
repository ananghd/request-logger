require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3030;

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT
} = process.env;

let pool;

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    port: DB_PORT
  });

  // Create database if not exists
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.end();

  // Connect to the new database
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT
  });

  // Create 'requests' table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      method VARCHAR(10),
      url TEXT,
      headers TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create 'app_log' table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message TEXT,
      stack TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// All requests
app.all('*', async (req, res) => {
  try {
    const { method, url, headers } = req;
    const headersJSON = JSON.stringify(headers);

    await pool.query(
      'INSERT INTO requests (method, url, headers) VALUES (?, ?, ?)',
      [method, url, headersJSON]
    );

    res.json({
      status: 'success',
      method,
      url,
      headers
    });
  } catch (err) {
    console.error('❌ Error caught in route:', err);

    // Save to app_log table
    try {
      await pool.query(
        'INSERT INTO app_log (message, stack) VALUES (?, ?)',
        [err.message, err.stack]
      );
    } catch (logErr) {
      console.error('❌ Failed to log error to app_log table:', logErr);
    }

    res.status(500).json({ status: 'error', message: err.message });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize DB', err);
    process.exit(1);
  });