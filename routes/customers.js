const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone, role, created_at FROM users WHERE role='customer' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, phone, role) VALUES ($1,$2,$3,$4,'customer') RETURNING id, name, email, phone, role, created_at",
      [name, email, hash, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { name, phone } = req.body;
    const { rows } = await pool.query(
      "UPDATE users SET name=$1, phone=$2 WHERE id=$3 AND role='customer' RETURNING id, name, email, phone, role",
      [name, phone, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1 AND role='customer'", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
