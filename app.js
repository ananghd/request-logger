require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3030;

app.use(bodyParser.json());

// Setup MySQL connection
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

  // Create DB if not exists
  connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
    if (err) {
      console.error('Error creating database:', err);
      return;
    }

    // Switch to the DB
    connection.changeUser({ database: dbName }, (err) => {
      if (err) {
        console.error('Error changing database:', err);
        return;
      }

      console.log(`Using database: ${dbName}`);

      // Create 'requests' table
      const requestTable = `
        CREATE TABLE IF NOT EXISTS requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          method VARCHAR(10),
          path TEXT,
          body TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create 'app_log' table
      const logTable = `
        CREATE TABLE IF NOT EXISTS app_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.query(requestTable);
      connection.query(logTable);

      // Start the server after DB setup
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });
    });
  });
});

// Middleware to log all requests
app.use((req, res, next) => {
  const { method, path, body } = req;
  const insertQuery = 'INSERT INTO requests (method, path, body) VALUES (?, ?, ?)';
  connection.query(insertQuery, [method, path, JSON.stringify(body)], err => {
    if (err) {
      const errorLog = 'INSERT INTO app_log (message) VALUES (?)';
      connection.query(errorLog, [err.message || 'Unknown error']);
      console.error('Error saving request:', err);
    } else {
      console.log(`[${method}] ${path} - ${JSON.stringify(body)}`);
    }
  });
  next();
});

// Catch-all route
app.all('*', (req, res) => {
  res.json({
    success: true,
    method: req.method,
    path: req.path,
    body: req.body,
  });
});