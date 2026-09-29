// routes/reports.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/summary  (admin only)
// A handful of aggregate queries for the admin dashboard.
router.get('/summary', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const [revenue, bookingCounts, vehicleCounts, topVehicles] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(amount),0) AS total_revenue FROM payments WHERE status = 'paid'`),
            pool.query(`SELECT status, COUNT(*)::int AS count FROM bookings GROUP BY status`),
            pool.query(`SELECT status, COUNT(*)::int AS count FROM vehicles GROUP BY status`),
            pool.query(`
                SELECT v.make, v.model, COUNT(b.id)::int AS times_booked
                FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
                GROUP BY v.id, v.make, v.model
                ORDER BY times_booked DESC LIMIT 5`)
        ]);

        res.json({
            total_revenue: revenue.rows[0].total_revenue,
            bookings_by_status: bookingCounts.rows,
            vehicles_by_status: vehicleCounts.rows,
            top_vehicles: topVehicles.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not build report.' });
    }
});

module.exports = router;
