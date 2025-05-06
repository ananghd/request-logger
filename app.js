// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const app = express();

// Setup body parser for parsing JSON request bodies
app.use(bodyParser.json());

// MySQL Database Connection
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Create database and tables if they don't exist
const createDatabaseAndTables = async () => {
  pool.query(
    `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`,
    (err, result) => {
      if (err) {
        console.error('Error creating database:', err);
        return;
      }
      console.log('Database created or exists');
    }
  );

  pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      method VARCHAR(10),
      url TEXT,
      path TEXT,
      headers JSON,
      body JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err, result) => {
    if (err) {
      console.error('Error creating requests table:', err);
      return;
    }
    console.log('Requests table created or exists');
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS app_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      error TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err, result) => {
    if (err) {
      console.error('Error creating app_log table:', err);
      return;
    }
    console.log('App log table created or exists');
  });
};

createDatabaseAndTables();

// Handle all incoming requests
app.all('*', async (req, res) => {
  try {
    const { method, url, headers, body, path } = req;

    // Log request to console
    console.log(`[${new Date().toISOString()}] ${method} ${url}`);
    console.log('Headers:', headers);
    console.log('Body:', body);

    // Save to database
    await pool.query(
      `INSERT INTO requests (method, url, path, headers, body) VALUES (?, ?, ?, ?, ?)`,
      [method, url, path, JSON.stringify(headers), JSON.stringify(body)]
    );

    res.json({
      success: true,
      method,
      url,
      path,
      headers,
      body
    });
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.query(
      `INSERT INTO app_log (error) VALUES (?)`,
      [err.toString()]
    );
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Set port and start server
const port = process.env.PORT || 3030;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
