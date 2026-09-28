document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const rollNo = document.getElementById('rollNo').value.trim();
  const email = document.getElementById('email').value.trim();
  const department = document.getElementById('department').value;
  const year = parseInt(document.getElementById('year').value);
  const college = document.getElementById('college').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  const signupBtn = document.getElementById('signupBtn');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert('Please use a valid original email address.');
    return;
  }

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    showAlert('Please enter a valid 10-digit mobile number.');
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating Account...';

  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rollNo, email, department, year, college, phone, password })
    });

    const data = await response.json();

    if (response.ok || response.status === 201) {
      showAlert(data.message || 'Account created successfully! Redirecting to Sign In...', 'success');
      document.getElementById('signupForm').reset();

      setTimeout(() => {
        window.location.href = 'signin.html';
      }, 1500);
    } else {
      showAlert(data.message || 'Registration failed. Check inputs.');
      signupBtn.disabled = false;
      signupBtn.textContent = 'Sign Up';
    }
  } catch (err) {
    console.error('Signup Error:', err);
    showAlert('Network error. Check your server connection.');
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
});
