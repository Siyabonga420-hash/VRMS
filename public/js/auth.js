// public/js/auth.js  (used by login.html)
renderNav();

// Where to go after logging in / registering:
// - if they clicked "Book Now" before logging in, go back to the cars
//   (the booking window reopens automatically)
// - staff/admin go to the admin panel, everyone else to the car list
function afterLoginUrl(user) {
    if (sessionStorage.getItem('vrms_pending_vehicle')) return 'index.html';
    return user.role === 'customer' ? 'index.html' : 'admin.html';
}

// Already logged in? No need to see the form.
if (getUser()) {
    window.location.href = afterLoginUrl(getUser());
}

function showTab(which) {
    document.getElementById('tab-login').classList.toggle('active', which === 'login');
    document.getElementById('tab-register').classList.toggle('active', which === 'register');
    document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
}

if (window.location.hash === '#register') showTab('register');

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('login-error');
    errorBox.classList.add('hidden');
    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            })
        });
        saveSession(data.token, data.user);
        window.location.href = afterLoginUrl(data.user);
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('register-error');
    errorBox.classList.add('hidden');
    try {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                full_name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                phone: document.getElementById('reg-phone').value,
                password: document.getElementById('reg-password').value
            })
        });
        saveSession(data.token, data.user);
        window.location.href = 'index.html';
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});