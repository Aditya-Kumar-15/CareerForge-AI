const API_BASE_URL = 'http://localhost:5050/api';

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (!token || !user) {
    logout();
    return null;
  }
  return { token, user: JSON.parse(user) };
}

// Redirect based on role
function redirectBasedOnRole(user) {
  if (user.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}

// Log out user
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'signin.html';
}

// Alert banner display utility
function showAlert(message, type = 'error') {
  const banner = document.getElementById('alertBanner');
  if (banner) {
    banner.textContent = message;
    banner.className = `alert-banner ${type}`;
    banner.style.display = 'block';
  } else {
    alert(message);
  }
}

// Simple request headers generator
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
