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
