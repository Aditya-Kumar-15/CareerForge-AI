let overallTimerInterval = null;
let overallTimeRemaining = 600; // Overall assessment time limit in seconds
let isVoiceMode = false;
let recognition = null;
let isRecording = false;
let integrityViolated = false;
let proctorMediaStream = null;

document.addEventListener('DOMContentLoaded', () => {
  const auth = checkAuth();
  if (!auth) return;

  const user = auth.user;

  // Set avatars and badge names
  const firstLetter = user.name.charAt(0).toUpperCase();
  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) navAvatar.textContent = firstLetter;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Load Active Interview Session
  loadActiveSession();

  // Bind UI Events
  document.getElementById('submitBtn').addEventListener('click', submitAnswer);
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', handlePrevious);
  }
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

  // Proctoring buttons
  const restoreFullscreenBtn = document.getElementById('restoreFullscreenBtn');
  if (restoreFullscreenBtn) {
    restoreFullscreenBtn.addEventListener('click', () => {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Failed to enter fullscreen:', err);
      });
    });
  }

  const restartExamBtn = document.getElementById('restartExamBtn');
  if (restartExamBtn) {
    restartExamBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(()=>{});
      }
      window.location.href = 'interview-setup.html';
    });
  }

  // Tab switch & window focus loss checks
  document.addEventListener('visibilitychange', handleTabSwitch);
  window.addEventListener('blur', handleTabSwitch);
  window.addEventListener('focus', handleWindowFocus);
  // Fullscreen integrity check
  document.addEventListener('fullscreenchange', checkFullscreenEnforcement);
  
  // Initial check
  checkFullscreenEnforcement();
});

let allQuestions = [];

// Load details of the active interview
async function loadActiveSession() {
  try {
    const res = await fetch(`${API_BASE_URL}/interview/active`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      window.location.href = 'dashboard.html';
      return;
    }

    const session = await res.json();
    if (!session.active) {
      showAlert('No active interview session found. Redirecting to setup...');
      setTimeout(() => { window.location.href = 'interview-setup.html'; }, 1500);
      return;
    }

    // Check if session was terminated due to overall timeout
    if (session.terminated && session.reason === 'overall_timeout') {
      showAlert('Overall assessment time limit reached! Auto-submitting interview...', 'error');
      finalizeAssessmentOverallTimeout();
      return;
    }

    currentInterviewId = session.interviewId;
    allQuestions = session.questions || [];
    totalQuestions = allQuestions.length;
    isVoiceMode = session.config.mode === 'Voice';

    document.getElementById('interviewMeta').textContent = `Assessing your skills in a ${session.config.type} interview`;
    
    // Show voice panel if voice mode is active
    if (isVoiceMode) {
      document.getElementById('voiceControlPanel').style.display = 'flex';
      setupSpeechEngine();
    }

    currentQuestionIndex = session.currentQuestionIndex || 0;
    renderQuestionNav();

    // Start Overall Timer (Continuous authority timer)
    const overallSecs = session.overallRemainingSeconds !== undefined ? session.overallRemainingSeconds : (totalQuestions * 60);
    startOverallTimer(overallSecs);

    loadQuestionData(currentQuestionIndex);
  } catch (err) {
    console.error('Error fetching active interview session:', err);
    showAlert('Error connecting to active session.');
  }
}

// Render the 1 to N question navigation buttons
function renderQuestionNav() {
  const container = document.getElementById('questionNav');
  if (!container) return;

  container.innerHTML = '';
  allQuestions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'question-nav-btn';
    btn.textContent = idx + 1;
    
    // Highlight if question is active or has an answer
    const isAnswered = q.answerText && q.answerText.trim().length > 0;
    if (isAnswered) {
      btn.classList.add('answered');
    }
    if (idx === currentQuestionIndex) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      navigateQuestion(idx);
    });

    container.appendChild(btn);
  });
}

// Navigate to a specific question
async function navigateQuestion(targetIndex) {
  if (targetIndex === currentQuestionIndex) return;
  if (targetIndex < 0 || targetIndex >= totalQuestions) return;

  // Update active index and save to DB
  currentQuestionIndex = targetIndex;
  renderQuestionNav();

  await saveAnswerToServer(targetIndex, allQuestions[targetIndex].answerText || '');
  loadQuestionData(targetIndex);
}

// Save student response to server dynamically
async function saveAnswerToServer(index, text) {
  try {
    const res = await fetch(`${API_BASE_URL}/interview/save-answer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ questionIndex: index, answerText: text })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to auto-save answer:', err);
    return null;
  }
}

// Load a specific question into UI
function loadQuestionData(idx) {
  currentQuestionIndex = idx;
  const q = allQuestions[idx];
  if (!q) return;

  // Set UI Labels
  document.getElementById('questionCounter').textContent = `Question ${idx + 1} / ${totalQuestions}`;
  document.getElementById('badgeCategory').textContent = q.category;
  document.getElementById('badgeDifficulty').textContent = q.difficulty;
  document.getElementById('questionText').textContent = q.questionText;
  
  // Render Objective MCQ Options
  renderMCQOptions(q);

  // Toggle Previous Button visibility
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) {
    prevBtn.style.display = idx === 0 ? 'none' : 'block';
  }

  // Toggle Submit button text
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    if (idx === totalQuestions - 1) {
      submitBtn.textContent = 'Finalize & Submit Objective Exam';
    } else {
      submitBtn.textContent = 'Next Question';
    }
  }
}

function renderMCQOptions(q) {
  const container = document.getElementById('mcqOptionsContainer');
  if (!container) return;

  container.innerHTML = '';

  const optionsList = (q.options && q.options.length > 0) ? q.options : [];
  const currentSelection = q.answerText || '';

  optionsList.forEach((optText, optIdx) => {
    const card = document.createElement('div');
    card.className = 'mcq-option-card';
    if (currentSelection === optText) {
      card.classList.add('selected');
    }

    const keyBadge = document.createElement('span');
    keyBadge.className = 'mcq-option-key';
    keyBadge.textContent = String.fromCharCode(65 + optIdx);

    const labelSpan = document.createElement('span');
    labelSpan.style.flex = '1';
    labelSpan.textContent = optText;

    card.appendChild(keyBadge);
    card.appendChild(labelSpan);

    card.addEventListener('click', () => {
      // Save choice in local state
      q.answerText = optText;
      
      // Update UI selection & navigation badges
      renderMCQOptions(q);
      renderQuestionNav();

      // Save answer in background to DB
      saveAnswerToServer(currentQuestionIndex, optText);
    });

    container.appendChild(card);
  });
}

// Overall Assessment Continuous Timer (Final Authority: totalQuestions * 60 seconds)
function startOverallTimer(secs) {
  clearInterval(overallTimerInterval);
  overallTimeRemaining = Math.max(0, secs);
  updateOverallTimerUI();

  if (overallTimeRemaining <= 0) {
    showAlert('Overall assessment time limit reached! Auto-submitting interview...', 'error');
    finalizeAssessmentOverallTimeout();
    return;
  }

  overallTimerInterval = setInterval(() => {
    overallTimeRemaining--;
    updateOverallTimerUI();

    if (overallTimeRemaining <= 0) {
      clearInterval(overallTimerInterval);
      showAlert('Overall assessment time limit reached! Auto-submitting interview...', 'error');
      finalizeAssessmentOverallTimeout();
    }
  }, 1000);
}

function updateOverallTimerUI() {
  const badge = document.getElementById('overallTimerBadge');
  const timerText = document.getElementById('overallTimeRemaining');
  if (!timerText) return;

  const mins = Math.floor(overallTimeRemaining / 60).toString().padStart(2, '0');
  const secs = (overallTimeRemaining % 60).toString().padStart(2, '0');
  timerText.textContent = `${mins}:${secs}`;

  if (badge) {
    if (overallTimeRemaining <= 60) {
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
      badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      badge.style.color = '#ef4444';
    } else {
      badge.style.background = 'rgba(16, 185, 129, 0.1)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      badge.style.color = '#10b981';
    }
  }
}

// Finalize assessment on overall time expiration
async function finalizeAssessmentOverallTimeout() {
  try {
    clearInterval(overallTimerInterval);
    
    // Attempt auto-saving current selection if available
    const q = allQuestions[currentQuestionIndex];
    const selectedOpt = q ? q.answerText : '';
    await saveAnswerToServer(currentQuestionIndex, selectedOpt);

    const res = await fetch(`${API_BASE_URL}/interview/finalize`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `report.html?id=${data.interviewId}`;
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    console.error('Error during overall timeout finalize:', err);
    window.location.href = 'dashboard.html';
  }
}

// Update character and word counters
function updateWordCounter() {
  const text = document.getElementById('answerInput').value.trim();
  const chars = text.length;
  const words = text ? text.split(/\s+/).length : 0;
  document.getElementById('wordCountText').textContent = `${words} words / ${chars} chars`;
}

// Block copy cut and paste events
function preventCheating(e) {
  e.preventDefault();
  showAlert('Integrity notice: Copying, cutting, or pasting text is disabled during the interview.', 'error');
}

// Core Proctoring Integrity Reporter
async function reportWarning(reason) {
  if (integrityViolated) return;
  // If no interview is loaded yet, skip reporting
  if (!currentInterviewId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/interview/warning`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    
    // Update sidebar warning badge
    const warningBadge = document.getElementById('sidebarWarnings');
    if (warningBadge) {
      warningBadge.textContent = `Warnings: ${data.warnings}/3`;
    }

    if (data.terminated || data.warnings >= 3) {
      integrityViolated = true;
      clearInterval(overallTimerInterval);
      
      // Force exit fullscreen if currently in it
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(()=>{});
      }

      // Hide fullscreen required screen and show termination lock overlay
      const fsOverlay = document.getElementById('fullscreenOverlay');
      if (fsOverlay) fsOverlay.style.display = 'none';

      const termOverlay = document.getElementById('terminationOverlay');
      if (termOverlay) termOverlay.style.display = 'flex';
      
      showAlert('Assessment terminated! Exceeded maximum integrity warnings (3/3). Please click Restart Exam.', 'error');
    } else {
      showAlert(`Warning (${data.warnings}/3): ${reason} Please remain in fullscreen mode.`, 'error');
      
      // Render warning notification on the fullscreen overlay so it is immediately visible
      const overlayNotice = document.getElementById('overlayWarningNotice');
      if (overlayNotice) {
        overlayNotice.textContent = `⚠️ Integrity Warning (${data.warnings}/3): ${reason}`;
        overlayNotice.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Error reporting focus loss:', err);
  }
}

let isWindowBlurred = false;

// Track tab switching, app switching, and window focus losses
async function handleTabSwitch() {
  if (integrityViolated) return;

  if (document.visibilityState === 'hidden' || !document.hasFocus()) {
    if (!isWindowBlurred) {
      isWindowBlurred = true;
      await reportWarning('Tab switch / window focus loss detected.');
    }
  }
}

function handleWindowFocus() {
  isWindowBlurred = false;
}

// Monitor and block interview if candidate leaves fullscreen mode
async function checkFullscreenEnforcement() {
  if (integrityViolated) return;

  const fullscreenOverlay = document.getElementById('fullscreenOverlay');
  if (!fullscreenOverlay) return;

  if (!document.fullscreenElement) {
    fullscreenOverlay.style.display = 'flex';
    // Record warning for exiting fullscreen mode
    await reportWarning('Exited fullscreen mode.');
  } else {
    fullscreenOverlay.style.display = 'none';
  }
}

// Fullscreen toggle
function toggleFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Error attempting fullscreen:', err);
    });
    btn.textContent = 'Exit Fullscreen';
  } else {
    document.exitFullscreen();
    btn.textContent = 'Fullscreen Mode';
  }
}

function handlePrevious() {
  if (currentQuestionIndex > 0) {
    navigateQuestion(currentQuestionIndex - 1);
  }
}

// Handles clicking Next / Submit / Finalize
async function submitAnswer() {
  const answerText = allQuestions[currentQuestionIndex].answerText || '';

  // Save in local state
  renderQuestionNav();

  // If not on the last question, just paginate forward
  if (currentQuestionIndex < totalQuestions - 1) {
    await saveAnswerToServer(currentQuestionIndex, answerText);
    navigateQuestion(currentQuestionIndex + 1);
    return;
  }

  // On final question: Finalize and submit all answers
  clearInterval(overallTimerInterval);

  const submitBtn = document.getElementById('submitBtn');
  const prevBtn = document.getElementById('prevBtn');

  submitBtn.disabled = true;
  if (prevBtn) prevBtn.disabled = true;
  submitBtn.textContent = 'Submitting & Evaluating...';

  showAlert('Assessment completed! Evaluating your objective choices and compiling report... Please wait.', 'success');

  try {
    const response = await fetch(`${API_BASE_URL}/interview/finalize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ lastAnswerText: answerText })
    });

    const data = await response.json();

    if (response.ok) {
      window.location.href = `report.html?id=${currentInterviewId}`;
    } else {
      showAlert(data.message || 'Submission failed. Try again.');
      submitBtn.disabled = false;
      if (prevBtn) prevBtn.disabled = false;
      submitBtn.textContent = 'Finalize & Submit Objective Exam';
    }
  } catch (err) {
    console.error('Finalize Interview Error:', err);
    showAlert('Network error occurred during evaluation.');
    submitBtn.disabled = false;
    if (prevBtn) prevBtn.disabled = false;
    submitBtn.textContent = 'Finalize & Submit Objective Exam';
  }
}
