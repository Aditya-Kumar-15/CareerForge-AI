// Function to explicitly clear login input fields
function clearSigninFields() {
  const identifier = document.getElementById('identifier');
  const password = document.getElementById('password');
  if (identifier) identifier.value = '';
  if (password) password.value = '';
}

// Clear immediately upon script execution
clearSigninFields();

// Clear on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  clearSigninFields();
  // Neutralize asynchronous browser autofill injections
  setTimeout(clearSigninFields, 50);
  setTimeout(clearSigninFields, 200);
  setTimeout(clearSigninFields, 500);
});

// Clear on page show (handles Back-Forward Cache navigation)
window.addEventListener('pageshow', () => {
  clearSigninFields();
  setTimeout(clearSigninFields, 100);
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const identifier = document.getElementById('identifier').value;
  const password = document.getElementById('password').value;

  const signinBtn = document.getElementById('signinBtn');
  signinBtn.disabled = true;
  signinBtn.textContent = 'Signing in...';

  try {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store JWT token and user profile in localStorage (NEVER store plain-text password)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showAlert('Login successful! Redirecting...', 'success');

      setTimeout(() => {
        redirectBasedOnRole(data.user);
      }, 1000);
    } else {
      showAlert(data.message || 'Login failed. Check credentials.');
      signinBtn.disabled = false;
      signinBtn.textContent = 'Sign In';
    }
  } catch (err) {
    console.error('Signin Error:', err);
    showAlert('Network error. Check your server connection.');
    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign In';
  }
});

const forgotLink = document.getElementById('forgotPasswordLink');
if (forgotLink) {
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showAlert('A password recovery email has been sent to your registered address (Mock System).', 'success');
  });
}
