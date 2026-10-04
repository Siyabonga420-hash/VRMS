// public/js/api.js
// Every page includes this before its own script. It centralizes:
// - attaching the saved login token to every request
// - reading the logged-in user from localStorage
// - a couple of shared helpers (currency, dates, nav rendering)

const API_BASE = '/api'; // same origin -- backend and frontend are one Render service

function getToken() {
    return localStorage.getItem('vrms_token');
}

function getUser() {
    const raw = localStorage.getItem('vrms_user');
    return raw ? JSON.parse(raw) : null;
}

function saveSession(token, user) {
    localStorage.setItem('vrms_token', token);
    localStorage.setItem('vrms_user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('vrms_token');
    localStorage.removeItem('vrms_user');
}

// Wraps fetch(): adds the auth header, parses JSON, and turns a
// non-2xx response into a thrown Error with the server's message.
async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(API_BASE + path, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
    }
    return data;
}

function formatCurrency(amount) {
    return 'R' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
}

// Renders the top nav differently depending on whether someone is
// logged in, and what role they have. Called once at the top of
// every page's own script.
function renderNav(activePage) {
    const user = getUser();
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    let links = `<a href="index.html">Home</a><a href="vehicles.html">Browse Vehicles</a>`;
    if (user) {
        links += `<a href="my-bookings.html">My Bookings</a>`;
        if (user.role === 'staff' || user.role === 'admin') {
            links += `<a href="admin.html">Admin Panel</a>`;
        }
        links += `<span class="nav-user">Hi, ${user.full_name.split(' ')[0]}</span>`;
        links += `<button onclick="logout()">Log out</button>`;
    } else {
        links += `<a href="index.html#login">Log in / Register</a>`;
    }

    nav.innerHTML = `
        <a class="brand" href="index.html">🚗 Pace Car Rental</a>
        <div class="links">${links}</div>`;
}

function logout() {
    clearSession();
    window.location.href = 'index.html';
}

// If a page requires login (or a specific role) and the check fails,
// bounce back to the homepage instead of showing a broken page.
function requirePageAuth(allowedRoles = null) {
    const user = getUser();
    if (!user) {
        window.location.href = 'index.html#login';
        return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        alert('You do not have access to that page.');
        window.location.href = 'index.html';
        return null;
    }
    return user;
}