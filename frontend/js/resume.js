let extractedData = {
  skills: { languages: [], frameworks: [], databases: [], technologies: [] },
  projects: [],
  certifications: [],
  experience: []
};

document.addEventListener('DOMContentLoaded', async () => {
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

  // Setup drag and drop
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Bind file view, download, and reupload actions
  const viewBtn = document.getElementById('viewResumeBtn');
  if (viewBtn) {
    viewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleViewResume(false);
    });
  }

  const downloadBtn = document.getElementById('downloadResumeBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleViewResume(true);
    });
  }

  const reuploadBtn = document.getElementById('reuploadBtn');
  if (reuploadBtn) {
    reuploadBtn.addEventListener('click', () => {
      document.getElementById('uploadCard').style.display = 'block';
    });
  }

  const reparseBtn = document.getElementById('reparseBtn');
  if (reparseBtn) {
    reparseBtn.addEventListener('click', async () => {
      reparseBtn.disabled = true;
      reparseBtn.textContent = 'Re-parsing...';
      try {
        const res = await fetch(`${API_BASE_URL}/resume/reparse`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          extractedData = data.resume.extractedData || extractedData;
          const projCount = extractedData?.projects?.length || 0;
          showAlert(data.message + (projCount > 0 ? ` Projects: ${extractedData.projects.map(p => p?.name || p).join(', ')}` : ' No projects found in stored resume text.'), 'success');
          renderResumeFileCard(data.resume);
          showEditor();
        } else {
          showAlert(data.message || 'Re-parse failed. Please try re-uploading your resume.');
        }
      } catch (err) {
        console.error('Re-parse Error:', err);
        showAlert('Network error occurred during re-parse.');
      } finally {
        reparseBtn.disabled = false;
        reparseBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> Re-parse Projects`;
      }
    });
  }

  // Load existing resume details if available
  try {
    const res = await fetch(`${API_BASE_URL}/resume/current`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const resume = await res.json();
      extractedData = resume.extractedData || extractedData;
      console.log(`[RESUME LOAD]\nuserId: ${user.id || user._id}\nresumeId: ${resume._id}\nfileName: ${resume.fileName}\nuploadedAt: ${resume.updatedAt || resume.createdAt}\nprojects: ${extractedData?.projects?.length || 0}\ncertifications: ${extractedData?.certifications?.length || 0}\nexperience: ${extractedData?.experience?.length || 0}`);
      renderResumeFileCard(resume);
      showEditor();
    }
  } catch (err) {
    console.log("No existing resume to pre-fill.");
  }
});

let currentResumeFileName = 'Uploaded_Resume.pdf';

function renderResumeFileCard(resume) {
  const card = document.getElementById('resumeFileCard');
  if (!card) return;

  currentResumeFileName = resume.fileName || 'Uploaded_Resume.pdf';

  document.getElementById('displayFileName').textContent = currentResumeFileName;
  
  const sizeKb = Math.round((resume.fileSize || 0) / 1024);
  const dateStr = new Date(resume.updatedAt || resume.createdAt || Date.now()).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('displayFileMeta').textContent = `File Size: ${sizeKb} KB | Last Uploaded: ${dateStr}`;

  const badge = document.getElementById('displayVerifiedBadge');
  if (badge) {
    if (resume.verified) {
      badge.textContent = 'Verified ✓';
      badge.className = 'badge badge-success';
    } else {
      badge.textContent = 'Verification Pending ⚠';
      badge.className = 'badge';
      badge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      badge.style.color = '#f59e0b';
    }
  }

  card.style.display = 'block';
}

async function handleViewResume(isDownload = false) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('Please sign in again.');
      setTimeout(() => logout(), 1500);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/resume/my/file${isDownload ? '?download=true' : '?view=true'}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showAlert(errData.message || 'Failed to retrieve resume file.');
      return;
    }

    const disposition = response.headers.get('Content-Disposition');
    let fileName = currentResumeFileName;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = decodeURIComponent(match[1]);
      }
    }

    const blob = await response.blob();
    const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');

    if (isDownload) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } else {
      if (isDocx) {
        showAlert(`DOCX file "${fileName}" downloaded. (Web browsers download Word documents as raw DOCX files cannot be rendered directly inside browser PDF viewer tabs).`, 'success');
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) {
          showAlert('Pop-up blocked. Please allow pop-ups to view PDF resume.');
        }
      }
    }
  } catch (err) {
    console.error('Error handling resume file:', err);
    showAlert('Network error occurred while fetching uploaded resume file.');
  }
}

// Handle uploading file to backend
async function handleFileUpload(file) {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
    showAlert('Unsupported file format. Please upload a PDF or DOCX file.');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showAlert('File exceeds 5MB size limit.');
    return;
  }

  const formData = new FormData();
  formData.append('resume', file);

  const progressContainer = document.getElementById('progressContainer');
  const progressStatus = document.getElementById('progressStatus');
  const progressFill = document.getElementById('progressFill');

  progressContainer.style.display = 'block';
  progressStatus.textContent = 'Uploading and reading document...';
  progressFill.style.width = '20%';

  // Mock progress progression
  let progress = 20;
  const interval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 2;
      progressFill.style.width = `${progress}%`;
      if (progress > 50) {
        progressStatus.textContent = 'Running AI Resume Profile Extractor...';
      }
    }
  }, 400);

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/resume/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    clearInterval(interval);
    const data = await response.json();

    if (response.ok) {
      progressFill.style.width = '100%';
      progressStatus.textContent = 'Completed!';
      setTimeout(() => {
        extractedData = data.resume.extractedData;
        renderResumeFileCard(data.resume);
        showEditor();
      }, 500);
    } else {
      progressContainer.style.display = 'none';
      showAlert(data.message || 'Failed to parse resume. Try again.');
    }
  } catch (err) {
    clearInterval(interval);
    progressContainer.style.display = 'none';
    console.error('File Upload Error:', err);
    showAlert('Network error occurred during resume analysis.');
  }
}

// Show the editor form populated with extracted details
function showEditor() {
  document.getElementById('uploadCard').style.display = 'none';
  const form = document.getElementById('verificationForm');
  form.style.display = 'block';

  renderSkills();
  renderProjects();
  renderCerts();
  renderExperience();
}

// Render dynamic skills tags
function renderSkills() {
  const categories = ['lang', 'fw', 'db', 'tech'];
  const keys = ['languages', 'frameworks', 'databases', 'technologies'];

  categories.forEach((cat, index) => {
    const key = keys[index];
    const container = document.getElementById(`${cat}Tags`);
    container.innerHTML = '';
    
    const items = extractedData.skills[key] || [];
    items.forEach((item, itemIdx) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        <span>${item}</span>
        <span class="tag-remove" onclick="removeSkillTag('${key}', ${itemIdx})">×</span>
      `;
      container.appendChild(tag);
    });
  });
}

// Add skill tag
window.addSkillTag = function(category) {
  const input = document.getElementById(`${category}Input`);
  const val = input.value.trim();
  if (!val) return;

  const keyMap = { lang: 'languages', fw: 'frameworks', db: 'databases', tech: 'technologies' };
  const key = keyMap[category];

  if (!extractedData.skills[key]) {
    extractedData.skills[key] = [];
  }

  // Split by comma if user inputs multiple skills
  const skillsToAdd = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
  skillsToAdd.forEach(skill => {
    if (!extractedData.skills[key].includes(skill)) {
      extractedData.skills[key].push(skill);
    }
  });

  input.value = '';
  renderSkills();
};

window.removeSkillTag = function(key, index) {
  extractedData.skills[key].splice(index, 1);
  renderSkills();
};

// Render Projects List
function renderProjects() {
  const container = document.getElementById('projectsContainer');
  container.innerHTML = '';

  const projects = extractedData.projects || [];
  if (projects.length === 0) {
    container.innerHTML = '<div style="background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-light); padding: 1.25rem; border-radius: 10px; text-align: center; color: var(--text-secondary); margin-bottom: 1rem;"><p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No projects found in the uploaded resume.</p></div>';
    return;
  }

  projects.forEach((proj, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <button type="button" class="delete-item-btn" onclick="removeItem('projects', ${idx})">×</button>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" class="form-input proj-name" value="${proj.name || ''}" placeholder="e.g. Portfolio Website" required>
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <input type="text" class="form-input proj-role" value="${proj.role || ''}" placeholder="e.g. Lead Developer">
        </div>
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Description</label>
        <textarea class="form-input proj-desc" placeholder="Briefly describe what this project is about..." style="min-height: 70px; resize: vertical; font-family: inherit;">${proj.description || ''}</textarea>
      </div>
      <div class="form-row" style="margin-top: 1rem;">
        <div class="form-group">
          <label class="form-label">Technologies Used (comma separated)</label>
          <input type="text" class="form-input proj-tech" value="${(proj.technologies || []).join(', ')}" placeholder="e.g. React, Node.js, MongoDB">
        </div>
        <div class="form-group">
          <label class="form-label">Key Technical Focus Areas (comma separated)</label>
          <input type="text" class="form-input proj-areas" value="${(proj.technicalAreas || []).join(', ')}" placeholder="e.g. Schema Design, Latency Optimization">
        </div>
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Core Functionality Summary</label>
        <input type="text" class="form-input proj-func" value="${proj.functionality || ''}" placeholder="e.g. Handles OAuth login, payment gateways, products filter">
      </div>
    `;
    container.appendChild(card);
  });
}

window.addNewProject = function() {
  if (!extractedData.projects) extractedData.projects = [];
  extractedData.projects.push({
    name: '',
    role: '',
    description: '',
    technologies: [],
    technicalAreas: [],
    functionality: ''
  });
  renderProjects();
};

// Render Certifications List
function renderCerts() {
  const container = document.getElementById('certsContainer');
  container.innerHTML = '';

  const certs = extractedData.certifications || [];
  if (certs.length === 0) {
    container.innerHTML = '<div style="background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-light); padding: 1.25rem; border-radius: 10px; text-align: center; color: var(--text-secondary); margin-bottom: 1rem;"><p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No certifications found in the uploaded resume.</p></div>';
    return;
  }

  certs.forEach((cert, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <button type="button" class="delete-item-btn" onclick="removeItem('certifications', ${idx})">×</button>
      <div class="form-row">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Certification Name</label>
          <input type="text" class="form-input cert-name" value="${cert.name || ''}" placeholder="e.g. AWS Solutions Architect" required>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Domain/Technology</label>
          <input type="text" class="form-input cert-domain" value="${cert.domain || ''}" placeholder="e.g. Cloud Computing">
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

window.addNewCert = function() {
  if (!extractedData.certifications) extractedData.certifications = [];
  extractedData.certifications.push({ name: '', domain: '' });
  renderCerts();
};

// Render Experience List
function renderExperience() {
  const container = document.getElementById('experienceContainer');
  container.innerHTML = '';

  const experience = extractedData.experience || [];
  if (experience.length === 0) {
    container.innerHTML = '<div style="background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-light); padding: 1.25rem; border-radius: 10px; text-align: center; color: var(--text-secondary); margin-bottom: 1rem;"><p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No work or internship experience found in the uploaded resume.</p></div>';
    return;
  }

  experience.forEach((exp, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <button type="button" class="delete-item-btn" onclick="removeItem('experience', ${idx})">×</button>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Company/Organization</label>
          <input type="text" class="form-input exp-company" value="${exp.company || ''}" placeholder="e.g. Google India" required>
        </div>
        <div class="form-group">
          <label class="form-label">Job Title / Role</label>
          <input type="text" class="form-input exp-role" value="${exp.role || ''}" placeholder="e.g. Software Engineering Intern" required>
        </div>
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Responsibilities & Scope</label>
        <textarea class="form-input exp-resp" placeholder="Detail your daily coding tasks and metrics..." style="min-height: 70px; resize: vertical; font-family: inherit;">${exp.responsibilities || ''}</textarea>
      </div>
      <div class="form-group" style="margin-top: 1rem; margin-bottom: 0;">
        <label class="form-label">Technologies Handled (comma separated)</label>
        <input type="text" class="form-input exp-tech" value="${(exp.technologies || []).join(', ')}" placeholder="e.g. React, Docker, Python">
      </div>
    `;
    container.appendChild(card);
  });
}

window.addNewExp = function() {
  if (!extractedData.experience) extractedData.experience = [];
  extractedData.experience.push({
    company: '',
    role: '',
    responsibilities: '',
    technologies: []
  });
  renderExperience();
};

// Remove item helper
window.removeItem = function(arrayKey, index) {
  extractedData[arrayKey].splice(index, 1);
  if (arrayKey === 'projects') renderProjects();
  if (arrayKey === 'certifications') renderCerts();
  if (arrayKey === 'experience') renderExperience();
};

// Save and lock the verified details
document.getElementById('verificationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Read projects from DOM inputs
  const projectCards = document.querySelectorAll('#projectsContainer .item-card');
  const finalProjects = [];
  projectCards.forEach(card => {
    finalProjects.push({
      name: card.querySelector('.proj-name').value,
      role: card.querySelector('.proj-role').value,
      description: card.querySelector('.proj-desc').value,
      technologies: card.querySelector('.proj-tech').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
      technicalAreas: card.querySelector('.proj-areas').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
      functionality: card.querySelector('.proj-func').value
    });
  });

  // Read certs from DOM inputs
  const certCards = document.querySelectorAll('#certsContainer .item-card');
  const finalCerts = [];
  certCards.forEach(card => {
    finalCerts.push({
      name: card.querySelector('.cert-name').value,
      domain: card.querySelector('.cert-domain').value
    });
  });

  // Read experiences from DOM inputs
  const expCards = document.querySelectorAll('#experienceContainer .item-card');
  const finalExp = [];
  expCards.forEach(card => {
    finalExp.push({
      company: card.querySelector('.exp-company').value,
      role: card.querySelector('.exp-role').value,
      responsibilities: card.querySelector('.exp-resp').value,
      technologies: card.querySelector('.exp-tech').value.split(',').map(s => s.trim()).filter(s => s.length > 0)
    });
  });

  extractedData.projects = finalProjects;
  extractedData.certifications = finalCerts;
  extractedData.experience = finalExp;

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving verified profile...';

  try {
    const response = await fetch(`${API_BASE_URL}/resume/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ extractedData })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Resume details verified and locked successfully!', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    } else {
      showAlert(data.message || 'Failed to save verified profile details.');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Verify and Lock Profile Details';
    }
  } catch (err) {
    console.error('Save Verification Error:', err);
    showAlert('Network error. Failed to save verified details.');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Verify and Lock Profile Details';
  }
});
