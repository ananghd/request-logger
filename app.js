require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3030;

app.use(bodyParser.json());

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
};

const dbName = process.env.DB_NAME;
const connection = mysql.createConnection(dbConfig);

connection.connect(err => {
  if (err) {
    console.error('MySQL connection failed:', err);
    return;
  }

  console.log('Connected to MySQL.');

  connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
    if (err) return console.error('Error creating database:', err);

    connection.changeUser({ database: dbName }, (err) => {
      if (err) return console.error('Error selecting database:', err);

      console.log(`Using database: ${dbName}`);

      const createRequests = `
        CREATE TABLE IF NOT EXISTS requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          method VARCHAR(10),
          path TEXT,
          url TEXT,
          body TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX (createdAt),
          INDEX (method(5))
        )
      `;

      const createAppLog = `
        CREATE TABLE IF NOT EXISTS app_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX (createdAt)
        )
      `;

      connection.query(createRequests);
      connection.query(createAppLog);

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    });
  });
});

// Middleware to capture and log request
app.use((req, res, next) => {
  const { method, path, originalUrl, body } = req;
  const logQuery = 'INSERT INTO requests (method, path, url, body) VALUES (?, ?, ?, ?)';

  connection.query(logQuery, [method, path, originalUrl, JSON.stringify(body)], err => {
    if (err) {
      const errorLog = 'INSERT INTO app_log (message) VALUES (?)';
      connection.query(errorLog, [err.message || 'Unknown error']);
      console.error('Failed to log request:', err);
    } else {
      console.log(`[${method}] ${originalUrl} - ${JSON.stringify(body)}`);
    }
  });

  next();
});

// General handler
app.all('*', (req, res) => {
  res.json({
    success: true,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    body: req.body,
  });
});
