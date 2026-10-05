// public/js/vehicles.js
renderNav('vehicles');

const MIN_AGE = 21;
let currentVehicles = [];
let selectedVehicle = null;

async function loadVehicles() {
    const grid = document.getElementById('vehicle-grid');
    const category = document.getElementById('category-filter').value;
    try {
        const query = category ? `?category=${encodeURIComponent(category)}` : '';
        currentVehicles = await apiFetch('/vehicles' + query);
        renderVehicles();
        resumePendingBooking();
    } catch (err) {
        grid.innerHTML = `<p class="error-msg">${err.message}</p>`;
    }
}

function renderVehicles() {
    const grid = document.getElementById('vehicle-grid');
    if (currentVehicles.length === 0) {
        grid.innerHTML = '<p class="muted">No vehicles match that filter right now.</p>';
        return;
    }
    grid.innerHTML = currentVehicles.map(v => `
        <div class="card vehicle-card">
            <img src="${v.image_url || 'https://via.placeholder.com/400x200?text=No+Image'}" alt="${v.make} ${v.model}">
            <span class="category">${v.category}</span>
            <h3>${v.make} ${v.model} (${v.year})</h3>
            <p class="price">${formatCurrency(v.daily_rate)} / day</p>
            <button class="btn" onclick="openBookingModal(${v.id})">Book Now</button>
        </div>
    `).join('');
}

async function openBookingModal(vehicleId) {
    if (!getUser()) {
        // remember which car they wanted, so we can reopen it after login
        sessionStorage.setItem('vrms_pending_vehicle', String(vehicleId));
        window.location.href = 'login.html';
        return;
    }
    selectedVehicle = currentVehicles.find(v => v.id === vehicleId);
    document.getElementById('booking-vehicle-name').textContent = `Book ${selectedVehicle.make} ${selectedVehicle.model}`;
    const today = new Date().toISOString().slice(0, 10);
    ['booking-start', 'booking-end'].forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.min = today;
    });
    document.getElementById('booking-terms').checked = false;
    document.getElementById('booking-estimate').textContent = '';
    document.getElementById('booking-error').classList.add('hidden');
    document.getElementById('booking-modal').classList.remove('hidden');

    // prefill driver details if we already have them on file
    try {
        const p = await apiFetch('/auth/profile');
        document.getElementById('d-dob').value = p.date_of_birth || '';
        document.getElementById('d-id').value = p.id_number || '';
        document.getElementById('d-licence').value = p.licence_number || '';
        document.getElementById('d-licence-expiry').value = p.licence_expiry || '';
    } catch (err) { /* leave blank; the customer can type them in */ }
}

// Age in whole years on a given date ('YYYY-MM-DD' strings)
function ageOn(dobStr, onStr) {
    const d = new Date(dobStr), o = new Date(onStr);
    let age = o.getUTCFullYear() - d.getUTCFullYear();
    const m = o.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && o.getUTCDate() < d.getUTCDate())) age--;
    return age;
}

// After login, reopen the booking window for the car the visitor clicked.
function resumePendingBooking() {
    const pending = sessionStorage.getItem('vrms_pending_vehicle');
    if (!pending || !getUser()) return;
    sessionStorage.removeItem('vrms_pending_vehicle');
    if (currentVehicles.some(c => c.id === Number(pending))) {
        openBookingModal(Number(pending));
    }
}

function closeModal() {
    document.getElementById('booking-modal').classList.add('hidden');
}

function updateEstimate() {
    const start = document.getElementById('booking-start').value;
    const end = document.getElementById('booking-end').value;
    const estimateBox = document.getElementById('booking-estimate');
    if (start && end && selectedVehicle) {
        const days = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
        if (days > 0) {
            estimateBox.textContent = `${days} day(s) × ${formatCurrency(selectedVehicle.daily_rate)} = ${formatCurrency(days * selectedVehicle.daily_rate)}`;
            return;
        }
    }
    estimateBox.textContent = '';
}

document.getElementById('booking-start').addEventListener('change', updateEstimate);
document.getElementById('booking-end').addEventListener('change', updateEstimate);
document.getElementById('category-filter').addEventListener('change', loadVehicles);

document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('booking-error');
    errorBox.classList.add('hidden');
    const fail = (msg) => { errorBox.textContent = msg; errorBox.classList.remove('hidden'); };

    const start = document.getElementById('booking-start').value;
    const end = document.getElementById('booking-end').value;
    const dob = document.getElementById('d-dob').value;
    const licenceExpiry = document.getElementById('d-licence-expiry').value;

    if (end <= start) return fail('End date must be after the start date.');
    if (ageOn(dob, start) < MIN_AGE) return fail(`Drivers must be at least ${MIN_AGE} years old to rent a vehicle.`);
    if (licenceExpiry < end) return fail("Your driver's licence expires before the end of this rental.");
    if (!document.getElementById('booking-terms').checked) return fail('Please accept the rental terms.');

    try {
        await apiFetch('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({
                date_of_birth: dob,
                id_number: document.getElementById('d-id').value,
                licence_number: document.getElementById('d-licence').value,
                licence_expiry: licenceExpiry
            })
        });
        await apiFetch('/bookings', {
            method: 'POST',
            body: JSON.stringify({
                vehicle_id: selectedVehicle.id,
                start_date: start,
                end_date: end,
                terms_accepted: true
            })
        });
        closeModal();
        window.location.href = 'my-bookings.html';
    } catch (err) {
        fail(err.message);
    }
});

loadVehicles();