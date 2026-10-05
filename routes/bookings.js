// routes/bookings.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const MIN_AGE = 21;             // minimum driver age on the first day of the rental
const DEPOSIT_AMOUNT = 1000;    // refundable deposit (R), recorded by staff at pickup
const FUEL_LEVELS = ['full', '3/4', '1/2', '1/4', 'empty'];

// Age in whole years on a given date. Both arguments are 'YYYY-MM-DD' strings.
function ageOn(dobStr, onStr) {
    const d = new Date(dobStr), o = new Date(onStr);
    let age = o.getUTCFullYear() - d.getUTCFullYear();
    const m = o.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && o.getUTCDate() < d.getUTCDate())) age--;
    return age;
}

// Is this vehicle free for the requested date range?
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
    const { vehicle_id, start_date, end_date, terms_accepted } = req.body;
    if (!vehicle_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'vehicle_id, start_date and end_date are required.' });
    }
    if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({ error: 'End date must be after start date.' });
    }
    if (terms_accepted !== true) {
        return res.status(400).json({ error: 'You must accept the rental terms to book.' });
    }

    try {
        // ---- Driver requirements ----
        const driverResult = await pool.query(
            `SELECT to_char(date_of_birth, 'YYYY-MM-DD')  AS dob,
                    id_number, licence_number,
                    to_char(licence_expiry, 'YYYY-MM-DD') AS licence_expiry
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        const driver = driverResult.rows[0];
        if (!driver || !driver.dob || !driver.id_number || !driver.licence_number || !driver.licence_expiry) {
            return res.status(400).json({
                error: "Please complete your driver details (date of birth, ID/passport number, licence number and expiry) before booking."
            });
        }
        if (ageOn(driver.dob, start_date) < MIN_AGE) {
            return res.status(400).json({ error: `Drivers must be at least ${MIN_AGE} years old to rent a vehicle.` });
        }
        if (driver.licence_expiry < end_date) {
            return res.status(400).json({ error: 'Your driver\'s licence expires before the end of this rental. Please use a valid licence.' });
        }

        // ---- Vehicle checks ----
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
            `INSERT INTO bookings (customer_id, vehicle_id, start_date, end_date, total_amount, status, terms_accepted)
             VALUES ($1,$2,$3,$4,$5,'pending',TRUE) RETURNING *`,
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
// Customers see only their own bookings. Staff/admin see everyone's,
// including the driver details they need to verify at hand-over.
router.get('/', requireAuth, async (req, res) => {
    try {
        let sql = `
            SELECT b.*, v.make, v.model, v.plate_number,
                   u.full_name AS customer_name, u.phone AS customer_phone,
                   u.id_number, u.licence_number,
                   to_char(u.licence_expiry, 'YYYY-MM-DD') AS licence_expiry,
                   to_char(u.date_of_birth,  'YYYY-MM-DD') AS date_of_birth,
                   (h.id IS NOT NULL) AS handed_over
            FROM bookings b
            JOIN vehicles v ON v.id = b.vehicle_id
            JOIN users u ON u.id = b.customer_id
            LEFT JOIN vehicle_handovers h ON h.booking_id = b.id`;
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

// POST /api/bookings/:id/handover  (staff/admin: give the customer the car)
// Every requirement must be ticked, and only then does the booking become "active".
router.post('/:id/handover', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { licence_checked, id_checked, deposit_received, fuel_level, mileage, damage_notes } = req.body;

    if (licence_checked !== true || id_checked !== true || deposit_received !== true) {
        return res.status(400).json({
            error: 'The car cannot be handed over until the licence is verified, the ID is verified and the deposit is received.'
        });
    }
    if (!FUEL_LEVELS.includes(fuel_level)) {
        return res.status(400).json({ error: `Fuel level must be one of: ${FUEL_LEVELS.join(', ')}.` });
    }
    const km = Number(mileage);
    if (!Number.isInteger(km) || km < 0) {
        return res.status(400).json({ error: 'Mileage must be a whole number, 0 or more.' });
    }

    const client = await pool.connect();
    try {
        const bookingResult = await client.query(
            `SELECT b.*, to_char(u.licence_expiry, 'YYYY-MM-DD') AS licence_expiry,
                    to_char(b.end_date, 'YYYY-MM-DD') AS end_str
             FROM bookings b JOIN users u ON u.id = b.customer_id WHERE b.id = $1`,
            [req.params.id]
        );
        const booking = bookingResult.rows[0];
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });
        if (booking.status !== 'confirmed') {
            return res.status(409).json({
                error: booking.status === 'pending'
                    ? 'This booking has not been paid for yet.'
                    : `Booking is "${booking.status}", only confirmed bookings can be handed over.`
            });
        }
        if (!booking.licence_expiry || booking.licence_expiry < booking.end_str) {
            return res.status(400).json({ error: "The customer's licence expires before the end of the rental." });
        }

        await client.query('BEGIN');
        await client.query(
            `INSERT INTO vehicle_handovers
               (booking_id, staff_id, licence_checked, id_checked, deposit_received, deposit_amount, fuel_level, mileage, damage_notes)
             VALUES ($1,$2,TRUE,TRUE,TRUE,$3,$4,$5,$6)`,
            [booking.id, req.user.id, DEPOSIT_AMOUNT, fuel_level, km, (damage_notes || '').trim() || null]
        );
        const updated = await client.query(
            "UPDATE bookings SET status = 'active' WHERE id = $1 RETURNING *", [booking.id]
        );
        await client.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'booking')`,
            [booking.customer_id, `Your vehicle for booking #${booking.id} has been handed over. Drive safely and return it on time!`]
        );
        await client.query('COMMIT');
        res.status(201).json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This booking has already been handed over.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Could not record the hand-over.' });
    } finally {
        client.release();
    }
});

// GET /api/bookings/:id/handover  (staff/admin, or the booking's own customer)
router.get('/:id/handover', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT h.*, b.customer_id FROM vehicle_handovers h
             JOIN bookings b ON b.id = h.booking_id WHERE h.booking_id = $1`,
            [req.params.id]
        );
        const row = result.rows[0];
        if (!row) return res.status(404).json({ error: 'No hand-over has been recorded for this booking.' });
        if (req.user.role === 'customer' && row.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'That is not your booking.' });
        }
        res.json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load the hand-over record.' });
    }
});

// PUT /api/bookings/:id/status  (staff/admin: confirm, cancel, complete...)
// "active" is only reachable through the hand-over checklist above.
router.put('/:id/status', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    try {
        if (status === 'active') {
            const handed = await pool.query('SELECT 1 FROM vehicle_handovers WHERE booking_id = $1', [req.params.id]);
            if (handed.rows.length === 0) {
                return res.status(400).json({
                    error: 'Use "Hand over car" to activate a booking. The licence, ID and deposit checks must be completed first.'
                });
            }
        }
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