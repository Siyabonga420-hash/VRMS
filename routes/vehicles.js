// routes/vehicles.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/vehicles
// Public. Anyone browsing the site can see the fleet, even logged out.
// Optional ?category=sedan filter.
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const params = [];
        let sql = "SELECT * FROM vehicles WHERE status = 'available'";
        if (category) {
            params.push(category);
            sql += ` AND category = $${params.length}`;
        }
        sql += ' ORDER BY id';
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load vehicles.' });
    }
});

// GET /api/vehicles/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load vehicle.' });
    }
});

// POST /api/vehicles  (staff/admin only)
router.post('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { make, model, year, plate_number, category, daily_rate, image_url } = req.body;
    if (!make || !model || !year || !plate_number || !daily_rate) {
        return res.status(400).json({ error: 'make, model, year, plate_number and daily_rate are required.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO vehicles (make, model, year, plate_number, category, daily_rate, image_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [make, model, year, plate_number, category || 'sedan', daily_rate, image_url || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not add vehicle (is the plate number unique?).' });
    }
});

// PUT /api/vehicles/:id  (staff/admin only)
router.put('/:id', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { make, model, year, category, daily_rate, status, image_url } = req.body;
    try {
        const result = await pool.query(
            `UPDATE vehicles SET
                make = COALESCE($1, make),
                model = COALESCE($2, model),
                year = COALESCE($3, year),
                category = COALESCE($4, category),
                daily_rate = COALESCE($5, daily_rate),
                status = COALESCE($6, status),
                image_url = COALESCE($7, image_url)
             WHERE id = $8 RETURNING *`,
            [make, model, year, category, daily_rate, status, image_url, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update vehicle.' });
    }
});

// DELETE /api/vehicles/:id  (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await pool.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
        res.json({ message: 'Vehicle deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not delete vehicle (it may have existing bookings).' });
    }
});

module.exports = router;
