// routes/notifications.js
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications  (the logged-in user's own notifications)
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load notifications.' });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update notification.' });
    }
});

// POST /api/notifications/broadcast  (admin: send a message to every customer)
router.post('/broadcast', requireAuth, requireRole('admin'), async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required.' });
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, message, type)
             SELECT id, $1, 'announcement' FROM users WHERE role = 'customer'`,
            [message]
        );
        res.status(201).json({ message: 'Broadcast sent.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not send broadcast.' });
    }
});

module.exports = router;
