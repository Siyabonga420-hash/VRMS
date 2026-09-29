// public/js/auth.js
renderNav();

// If someone who's already logged in lands here, send them straight
// to a useful page instead of showing the login form again.
if (getUser()) {
    window.location.href = getUser().role === 'customer' ? 'vehicles.html' : 'admin.html';
}

function showTab(which) {
    document.getElementById('tab-login').classList.toggle('active', which === 'login');
    document.getElementById('tab-register').classList.toggle('active', which === 'register');
    document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
}

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
        window.location.href = data.user.role === 'customer' ? 'vehicles.html' : 'admin.html';
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
        window.location.href = 'vehicles.html';
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
});

// If the page loaded with #login-... or the register tab was requested
// via the nav link's #login hash, nothing extra is needed -- the form
// is already visible by default.
