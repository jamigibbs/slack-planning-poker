const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const routes = require('./routes');

// Load env vars if not already loaded
if (!process.env.PORT) {
  dotenv.config();
}

// Initialize Express app
const app = express();

// Express middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Mount all routes
app.use('/', routes);

module.exports = app;
