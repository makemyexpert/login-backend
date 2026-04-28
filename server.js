require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ─── PostgreSQL Connection ────────────────────────────────────────────────────
const pool = new Pool({
  //connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ryhavslifuljjcsuuwxw:WOCyXo6mFtDBlSWv@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  host:     process.env.DB_HOST     || 'aws-0-ap-south-1.pooler.supabase.com',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'postgres',
  user:     process.env.DB_USER     || 'postgres.ryhavslifuljjcsuuwxw',
  password: process.env.DB_PASSWORD || 'WOCyXo6mFtDBlSWv',
  ssl: {
    rejectUnauthorized: false
  },
});

// ─── Setup: Create table & seed demo user ────────────────────────────────────
async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const existing = await pool.query(
    'SELECT 1 FROM users WHERE username = $1', ['admin']
  );
  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      ['admin', hash]
    );
    console.log('✅ Seeded demo user: admin / admin123');
  }
  console.log('✅ Database ready');
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    return res.json({
      success: true,
      message: 'Login successful!',
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Register Route (optional) ───────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );
    return res.json({ success: true, message: 'User registered.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Username already exists.' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
setup().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
