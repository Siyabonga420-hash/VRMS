// routes/bookings.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Small helper: is this vehicle free for the requested date range?
// Two date ranges "overlap" unless one ends before the other starts.
async function isVehicleAvailable(vehicleId, startDate, endDate, excludeBookingId = null) {
    const params = [vehicleId, startDate, endDate];
    let sql = `
        SELECT COUNT(*)::int AS clashes FROM bookings
        WHERE vehicle_id = $1
          AND status IN ('pending','confirmed','active')
          AND start_date < $3
          AND end_date > $2`;
    if (excludeBookingId) {
        params.push(excludeBookingId);
        sql += ` AND id != $${params.length}`;
    }
    const result = await pool.query(sql, params);
    return result.rows[0].clashes === 0;
}

// POST /api/bookings  (logged-in customer creates a booking)
router.post('/', requireAuth, async (req, res) => {
    const { vehicle_id, start_date, end_date } = req.body;
    if (!vehicle_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'vehicle_id, start_date and end_date are required.' });
    }
    if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({ error: 'End date must be after start date.' });
    }

    try {
        const vehicleResult = await pool.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
        const vehicle = vehicleResult.rows[0];
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });
        if (vehicle.status !== 'available') {
            return res.status(409).json({ error: 'This vehicle is not currently available for booking.' });
        }

        const free = await isVehicleAvailable(vehicle_id, start_date, end_date);
        if (!free) {
            return res.status(409).json({ error: 'This vehicle is already booked for part of that date range.' });
        }

        const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
        const total_amount = (days * Number(vehicle.daily_rate)).toFixed(2);

        const result = await pool.query(
            `INSERT INTO bookings (customer_id, vehicle_id, start_date, end_date, total_amount, status)
             VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
            [req.user.id, vehicle_id, start_date, end_date, total_amount]
        );

        await pool.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'booking')`,
            [req.user.id, `Booking #${result.rows[0].id} created for ${vehicle.make} ${vehicle.model}. Total: R${total_amount}. Please complete payment to confirm.`]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not create booking.' });
    }
});

// GET /api/bookings
// Customers see only their own bookings. Staff/admin see everyone's.
router.get('/', requireAuth, async (req, res) => {
    try {
        let sql = `
            SELECT b.*, v.make, v.model, v.plate_number, u.full_name AS customer_name
            FROM bookings b
            JOIN vehicles v ON v.id = b.vehicle_id
            JOIN users u ON u.id = b.customer_id`;
        const params = [];
        if (req.user.role === 'customer') {
            sql += ' WHERE b.customer_id = $1';
            params.push(req.user.id);
        }
        sql += ' ORDER BY b.created_at DESC';
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load bookings.' });
    }
});

// PUT /api/bookings/:id/status  (staff/admin: confirm, activate, cancel, complete)
router.put('/:id/status', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    try {
        const result = await pool.query(
            'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

        const booking = result.rows[0];
        await pool.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'booking')`,
            [booking.customer_id, `Your booking #${booking.id} status changed to "${status}".`]
        );

        res.json(booking);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update booking status.' });
    }
});

module.exports = router;
