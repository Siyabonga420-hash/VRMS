// db.js
// A single shared connection pool to the Neon Postgres database.
// Every route file imports this instead of creating its own connection.
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon requires SSL. rejectUnauthorized:false keeps this working
    // without needing to install Neon's CA certificate locally.
    ssl: { rejectUnauthorized: false }
});

module.exports = pool;
