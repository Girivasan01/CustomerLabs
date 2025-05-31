const Database = require('better-sqlite3');
const db = new Database('./db.sqlite');

// Create Accounts Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    account_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    website TEXT,
    secret_token TEXT NOT NULL
  )
`).run();

// Create Destinations Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    headers TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
  )
`).run();

module.exports = db;
