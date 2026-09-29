// routes/maintenance.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/maintenance  (staff/admin)
router.get('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.*, v.make, v.model, v.plate_number
            FROM maintenance m
            JOIN vehicles v ON v.id = m.vehicle_id
            ORDER BY m.start_date DESC`);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load maintenance records.' });
    }
});

// POST /api/maintenance  (staff/admin: schedule maintenance)
// Marks the vehicle as "maintenance" so it stops showing up as bookable.
router.post('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { vehicle_id, description, start_date, end_date, cost } = req.body;
    if (!vehicle_id || !description || !start_date) {
        return res.status(400).json({ error: 'vehicle_id, description and start_date are required.' });
    }
    try {
        const record = await pool.query(
            `INSERT INTO maintenance (vehicle_id, description, start_date, end_date, cost, status)
             VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING *`,
            [vehicle_id, description, start_date, end_date || null, cost || 0]
        );
        await pool.query("UPDATE vehicles SET status = 'maintenance' WHERE id = $1", [vehicle_id]);
        res.status(201).json(record.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not schedule maintenance.' });
    }
});

// PUT /api/maintenance/:id/complete  (staff/admin)
// Marks maintenance done and puts the vehicle back into the available pool.
router.put('/:id/complete', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE maintenance SET status = 'completed', end_date = COALESCE(end_date, CURRENT_DATE)
             WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found.' });

        await pool.query("UPDATE vehicles SET status = 'available' WHERE id = $1", [result.rows[0].vehicle_id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not complete maintenance record.' });
    }
});

module.exports = router;
