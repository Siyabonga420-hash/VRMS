// routes/payments.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/payments
// A customer pays for their own pending booking. This is a simulated
// payment (no real card processor wired in) -- it just records the
// payment and moves the booking to "confirmed". Swap this out for a
// real gateway (Stripe/PayFast/etc.) later without changing the rest
// of the app.
router.post('/', requireAuth, async (req, res) => {
    const { booking_id, method } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id is required.' });

    try {
        const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
        const booking = bookingResult.rows[0];
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });

        if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'That is not your booking.' });
        }
        if (booking.status !== 'pending') {
            return res.status(409).json({ error: `Booking is already "${booking.status}".` });
        }

        const payment = await pool.query(
            `INSERT INTO payments (booking_id, amount, method, status)
             VALUES ($1,$2,$3,'paid') RETURNING *`,
            [booking_id, booking.total_amount, method || 'card']
        );

        await pool.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1", [booking_id]);
        await pool.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'payment')`,
            [booking.customer_id, `Payment of R${booking.total_amount} received for booking #${booking_id}. Your booking is confirmed.`]
        );

        res.status(201).json(payment.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Payment could not be processed.' });
    }
});

// GET /api/payments  (staff/admin: all payments; customer: their own)
router.get('/', requireAuth, async (req, res) => {
    try {
        let sql = `
            SELECT p.*, b.customer_id FROM payments p
            JOIN bookings b ON b.id = p.booking_id`;
        const params = [];
        if (req.user.role === 'customer') {
            sql += ' WHERE b.customer_id = $1';
            params.push(req.user.id);
        }
        sql += ' ORDER BY p.paid_at DESC';
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load payments.' });
    }
});

module.exports = router;
