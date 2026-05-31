// This file handles storing and retrieving saved race configurations.

var path = require("path");
var fs = require("fs");
var Database = require("better-sqlite3");

// Define where the database file will live

var DATA_DIR = path.join(__dirname, "..", "..", "data");
var DB_FILE = path.join(DATA_DIR, "savedConfigs.db");

// Make sure the data directory exists before using it

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Keep a single database connection open

var dbConnection = null;

function getDatabase() {

  if (dbConnection) {
    return dbConnection;
  }

  ensureDirectoryExists();

  // Open database
  dbConnection = new Database(DB_FILE);

  // Enable Write-Ahead Logging mode
  dbConnection.pragma("journal_mode = WAL");

  // Create table if it does not already exist
  dbConnection.exec(
    "CREATE TABLE IF NOT EXISTS saved_configs (" +
      "name TEXT PRIMARY KEY," +
      "data TEXT NOT NULL," +
      "created_at INTEGER NOT NULL" +
    ");"
  );

  return dbConnection;
}

//   Save a configuration

function saveConfig(name, config) {

  // Basic name validation
  if (!name || typeof name !== "string" || !name.trim()) {
    var invalidError = new Error("Invalid name");
    invalidError.code = "EINVAL";
    throw invalidError;
  }

  var trimmedName = name.trim();

  // Make sure config exists
  var safeConfig = config;
  if (!safeConfig) {
    safeConfig = {};
  }

  var configJSON = JSON.stringify(safeConfig);
  var timestamp = Date.now();

  var database = getDatabase();

  try {

    var statement = database.prepare(
      "INSERT INTO saved_configs (name, data, created_at) VALUES (?, ?, ?)"
    );

    statement.run(trimmedName, configJSON, timestamp);

    return {
      name: trimmedName,
      timestamp: timestamp
    };

  } catch (error) {

    // Handle duplicate name
    if (error && error.message && error.message.indexOf("UNIQUE") !== -1) {
      var duplicateError = new Error("Name already exists");
      duplicateError.code = "EEXIST";
      throw duplicateError;
    }

    throw error;
  }
}

//   List saved configurations

function listConfigs() {

  var database = getDatabase();

  var rows = database
    .prepare("SELECT name, created_at FROM saved_configs ORDER BY created_at DESC")
    .all();

  var results = [];

  for (var i = 0; i < rows.length; i++) {

    var row = rows[i];

    var timestampValue = 0;

    if (row.created_at && !isNaN(Number(row.created_at))) {
      timestampValue = Number(row.created_at);
    }

    results.push({
      name: row.name,
      timestamp: timestampValue
    });
  }

  return results;
}

//   Get full configuration by name

function getConfig(name) {

  var database = getDatabase();

  var row = database
    .prepare("SELECT name, data, created_at FROM saved_configs WHERE name = ?")
    .get(name);

  if (!row) {
    return null;
  }

  var parsedConfig = {};

  try {
    parsedConfig = JSON.parse(row.data);
  } catch (parseError) {
    console.error("Failed to parse config JSON:", parseError);
    parsedConfig = {};
  }

  return {
    name: row.name,
    timestamp: row.created_at,
    config: parsedConfig
  };
}

//   Delete a configuration

function deleteConfig(name) {

  var database = getDatabase();

  var info = database
    .prepare("DELETE FROM saved_configs WHERE name = ?")
    .run(name);

  if (info.changes > 0) {
    return true;
  }

  return false;
}


module.exports = {
  saveConfig: saveConfig,
  listConfigs: listConfigs,
  getConfig: getConfig,
  deleteConfig: deleteConfig
};