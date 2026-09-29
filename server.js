// server.js
// Entry point. Serves the frontend (public/) AND the API (/api/...)
// from a single Express app -- this is why Render only needs one
// Web Service for the whole project.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const returnRoutes = require('./routes/returns');
const maintenanceRoutes = require('./routes/maintenance');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json());

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// --- Frontend (static files) ---
app.use(express.static(path.join(__dirname, 'public')));

// Any route that isn't /api/... and isn't a real file falls back to
// index.html, so refreshing the browser on e.g. /vehicles.html still works.
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found.' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`VRMS server running on port ${PORT}`);
});
