let allCandidates = [];

document.addEventListener('DOMContentLoaded', () => {
  const auth = checkAuth();
  if (!auth) return;

  const user = auth.user;
  if (user.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  // Populate basic admin fields
  document.getElementById('badgeName').textContent = user.name;
  document.getElementById('adminMail').textContent = user.email;
  const firstLetter = user.name.charAt(0).toUpperCase();
  document.getElementById('navAvatar').textContent = firstLetter;
  document.getElementById('badgeAvatar').textContent = firstLetter;

  // Sign out listener
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
  });

  // Tab State Toggle DOM elements
  const tabLoginHistory = document.getElementById('tabLoginHistory');
  const tabStudents = document.getElementById('tabStudents');
  const tabCandidates = document.getElementById('tabCandidates');

  const sectionLoginHistory = document.getElementById('sectionLoginHistory');
  const sectionStudents = document.getElementById('sectionStudents');
  const sectionCandidates = document.getElementById('sectionCandidates');

  const currentTabTitle = document.getElementById('currentTabTitle');

  tabLoginHistory.addEventListener('click', (e) => {
    e.preventDefault();
    tabLoginHistory.classList.add('active');
    tabStudents.classList.remove('active');
    tabCandidates.classList.remove('active');
    sectionLoginHistory.style.display = 'block';
    sectionStudents.style.display = 'none';
    sectionCandidates.style.display = 'none';
    currentTabTitle.textContent = 'System Logs & Audits';
    closeDetailCard();
  });

  tabStudents.addEventListener('click', (e) => {
    e.preventDefault();
    tabStudents.classList.add('active');
    tabLoginHistory.classList.remove('active');
    tabCandidates.classList.remove('active');
    sectionStudents.style.display = 'block';
    sectionLoginHistory.style.display = 'none';
    sectionCandidates.style.display = 'none';
    currentTabTitle.textContent = 'Student Directory';
    closeDetailCard();
  });

  tabCandidates.addEventListener('click', (e) => {
    e.preventDefault();
    tabCandidates.classList.add('active');
    tabStudents.classList.remove('active');
    tabLoginHistory.classList.remove('active');
    sectionCandidates.style.display = 'flex';
    sectionStudents.style.display = 'none';
    sectionLoginHistory.style.display = 'none';
    currentTabTitle.textContent = 'Recruiter Assessments';
  });

  // Search input listeners
  document.getElementById('candidateSearchInput').addEventListener('input', filterCandidates);
  document.getElementById('candidateSkillInput').addEventListener('input', filterCandidates);

  // Load Data
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const headers = getAuthHeaders();

    // 1. Fetch Students
    const resStudents = await fetch(`${API_BASE_URL}/admin/students`, { headers });
    if (!resStudents.ok) {
      if (resStudents.status === 401 || resStudents.status === 403) {
        logout();
        return;
      }
      throw new Error('Failed to load students');
    }
    const students = await resStudents.json();
    document.getElementById('statStudentsCount').textContent = students.length;
    renderStudents(students);

    // 2. Fetch Login History
    const resHistory = await fetch(`${API_BASE_URL}/admin/login-history`, { headers });
    if (!resHistory.ok) throw new Error('Failed to load login audits');
    const history = await resHistory.json();
    document.getElementById('statLoginsCount').textContent = history.length;
    renderHistory(history);

    // 3. Fetch Candidates Database
    const resCandidates = await fetch(`${API_BASE_URL}/admin/candidates`, { headers });
    if (!resCandidates.ok) throw new Error('Failed to load candidates audits');
    const candidates = await resCandidates.json();
    allCandidates = candidates;
    renderCandidates(candidates);

  } catch (err) {
    console.error('Admin Load Error:', err);
    showAlert('Failed to connect to the administration API.');
  }
}

function renderStudents(students) {
  const tbody = document.getElementById('studentsTableBody');
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No registered students found.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(student => {
    const yearSuffixes = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
    return `
      <tr>
        <td style="font-weight: 600;">${escapeHTML(student.name)}</td>
        <td style="font-family: monospace; letter-spacing: 0.05em; font-weight: 500;">${escapeHTML(student.rollNo)}</td>
        <td>${escapeHTML(student.email)}</td>
        <td>${escapeHTML(student.department)}</td>
        <td>${escapeHTML(yearSuffixes[student.year] || student.year + 'th Year')}</td>
        <td>${escapeHTML(student.phone)}</td>
      </tr>
    `;
  }).join('');
}

function renderHistory(history) {
  const tbody = document.getElementById('historyTableBody');
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No login history entries recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(item => {
    const student = item.studentId || {};
    const studentName = student.name || 'Deleted Account';
    const rollNo = student.rollNo || 'N/A';
    const email = student.email || 'N/A';
    const dept = student.department || 'N/A';

    const dateObj = new Date(item.loginTime);
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = `${dateStr} at ${timeStr}`;

    const browser = parseUserAgent(item.userAgent || 'Unknown Device');

    return `
      <tr>
        <td style="font-weight: 600;">${escapeHTML(studentName)}</td>
        <td style="font-family: monospace; font-weight: 500;">${escapeHTML(rollNo)}</td>
        <td>${escapeHTML(email)}</td>
        <td>${escapeHTML(dept)}</td>
        <td style="font-size: 0.9rem; color: var(--text-secondary);">${formattedDate}</td>
        <td style="font-family: monospace; color: var(--accent-primary);">${escapeHTML(item.ipAddress || '127.0.0.1')}</td>
        <td title="${escapeHTML(item.userAgent || '')}" style="font-size: 0.85rem; color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHTML(browser)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderCandidates(candidates) {
  const tbody = document.getElementById('candidatesTableBody');
  if (candidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No matching candidates found.</td></tr>`;
    return;
  }

  tbody.innerHTML = candidates.map(c => {
    const resumeBadge = c.resumeUploaded
      ? (c.resumeVerified ? '<span class="badge badge-success">Verified ✓</span>' : '<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3)">Uploaded</span>')
      : '<span class="badge badge-admin">Not Uploaded</span>';

    let scoreColor = 'var(--text-secondary)';
    if (c.averageScore >= 80) scoreColor = 'var(--accent-success)';
    else if (c.averageScore >= 60) scoreColor = 'var(--accent-primary)';
    
    let statusClass = 'badge badge-student';
    if (c.assessmentStatus === 'Excellent') statusClass = 'badge badge-success';
    else if (c.assessmentStatus === 'Strong') statusClass = 'badge badge-student';
    else if (c.assessmentStatus === 'Good') statusClass = 'badge';
    else if (c.assessmentStatus === 'Needs Improvement') statusClass = 'badge badge-admin';

    const yearSuffixes = { 1: '1st Yr', 2: '2nd Yr', 3: '3rd Yr', 4: '4th Yr' };
    const yearText = yearSuffixes[c.year] || c.year + 'th Yr';

    return `
      <tr>
        <td style="font-weight: 600;">${escapeHTML(c.name)}</td>
        <td style="font-family: monospace; font-weight: 500;">${escapeHTML(c.rollNo)}</td>
        <td style="font-size: 0.85rem; line-height: 1.3;">
          <div style="font-weight: 600;">${escapeHTML(c.college)}</div>
          <div style="color:var(--text-secondary);">${escapeHTML(c.department)} (${yearText})</div>
        </td>
        <td>${resumeBadge}</td>
        <td style="font-weight: 700; color: ${scoreColor};">${c.averageScore > 0 ? c.averageScore + '%' : 'N/A'}</td>
        <td><span class="${statusClass}">${c.assessmentStatus}</span></td>
        <td>
          <button type="button" class="btn btn-secondary" onclick="viewCandidateDetails('${c._id}')" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; width: auto; display: inline-flex;">View Profile</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterCandidates() {
  const searchVal = document.getElementById('candidateSearchInput').value.toLowerCase().trim();
  const skillVal = document.getElementById('candidateSkillInput').value.toLowerCase().trim();

  const filtered = allCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchVal) ||
      c.rollNo.toLowerCase().includes(searchVal) ||
      c.department.toLowerCase().includes(searchVal) ||
      c.college.toLowerCase().includes(searchVal);

    let matchesSkills = true;
    if (skillVal) {
      const candidateSkills = [];
      if (c.skills) {
        if (c.skills.languages) candidateSkills.push(...c.skills.languages);
        if (c.skills.frameworks) candidateSkills.push(...c.skills.frameworks);
        if (c.skills.databases) candidateSkills.push(...c.skills.databases);
        if (c.skills.technologies) candidateSkills.push(...c.skills.technologies);
      }
      const skillString = candidateSkills.join(' ').toLowerCase();
      const filterTerms = skillVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
      matchesSkills = filterTerms.every(term => skillString.includes(term));
    }

    return matchesSearch && matchesSkills;
  });

  renderCandidates(filtered);
}

window.viewCandidateDetails = async function(id) {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/admin/candidate/${id}/report`, { headers });
    if (!res.ok) throw new Error('Failed to load candidate overview');
    const data = await res.json();

    document.getElementById('detailCandidateName').textContent = data.student.name;
    document.getElementById('detailCandidateCollege').textContent = `${data.student.college} • ${data.student.department} • Year ${data.student.year}`;

    // Render skills
    const langCont = document.getElementById('detailLanguages');
    const fwCont = document.getElementById('detailFrameworks');
    const dbCont = document.getElementById('detailDatabases');

    langCont.innerHTML = '';
    fwCont.innerHTML = '';
    dbCont.innerHTML = '';

    const skills = data.resume && data.resume.extractedData ? data.resume.extractedData.skills : null;
    if (skills) {
      const langs = skills.languages || [];
      const fws = skills.frameworks || [];
      const dbs = [...(skills.databases || []), ...(skills.technologies || [])];

      if (langs.length > 0) {
        langs.forEach(s => langCont.innerHTML += `<span class="tag" style="padding: 0.15rem 0.5rem; font-size:0.75rem;">${escapeHTML(s)}</span>`);
      } else {
        langCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>';
      }

      if (fws.length > 0) {
        fws.forEach(s => fwCont.innerHTML += `<span class="tag" style="padding: 0.15rem 0.5rem; font-size:0.75rem;">${escapeHTML(s)}</span>`);
      } else {
        fwCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>';
      }

      if (dbs.length > 0) {
        dbs.forEach(s => dbCont.innerHTML += `<span class="tag" style="padding: 0.15rem 0.5rem; font-size:0.75rem; background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.3);">${escapeHTML(s)}</span>`);
      } else {
        dbCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>';
      }
    } else {
      langCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No resume uploaded</span>';
      fwCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No resume uploaded</span>';
      dbCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No resume uploaded</span>';
    }

    // Render projects list
    const projCont = document.getElementById('detailProjects');
    projCont.innerHTML = '';
    const projects = data.resume && data.resume.extractedData ? data.resume.extractedData.projects : [];
    if (projects && projects.length > 0) {
      projects.forEach(p => {
        projCont.innerHTML += `
          <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-light); padding:0.85rem; border-radius:8px; width: 100%;">
            <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary);">${escapeHTML(p.name)} <span style="font-size:0.75rem; color:var(--text-muted);">(${escapeHTML(p.role || 'Developer')})</span></div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${escapeHTML(p.description)}</p>
            <div style="font-size:0.75rem; color:var(--accent-primary); margin-top:0.4rem; font-weight:500;">Tech: ${(p.technologies || []).join(', ')}</div>
          </div>
        `;
      });
    } else {
      projCont.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No projects extracted</span>';
    }

    // Render completed interview sessions
    const sessTbody = document.getElementById('detailSessionsTableBody');
    if (data.interviews && data.interviews.length > 0) {
      sessTbody.innerHTML = data.interviews.map(i => {
        const dateStr = new Date(i.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return `
          <tr>
            <td>${dateStr}</td>
            <td><span class="badge badge-student" style="font-size:0.7rem;">${escapeHTML(i.config.type)}</span></td>
            <td style="font-weight:700; color:var(--accent-success);">${i.finalReport.overallScore}%</td>
            <td>
              <a href="report.html?id=${i._id}" target="_blank" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; display: inline-flex;">View Report</a>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      sessTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1rem;">No reports logged.</td></tr>';
    }

    document.getElementById('candidateDetailCard').style.display = 'block';
    document.getElementById('candidateDetailCard').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Error loading candidate details:', err);
    showAlert('Error fetching candidate profile detail.');
  }
};

window.closeDetailCard = function() {
  document.getElementById('candidateDetailCard').style.display = 'none';
};

function parseUserAgent(ua) {
  if (!ua) return 'Unknown Client';
  if (ua.includes('Postman')) return 'Postman App';
  if (ua.includes('Firefox')) {
    if (ua.includes('Windows')) return 'Firefox (Windows)';
    if (ua.includes('Macintosh')) return 'Firefox (macOS)';
    return 'Firefox';
  }
  if (ua.includes('Chrome')) {
    if (ua.includes('Windows')) return 'Chrome (Windows)';
    if (ua.includes('Macintosh')) return 'Chrome (macOS)';
    return 'Chrome';
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'Safari (iOS)';
    return 'Safari (macOS)';
  }
  return ua.split(' ')[0] || 'Browser Client';
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
