// routes/vehicles.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/vehicles - Get all vehicles (optionally filtered by category)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM vehicles';
        const params = [];

        if (category) {
            query += ' WHERE category = $1';
            params.push(category);
        }

        query += ' ORDER BY id DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching vehicles:', err);
        res.status(500).json({ error: 'Server error fetching vehicles' });
    }
});

// GET /api/vehicles/:id - Get a single vehicle
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching vehicle:', err);
        res.status(500).json({ error: 'Server error fetching vehicle' });
    }
});

// POST /api/vehicles - Add a new vehicle (Admin/Staff only)
router.post('/', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { make, model, year, category, daily_rate, image_url } = req.body;
        
        const result = await pool.query(
            `INSERT INTO vehicles (make, model, year, category, daily_rate, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [make, model, year, category, daily_rate, image_url]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding vehicle:', err);
        res.status(500).json({ error: 'Server error adding vehicle' });
    }
});

// PUT /api/vehicles/:id - Update a vehicle (Admin/Staff only)
router.put('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { make, model, year, category, daily_rate, image_url } = req.body;
        
        const result = await pool.query(
            `UPDATE vehicles 
             SET make = $1, model = $2, year = $3, category = $4, daily_rate = $5, image_url = $6 
             WHERE id = $7 RETURNING *`,
            [make, model, year, category, daily_rate, image_url, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating vehicle:', err);
        res.status(500).json({ error: 'Server error updating vehicle' });
    }
});

// DELETE /api/vehicles/:id - Delete a vehicle (Admin/Staff only)
router.delete('/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        res.json({ message: 'Vehicle deleted successfully' });
    } catch (err) {
        console.error('Error deleting vehicle:', err);
        res.status(500).json({ error: 'Server error deleting vehicle' });
    }
});

module.exports = router;