const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    try {
        await client.connect();
        console.log('Successfully connected to PostgreSQL');
        await client.end();
    } catch (err) {
        console.error('Failed to connect to PostgreSQL:', err.message);
        process.exit(1);
    }
}

testConnection();
