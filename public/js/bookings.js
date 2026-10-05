// public/js/bookings.js
const currentUser = requirePageAuth();
if (currentUser) renderNav('my-bookings');

async function loadBookings() {
    const body = document.getElementById('bookings-body');
    try {
        const bookings = await apiFetch('/bookings');
        if (bookings.length === 0) {
            body.innerHTML = `<tr><td colspan="5" class="muted">You have no bookings yet. <a href="vehicles.html">Browse vehicles</a>.</td></tr>`;
            return;
        }
        showPickupReminder(bookings);
        body.innerHTML = bookings.map(b => `
            <tr>
                <td>${b.make} ${b.model}</td>
                <td>${formatDate(b.start_date)} → ${formatDate(b.end_date)}</td>
                <td>${formatCurrency(b.total_amount)}</td>
                <td><span class="badge ${b.status}">${b.status}</span></td>
                <td>${b.status === 'pending'
                    ? `<button class="btn small" onclick="payForBooking(${b.id})">Pay Now</button>`
                    : ''}</td>
            </tr>
        `).join('');
    } catch (err) {
        body.innerHTML = `<tr><td colspan="5" class="error-msg">${err.message}</td></tr>`;
    }
}

// Reminder of what to bring when a confirmed booking is ready for collection.
function showPickupReminder(bookings) {
    const box = document.getElementById('pickup-box');
    const ready = bookings.filter(b => b.status === 'confirmed' && !b.handed_over);
    if (ready.length === 0) { box.classList.add('hidden'); return; }
    box.innerHTML = `
        <h2 style="margin-top:0;">Collecting your car</h2>
        <p>Your payment is confirmed. Please bring these to the branch on your start date:</p>
        <ul>
            <li>Your <strong>original driver's licence</strong> (must be valid until the end of your rental)</li>
            <li>Your <strong>ID or passport</strong></li>
            <li>A <strong>refundable deposit of R1,000</strong>, paid at collection</li>
        </ul>
        <p class="muted">Our staff will check the car's fuel, mileage and condition with you before handing over the keys.</p>`;
    box.classList.remove('hidden');
}

async function payForBooking(bookingId) {
    if (!confirm('Simulate payment for this booking now?')) return;
    try {
        await apiFetch('/payments', {
            method: 'POST',
            body: JSON.stringify({ booking_id: bookingId, method: 'card' })
        });
        alert('Payment successful! Your booking is confirmed.');
        loadBookings();
        loadNotifications();
    } catch (err) {
        alert(err.message);
    }
}

async function loadNotifications() {
    const box = document.getElementById('notifications-box');
    try {
        const notifications = await apiFetch('/notifications');
        if (notifications.length === 0) {
            box.innerHTML = '<p class="muted">No notifications yet.</p>';
            return;
        }
        box.innerHTML = notifications.map(n => `
            <div style="padding:10px 0; border-bottom:1px solid var(--border);">
                <div>${n.message}</div>
                <div class="muted" style="font-size:0.8rem;">${new Date(n.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (err) {
        box.innerHTML = `<p class="error-msg">${err.message}</p>`;
    }
}

if (currentUser) {
    loadBookings();
    loadNotifications();
}