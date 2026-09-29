// db.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
});

if (process.argv[2] === 'init') {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  pool.query(sql)
    .then(() => {
      console.log('SUCCESS: Database schema initialized');
      return pool.end();
    })
    .catch((err) => {
      console.error('FAILED:', err.message);
      process.exit(1);
    });
} else {
  console.log('db.js loaded (no init flag)');
}

module.exports = pool;
