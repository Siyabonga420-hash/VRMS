import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/customers (staff/admin)
router.get('/', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, phone, role, created_at
       FROM users WHERE role='customer' ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/customers (staff/admin create)
router.post('/', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1,$2,$3,$4,'customer')
       RETURNING id, name, email, phone, role, created_at`,
      [name, email, hash, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/customers/:id
router.put('/:id', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const { rows } = await query(
      `UPDATE users SET name=$1, phone=$2 WHERE id=$3 AND role='customer'
       RETURNING id, name, email, phone, role`,
      [name, phone, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/customers/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    await query(`DELETE FROM users WHERE id=$1 AND role='customer'`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;