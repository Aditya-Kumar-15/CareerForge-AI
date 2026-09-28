document.addEventListener('DOMContentLoaded', async () => {
  const auth = checkAuth();
  if (!auth) return;

  const user = auth.user;

  // Set welcome greeting and profile fields
  document.getElementById('welcomeName').textContent = user.name;
  document.getElementById('badgeName').textContent = user.name;
  document.getElementById('profileRollNo').textContent = user.rollNo;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileCollege').textContent = user.college || 'N/A';
  document.getElementById('profileDept').textContent = user.department || 'N/A';
  
  const yearText = user.year ? `${user.year}nd Year` : 'N/A';
  const suffixes = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
  document.getElementById('profileYear').textContent = suffixes[user.year] || yearText;

  // Set avatars first letter
  const firstLetter = user.name.charAt(0).toUpperCase();
  document.getElementById('navAvatar').textContent = firstLetter;
  document.getElementById('badgeAvatar').textContent = firstLetter;

  // Add signout button listener
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
  });

  // Fetch Stats and History
  try {
    const headers = getAuthHeaders();
    
    // 1. Fetch Stats
    const statsRes = await fetch(`${API_BASE_URL}/interview/stats`, { headers });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      
      // Update Resume Status badge
      const badge = document.getElementById('resumeStatusBadge');
      const statusText = document.getElementById('resumeStatusText');
      const startBtn = document.getElementById('startInterviewBtn');

      if (stats.resumeUploaded && stats.resumeVerified) {
        badge.textContent = 'Verified ✓';
        badge.className = 'badge badge-success';
        statusText.innerHTML = 'Resume parsed and verified. You are ready to start interviews.';
        startBtn.classList.remove('btn-secondary');
        startBtn.classList.add('btn-primary');
        startBtn.style.pointerEvents = 'auto';
        startBtn.style.opacity = '1';
      } else if (stats.resumeUploaded && !stats.resumeVerified) {
        badge.textContent = 'Verification Pending ⚠';
        badge.className = 'badge';
        badge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = '#f59e0b';
        badge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        statusText.innerHTML = 'Resume uploaded but skills/projects require your confirmation.';
        startBtn.style.pointerEvents = 'none';
        startBtn.style.opacity = '0.5';
        startBtn.title = 'Please verify resume first';
      } else {
        badge.textContent = 'Not Uploaded ✗';
        badge.className = 'badge badge-admin'; // red color styled badge
        statusText.innerHTML = 'Upload your technical resume to start personalized mock interviews.';
        startBtn.style.pointerEvents = 'none';
        startBtn.style.opacity = '0.5';
        startBtn.title = 'Please upload resume first';
      }

      // Update Statistics indicators
      document.getElementById('statCompleted').textContent = stats.interviewsCompleted;
      document.getElementById('statAverage').textContent = `${stats.averageScore}%`;
      document.getElementById('statHighest').textContent = `${stats.highestScore}%`;
      document.getElementById('statAnswered').textContent = stats.questionsAnswered;
    }


    // 2. Fetch History
    const historyRes = await fetch(`${API_BASE_URL}/interview/history`, { headers });
    if (historyRes.ok) {
      const history = await historyRes.json();
      const tbody = document.getElementById('historyTableBody');
      
      if (history.length > 0) {
        tbody.innerHTML = '';
        history.forEach(item => {
          const tr = document.createElement('tr');
          
          const date = new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          tr.innerHTML = `
            <td>${date}</td>
            <td><span class="badge badge-student">${item.config.type}</span></td>
            <td>${item.config.difficulty}</td>
            <td style="font-weight: 600; color: ${item.finalReport.overallScore >= 75 ? 'var(--accent-success)' : 'var(--text-primary)'}">
              ${item.finalReport.overallScore}%
            </td>
            <td>
              <a href="report.html?id=${item._id}" class="btn btn-secondary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; width: auto; display: inline-flex;">View Report</a>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error('Error fetching dashboard statistics:', err);
    showAlert('Failed to connect to backend api. Check your connection.');
  }
});
