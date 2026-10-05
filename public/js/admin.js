// public/js/admin.js
const currentUser = requirePageAuth(['staff', 'admin']);
if (currentUser) renderNav('admin');

let allVehicles = [];

function showSection(name) {
    ['reports', 'vehicles', 'bookings', 'maintenance', 'broadcast'].forEach(s => {
        document.getElementById(`section-${s}`).classList.toggle('hidden', s !== name);
        document.getElementById(`tab-${s}`).classList.toggle('active', s === name);
    });
}

// ---------- REPORTS ----------
async function loadReport() {
    try {
        const report = await apiFetch('/reports/summary');
        const statGrid = document.getElementById('stat-grid');
        const bookingCounts = Object.fromEntries(report.bookings_by_status.map(r => [r.status, r.count]));
        statGrid.innerHTML = `
            <div class="stat-box"><div class="value">${formatCurrency(report.total_revenue)}</div><div class="label">Total Revenue</div></div>
            <div class="stat-box"><div class="value">${bookingCounts.pending || 0}</div><div class="label">Pending Bookings</div></div>
            <div class="stat-box"><div class="value">${bookingCounts.confirmed || 0}</div><div class="label">Confirmed Bookings</div></div>
            <div class="stat-box"><div class="value">${bookingCounts.completed || 0}</div><div class="label">Completed Rentals</div></div>
        `;
        document.getElementById('top-vehicles-body').innerHTML = report.top_vehicles.map(v => `
            <tr><td>${v.make} ${v.model}</td><td>${v.times_booked}</td></tr>
        `).join('') || '<tr><td colspan="2" class="muted">No bookings yet.</td></tr>';
    } catch (err) {
        document.getElementById('stat-grid').innerHTML = `<p class="error-msg">${err.message}</p>`;
    }
}

// ---------- VEHICLES ----------
async function loadVehiclesAdmin() {
    try {
        allVehicles = await apiFetch('/vehicles');
        document.getElementById('vehicles-body').innerHTML = allVehicles.map(v => `
            <tr>
                <td>${v.make} ${v.model} (${v.year})</td>
                <td>${v.plate_number}</td>
                <td>${formatCurrency(v.daily_rate)}</td>
                <td><span class="badge ${v.status}">${v.status}</span></td>
                <td><button class="btn small danger" onclick="deleteVehicle(${v.id})">Delete</button></td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No vehicles yet.</td></tr>';

        document.getElementById('m-vehicle-id').innerHTML = allVehicles.map(v =>
            `<option value="${v.id}">${v.make} ${v.model} (${v.plate_number})</option>`
        ).join('');
    } catch (err) {
        document.getElementById('vehicles-body').innerHTML = `<tr><td colspan="5" class="error-msg">${err.message}</td></tr>`;
    }
}

document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('vehicle-error');
    errorBox.classList.add('hidden');
    const rate = Number(document.getElementById('v-rate').value);
    const year = Number(document.getElementById('v-year').value);
    if (!(rate > 0)) {
        errorBox.textContent = 'Daily rate must be greater than R0.';
        errorBox.classList.remove('hidden');
        return;
    }
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
        errorBox.textContent = 'Please enter a valid year (1990 or later).';
        errorBox.classList.remove('hidden');
        return;
    }
    try {
        await apiFetch('/vehicles', {
            method: 'POST',
            body: JSON.stringify({
                make: document.getElementById('v-make').value,
                model: document.getElementById('v-model').value,
                year: Number(document.getElementById('v-year').value),
                plate_number: document.getElementById('v-plate').value,
                category: document.getElementById('v-category').value,
                daily_rate: Number(document.getElementById('v-rate').value),
                image_url: document.getElementById('v-image').value || null
            })
        });
        e.target.reset();
        loadVehiclesAdmin();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

async function deleteVehicle(id) {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return;
    try {
        await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
        loadVehiclesAdmin();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- BOOKINGS ----------
let adminBookings = [];
const DEPOSIT_TEXT = 'R1,000';

// escape text that came from customers before putting it in HTML
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pickupCell(b) {
    if (b.handed_over) return '<span class="badge active">Handed over</span>';
    if (b.status === 'confirmed') return `<button class="btn small" onclick="openHandover(${b.id})">Hand over car</button>`;
    if (b.status === 'pending') return '<span class="muted">Awaiting payment</span>';
    return '';
}

async function loadBookingsAdmin() {
    try {
        adminBookings = await apiFetch('/bookings');
        document.getElementById('admin-bookings-body').innerHTML = adminBookings.map(b => `
            <tr>
                <td>${esc(b.customer_name)}</td>
                <td>${b.make} ${b.model}</td>
                <td>${formatDate(b.start_date)} → ${formatDate(b.end_date)}</td>
                <td>${formatCurrency(b.total_amount)}</td>
                <td><span class="badge ${b.status}">${b.status}</span></td>
                <td>${pickupCell(b)}</td>
                <td>
                    <select onchange="updateBookingStatus(${b.id}, this.value)">
                        <option value="">Change...</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No bookings yet.</td></tr>';
    } catch (err) {
        document.getElementById('admin-bookings-body').innerHTML = `<tr><td colspan="7" class="error-msg">${err.message}</td></tr>`;
    }
}

// ---------- HAND-OVER CHECKLIST ----------
let handoverBooking = null;

function openHandover(id) {
    handoverBooking = adminBookings.find(b => b.id === id);
    if (!handoverBooking) return;
    const b = handoverBooking;
    document.getElementById('handover-summary').innerHTML = `
        <strong>${esc(b.customer_name)}</strong> collecting <strong>${b.make} ${b.model}</strong> (${esc(b.plate_number)})<br>
        ID / passport: ${esc(b.id_number || 'not provided')}<br>
        Licence no.: ${esc(b.licence_number || 'not provided')}, expires ${b.licence_expiry ? formatDate(b.licence_expiry) : 'unknown'}<br>
        Date of birth: ${b.date_of_birth ? formatDate(b.date_of_birth) : 'unknown'}<br>
        Rental ends: ${formatDate(b.end_date)}`;
    document.getElementById('handover-form').reset();
    document.getElementById('handover-error').classList.add('hidden');
    document.getElementById('handover-modal').classList.remove('hidden');
}

function closeHandover() {
    document.getElementById('handover-modal').classList.add('hidden');
}

document.getElementById('handover-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('handover-error');
    errorBox.classList.add('hidden');
    try {
        await apiFetch(`/bookings/${handoverBooking.id}/handover`, {
            method: 'POST',
            body: JSON.stringify({
                licence_checked: document.getElementById('h-licence').checked,
                id_checked: document.getElementById('h-id').checked,
                deposit_received: document.getElementById('h-deposit').checked,
                fuel_level: document.getElementById('h-fuel').value,
                mileage: Number(document.getElementById('h-mileage').value),
                damage_notes: document.getElementById('h-notes').value
            })
        });
        closeHandover();
        loadBookingsAdmin();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

// Show the condition recorded at pickup when staff record a return
document.getElementById('r-booking-id').addEventListener('change', async (e) => {
    const info = document.getElementById('r-handover-info');
    info.textContent = '';
    if (!e.target.value) return;
    try {
        const h = await apiFetch(`/bookings/${e.target.value}/handover`);
        info.textContent = `At pickup: fuel ${h.fuel_level}, ${h.mileage} km, notes: ${h.damage_notes || 'none'}.`;
    } catch (err) {
        info.textContent = err.message;
    }
});

async function updateBookingStatus(bookingId, status) {
    if (!status) return;
    try {
        await apiFetch(`/bookings/${bookingId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        loadBookingsAdmin();
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById('return-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('return-error');
    const successBox = document.getElementById('return-success');
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');
    try {
        await apiFetch('/returns', {
            method: 'POST',
            body: JSON.stringify({
                booking_id: Number(document.getElementById('r-booking-id').value),
                return_date: document.getElementById('r-date').value,
                condition_notes: document.getElementById('r-notes').value,
                late_fee: Number(document.getElementById('r-fee').value || 0)
            })
        });
        successBox.textContent = 'Return recorded.';
        successBox.classList.remove('hidden');
        e.target.reset();
        loadBookingsAdmin();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

// ---------- MAINTENANCE ----------
async function loadMaintenance() {
    try {
        const records = await apiFetch('/maintenance');
        document.getElementById('maintenance-body').innerHTML = records.map(m => `
            <tr>
                <td>${m.make} ${m.model} (${m.plate_number})</td>
                <td>${m.description}</td>
                <td>${formatDate(m.start_date)}</td>
                <td><span class="badge ${m.status === 'completed' ? 'completed' : 'maintenance'}">${m.status}</span></td>
                <td>${m.status !== 'completed'
                    ? `<button class="btn small" onclick="completeMaintenance(${m.id})">Mark Complete</button>`
                    : ''}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No maintenance records yet.</td></tr>';
    } catch (err) {
        document.getElementById('maintenance-body').innerHTML = `<tr><td colspan="5" class="error-msg">${err.message}</td></tr>`;
    }
}

document.getElementById('maintenance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('maintenance-error');
    errorBox.classList.add('hidden');
    try {
        await apiFetch('/maintenance', {
            method: 'POST',
            body: JSON.stringify({
                vehicle_id: Number(document.getElementById('m-vehicle-id').value),
                description: document.getElementById('m-description').value,
                start_date: document.getElementById('m-start').value,
                cost: Number(document.getElementById('m-cost').value || 0)
            })
        });
        e.target.reset();
        loadMaintenance();
        loadVehiclesAdmin();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

async function completeMaintenance(id) {
    try {
        await apiFetch(`/maintenance/${id}/complete`, { method: 'PUT' });
        loadMaintenance();
        loadVehiclesAdmin();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- BROADCAST ----------
document.getElementById('broadcast-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const successBox = document.getElementById('broadcast-success');
    const errorBox = document.getElementById('broadcast-error');
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');
    try {
        await apiFetch('/notifications/broadcast', {
            method: 'POST',
            body: JSON.stringify({ message: document.getElementById('b-message').value })
        });
        successBox.textContent = 'Announcement sent to all customers.';
        successBox.classList.remove('hidden');
        e.target.reset();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

if (currentUser) {
    loadReport();
    loadVehiclesAdmin();
    loadBookingsAdmin();
    loadMaintenance();
}