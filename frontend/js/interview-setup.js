document.addEventListener('DOMContentLoaded', () => {
  const auth = checkAuth();
  if (!auth) return;

  const user = auth.user;

  // Set avatars and badge names
  document.getElementById('badgeName').textContent = user.name;
  const firstLetter = user.name.charAt(0).toUpperCase();
  document.getElementById('navAvatar').textContent = firstLetter;
  document.getElementById('badgeAvatar').textContent = firstLetter;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
  });

  // Verify they have a resume verified
  verifyResumeCheck();
});

let currentCandidateProjects = [];

async function verifyResumeCheck() {
  try {
    const res = await fetch(`${API_BASE_URL}/interview/stats`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const stats = await res.json();
      if (!stats.resumeUploaded || !stats.resumeVerified) {
        showAlert('Please upload and verify your resume first. Redirecting...', 'error');
        setTimeout(() => {
          window.location.href = 'resume.html';
        }, 2000);
        return;
      }
    }

    const resumeRes = await fetch(`${API_BASE_URL}/resume/current`, {
      headers: getAuthHeaders()
    });
    if (resumeRes.ok) {
      const r = await resumeRes.json();
      // NOTE: /api/resume/current returns the resume object directly (not wrapped in {resume:...})
      const card = document.getElementById('resumeSummaryCard');
      const nameEl = document.getElementById('resumeFileName');
      const projEl = document.getElementById('resumeProjectsBadge');

      if (card && nameEl && projEl) {
        card.style.display = 'block';
        nameEl.textContent = r.fileName || 'Uploaded Resume';
        
        const projs = r.extractedData?.projects || [];
        currentCandidateProjects = projs;

        if (projs.length > 0) {
          const projNames = projs.map(p => typeof p === 'string' ? p : (p?.name || 'Project')).filter(Boolean).join(', ');
          projEl.innerHTML = `<strong style="color: var(--accent-primary);">${projs.length} Resume Projects Detected:</strong> <span style="color: var(--text-primary);">${projNames}</span>`;
        } else {
          projEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">⚠️ 0 Projects Detected in Resume.</span> Project-based interviews require a resume with listed projects. <a href="resume.html" style="color: #a78bfa;">Go to Resume Parser →</a>`;
        }
      }
    }
  } catch (err) {
    console.error('Error checking resume status:', err);
  }
}

document.getElementById('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.getElementById('type').value;
  const difficulty = document.getElementById('difficulty').value;
  const questionCount = document.getElementById('questionCount').value;
  const mode = document.getElementById('mode').value;

  // Block Project-based launch if no projects exist in resume
  if (type === 'Project-based' && currentCandidateProjects.length === 0) {
    showAlert('No projects were found in your uploaded resume. Please add a project in the Resume Parser or select a Technical interview.', 'error');
    return;
  }

  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.textContent = 'Initializing AI Session...';

  try {
    const response = await fetch(`${API_BASE_URL}/interview/setup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, difficulty, questionCount, mode })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Interview initialized! Redirecting to Interview room...', 'success');
      setTimeout(() => {
        window.location.href = 'interview.html';
      }, 1000);
    } else {
      const errorMsg = data.message || data.error || 'Failed to initialize interview.';
      console.error('[INTERVIEW INIT FAILED]', 'Status:', response.status, 'Response:', data);
      showAlert(`${errorMsg} (Status: ${response.status})`, 'error');
      startBtn.disabled = false;
      startBtn.textContent = 'Launch Assessment Session';
    }
  } catch (err) {
    console.error('Interview Setup Error:', err);
    showAlert(`Network error: ${err.message}`);
    startBtn.disabled = false;
    startBtn.textContent = 'Launch Assessment Session';
  }
});
