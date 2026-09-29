// public/js/vehicles.js
renderNav('vehicles');

let currentVehicles = [];
let selectedVehicle = null;

async function loadVehicles() {
    const grid = document.getElementById('vehicle-grid');
    const category = document.getElementById('category-filter').value;
    try {
        const query = category ? `?category=${encodeURIComponent(category)}` : '';
        currentVehicles = await apiFetch('/vehicles' + query);
        renderVehicles();
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

function openBookingModal(vehicleId) {
    if (!getUser()) {
        window.location.href = 'index.html#login';
        return;
    }
    selectedVehicle = currentVehicles.find(v => v.id === vehicleId);
    document.getElementById('booking-vehicle-name').textContent = `Book ${selectedVehicle.make} ${selectedVehicle.model}`;
    document.getElementById('booking-start').value = '';
    document.getElementById('booking-end').value = '';
    document.getElementById('booking-estimate').textContent = '';
    document.getElementById('booking-error').classList.add('hidden');
    document.getElementById('booking-modal').classList.remove('hidden');
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
    try {
        await apiFetch('/bookings', {
            method: 'POST',
            body: JSON.stringify({
                vehicle_id: selectedVehicle.id,
                start_date: document.getElementById('booking-start').value,
                end_date: document.getElementById('booking-end').value
            })
        });
        closeModal();
        window.location.href = 'my-bookings.html';
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

loadVehicles();
