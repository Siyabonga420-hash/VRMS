// routes/returns.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/returns  (staff/admin: record a vehicle coming back)
router.post('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { booking_id, return_date, condition_notes, late_fee } = req.body;
    if (!booking_id || !return_date) {
        return res.status(400).json({ error: 'booking_id and return_date are required.' });
    }

    try {
        const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
        const booking = bookingResult.rows[0];
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });

        const returnRecord = await pool.query(
            `INSERT INTO vehicle_returns (booking_id, return_date, condition_notes, late_fee)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [booking_id, return_date, condition_notes || null, late_fee || 0]
        );

        // Returning a vehicle closes out the booking; the vehicle itself
        // doesn't need a status change since availability is worked out
        // from booking date ranges, not a single "is it out" flag.
        await pool.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [booking_id]);

        await pool.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'return')`,
            [booking.customer_id, `Vehicle for booking #${booking_id} was returned on ${return_date}.` +
                (late_fee > 0 ? ` A late fee of R${late_fee} applies.` : '')]
        );

        res.status(201).json(returnRecord.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not record return.' });
    }
});

// GET /api/returns  (staff/admin)
router.get('/', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, b.customer_id, v.make, v.model
            FROM vehicle_returns r
            JOIN bookings b ON b.id = r.booking_id
            JOIN vehicles v ON v.id = b.vehicle_id
            ORDER BY r.created_at DESC`);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load returns.' });
    }
});

module.exports = router;
