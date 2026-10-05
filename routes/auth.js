// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateIdentity } = require('../utils/idCheck');

const router = express.Router();

// POST /api/auth/register
// Anyone can register as a "customer". Staff/admin accounts are created
// manually in the database -- we don't let the public sign up as staff.
router.post('/register', async (req, res) => {
    const { full_name, email, password, phone } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Full name, email and password are required.' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, phone, role)
             VALUES ($1, $2, $3, $4, 'customer')
             RETURNING id, full_name, email, role`,
            [full_name, email, password_hash, phone || null]
        );

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        // Same error for "no such user" and "wrong password".
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ---------- Driver details (needed before a car can be booked) ----------

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));

// GET /api/auth/profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, phone,
                    to_char(date_of_birth, 'YYYY-MM-DD')  AS date_of_birth,
                    id_number, licence_number,
                    to_char(licence_expiry, 'YYYY-MM-DD') AS licence_expiry
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        res.json(result.rows[0] || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load your profile.' });
    }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
    const { date_of_birth, id_number, licence_number, licence_expiry } = req.body;
    const idNo = String(id_number || '').replace(/\s+/g, '').toUpperCase();
    const licNo = String(licence_number || '').trim();

    if (!isDate(date_of_birth) || new Date(date_of_birth) >= new Date()) {
        return res.status(400).json({ error: 'Please enter a valid date of birth.' });
    }
    if (idNo.length < 5 || idNo.length > 30) {
        return res.status(400).json({ error: 'ID / passport number must be 5 to 30 characters.' });
    }
    const idProblem = validateIdentity(idNo, date_of_birth);
    if (idProblem) {
        return res.status(400).json({ error: idProblem });
    }
    if (licNo.length < 5 || licNo.length > 30) {
        return res.status(400).json({ error: "Driver's licence number must be 5 to 30 characters." });
    }
    if (!isDate(licence_expiry)) {
        return res.status(400).json({ error: 'Please enter a valid licence expiry date.' });
    }

    try {
        await pool.query(
            `UPDATE users SET date_of_birth = $1, id_number = $2, licence_number = $3, licence_expiry = $4
             WHERE id = $5`,
            [date_of_birth, idNo, licNo, licence_expiry, req.user.id]
        );
        res.json({ message: 'Driver details saved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not save your details.' });
    }
});

// GET /api/auth/customers  (staff/admin only)
// All customers with the driver details they submitted when booking.
router.get('/customers', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.phone,
                    to_char(u.date_of_birth,  'YYYY-MM-DD') AS date_of_birth,
                    u.id_number, u.licence_number,
                    to_char(u.licence_expiry, 'YYYY-MM-DD') AS licence_expiry,
                    to_char(u.created_at,     'YYYY-MM-DD') AS joined,
                    COUNT(b.id)::int AS bookings
             FROM users u
             LEFT JOIN bookings b ON b.customer_id = u.id
             WHERE u.role = 'customer'
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load customers.' });
    }
});

module.exports = router;