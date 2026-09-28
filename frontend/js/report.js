let currentInterviewData = null;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const auth = checkAuth();
  if (!auth) return;

  const user = auth.user;
  document.getElementById('badgeName').textContent = user.name;
  const firstLetter = user.name.charAt(0).toUpperCase();
  document.getElementById('navAvatar').textContent = firstLetter;
  document.getElementById('badgeAvatar').textContent = firstLetter;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
  });

  const urlParams = new URLSearchParams(window.location.search);
  const interviewId = urlParams.get('id');
  if (!interviewId) {
    showAlert('No interview session ID provided in the URL.');
    return;
  }

  loadReportDetails(interviewId);
});

async function loadReportDetails(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/interview/details/${id}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      const data = await res.json();
      showAlert(data.message || 'Failed to fetch interview details.');
      return;
    }

    const interview = await res.json();
    currentInterviewData = interview;
    renderReport(interview);
  } catch (err) {
    console.error('Error fetching report details:', err);
    showAlert('Error connecting to backend API.');
  }
}

function isAnswerMatch(ans1, ans2) {
  if (!ans1 || !ans2) return false;
  const a1 = ans1.trim().toLowerCase();
  const a2 = ans2.trim().toLowerCase();
  if (a1 === a2) return true;
  
  const clean1 = a1.replace(/^[a-d][\)\.\s]\s*/i, '').trim();
  const clean2 = a2.replace(/^[a-d][\)\.\s]\s*/i, '').trim();
  return clean1 === clean2 && clean1.length > 0;
}

function renderReport(interview) {
  const report = interview.finalReport || {};
  const questions = interview.questions || [];

  // Always compute correct/wrong counts and overall score directly from actual stored question responses
  const total = questions.length > 0 ? questions.length : (report.totalQuestions || 0);
  const correct = questions.length > 0 
    ? questions.filter(q => q.isCorrect || isAnswerMatch(q.answerText, q.correctAnswer || q.correctOption)).length 
    : (report.correctCount || 0);
  const wrong = Math.max(0, total - correct);
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Update Summary Stats UI
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCorrect').textContent = correct;
  document.getElementById('statWrong').textContent = wrong;

  const gauge = document.getElementById('scoreGauge');
  gauge.textContent = `${score}%`;
  gauge.style.background = `radial-gradient(closest-side, var(--bg-card) 79%, transparent 80% 100%),
                            conic-gradient(var(--accent-primary) 0% ${score}%, var(--accent-secondary) ${score}%, var(--border-light) ${score}% 100%)`;

  const label = document.getElementById('scoreLabel');
  if (score >= 85) {
    label.textContent = 'Excellent Performance';
    label.style.color = 'var(--accent-success)';
  } else if (score >= 70) {
    label.textContent = 'Good Performance';
    label.style.color = 'var(--accent-primary)';
  } else if (score >= 40) {
    label.textContent = 'Average Performance';
    label.style.color = '#f59e0b';
  } else {
    label.textContent = 'Needs Improvement';
    label.style.color = 'var(--accent-danger)';
  }

  // Integrity warnings
  const warnings = interview.integrityWarnings || 0;
  const integrityText = document.getElementById('integrityWarningsText');
  if (warnings >= 3) {
    integrityText.innerHTML = `<span style="color: var(--accent-danger); font-weight: 600;">Security Warning:</span> Session auto-terminated on 3rd focus warning.`;
  } else if (warnings > 0) {
    integrityText.innerHTML = `<span style="color: #f59e0b; font-weight: 600;">Integrity Notice:</span> Focus warnings count: ${warnings}/3`;
  } else {
    integrityText.textContent = `All integrity validation checks passed.`;
  }

  // 2. Category Chart & Breakdown
  renderCategoryChart(report.categoryScores, questions);

  // Difficulty Breakdown
  renderDifficultyBreakdown(report.difficultyStats, questions);

  // 3. Concepts User Needs to Improve (Grouped)
  renderWeakConcepts(report.weakConcepts || []);

  // 4. Strong Concepts
  renderStrongConcepts(report.strongConcepts || []);

  // 5. Recommended Practice
  renderRecommendedPractice(report.weakConcepts || [], report.recommendations || []);

  // 6. Detailed Question Analysis
  renderQuestionAuditList();
}

function getCategoryBucket(rawCategory) {
  if (!rawCategory) return 'Technical';
  const cat = rawCategory.toLowerCase();
  
  if (cat.includes('project') || cat.includes('architecture') || cat.includes('tech stack') || cat.includes('database design') || cat.includes('security') || cat.includes('api') || cat.includes('deployment')) {
    return 'Project';
  }
  if (cat.includes('problem') || cat.includes('algo') || cat.includes('coding') || cat.includes('logic')) {
    return 'Problem Solving';
  }
  if (cat.includes('comm') || cat.includes('resume') || cat.includes('exp') || cat.includes('behavioral') || cat.includes('integrity')) {
    return 'Communication';
  }
  return 'Technical';
}

function renderCategoryChart(categoryScores, questions) {
  const canvas = document.getElementById('categoryChart');
  const container = document.getElementById('categoryBreakdownContainer');
  if (!canvas) return;

  const categories = ['Technical', 'Project', 'Problem Solving', 'Communication'];
  
  const catStats = {
    Technical: { correct: 0, total: 0 },
    Project: { correct: 0, total: 0 },
    'Problem Solving': { correct: 0, total: 0 },
    Communication: { correct: 0, total: 0 }
  };

  if (questions && questions.length > 0) {
    questions.forEach(q => {
      const bucket = getCategoryBucket(q.category);
      catStats[bucket].total += 1;
      const isCorr = q.isCorrect || isAnswerMatch(q.answerText, q.correctAnswer || q.correctOption);
      if (isCorr) {
        catStats[bucket].correct += 1;
      }
    });
  } else if (categoryScores) {
    categories.forEach(cat => {
      if (categoryScores[cat]) {
        catStats[cat].correct = categoryScores[cat].correct || 0;
        catStats[cat].total = categoryScores[cat].total || 0;
      }
    });
  }

  // Render text breakdown pills below chart
  if (container) {
    container.innerHTML = '';
    categories.forEach(cat => {
      const stat = catStats[cat];
      const pill = document.createElement('div');
      pill.className = 'stat-card';
      pill.style.padding = '0.5rem';

      if (stat.total === 0) {
        pill.innerHTML = `
          <div class="stat-val" style="color: var(--text-muted); font-size: 1.1rem;">N/A</div>
          <div class="stat-lbl">${cat} (No Qs)</div>
        `;
      } else {
        const pct = Math.round((stat.correct / stat.total) * 100);
        let color = 'var(--accent-danger)';
        if (pct >= 70) color = 'var(--accent-success)';
        else if (pct >= 40) color = '#f59e0b';

        pill.innerHTML = `
          <div class="stat-val" style="color: ${color}; font-size: 1.1rem;">${pct}%</div>
          <div class="stat-lbl">${cat} (${stat.correct}/${stat.total})</div>
        `;
      }
      container.appendChild(pill);
    });
  }

  // Values for Chart.js bar graph
  const chartValues = categories.map(cat => {
    const stat = catStats[cat];
    return stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
  });

  const ctx = canvas.getContext('2d');
  if (window.myCategoryChart) {
    window.myCategoryChart.destroy();
  }

  window.myCategoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: 'Competency (%)',
        data: chartValues,
        backgroundColor: [
          'rgba(99, 102, 241, 0.4)',
          'rgba(168, 85, 247, 0.4)',
          'rgba(16, 185, 129, 0.4)',
          'rgba(245, 158, 11, 0.4)'
        ],
        borderColor: ['#6366f1', '#a855f7', '#10b981', '#f59e0b'],
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderDifficultyBreakdown(stats, questions) {
  const container = document.getElementById('difficultyBreakdownContainer');
  if (!container) return;

  const diffStats = {
    Easy: { correct: 0, total: 0 },
    Medium: { correct: 0, total: 0 },
    Hard: { correct: 0, total: 0 },
    Expert: { correct: 0, total: 0 }
  };

  if (questions && questions.length > 0) {
    questions.forEach(q => {
      const diff = q.difficulty || 'Medium';
      if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
      diffStats[diff].total += 1;
      const isCorr = q.isCorrect || isAnswerMatch(q.answerText, q.correctAnswer || q.correctOption);
      if (isCorr) diffStats[diff].correct += 1;
    });
  } else if (stats) {
    Object.keys(diffStats).forEach(d => {
      if (stats[d]) {
        diffStats[d].correct = stats[d].correct || 0;
        diffStats[d].total = stats[d].total || 0;
      }
    });
  }

  const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
  container.innerHTML = '';

  difficulties.forEach(diff => {
    const data = diffStats[diff];
    const pill = document.createElement('div');
    pill.className = 'diff-pill';
    pill.innerHTML = `
      <span class="diff-name">${diff}:</span>
      <span class="diff-val">${data.correct}/${data.total}</span>
    `;
    container.appendChild(pill);
  });
}

function renderWeakConcepts(weakConcepts) {
  const container = document.getElementById('weakConceptsContainer');
  const countSpan = document.getElementById('weakConceptsCount');
  if (!container) return;

  if (countSpan) countSpan.textContent = `${weakConcepts.length} Concept${weakConcepts.length === 1 ? '' : 's'}`;

  if (!weakConcepts || weakConcepts.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 1.25rem; border-radius: 10px; text-align: center;">
        <span style="color: var(--accent-success); font-weight: 600;">✓ Excellent Job!</span>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">No weak concepts identified. You answered all questions correctly!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  weakConcepts.forEach((wc, i) => {
    const card = document.createElement('div');
    card.className = 'concept-card concept-card-weak';
    
    const qsList = (wc.wrongQuestionNumbers || []).map(num => `Q${num}`).join(', ') || 'N/A';

    card.innerHTML = `
      <div class="concept-title">
        <span>${i + 1}. ${wc.concept}</span>
        <span class="badge-qs">Wrong questions: ${qsList}</span>
      </div>
      <div style="margin-top: 0.5rem;">
        <strong style="font-size: 0.82rem; color: var(--accent-danger); text-transform: uppercase; letter-spacing: 0.05em;">What to Improve:</strong>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; line-height: 1.4;">
          ${wc.whatToImprove || 'Practice core concepts and study related syntax.'}
        </p>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderStrongConcepts(strongConcepts) {
  const container = document.getElementById('strongConceptsContainer');
  const countSpan = document.getElementById('strongConceptsCount');
  if (!container) return;

  if (countSpan) countSpan.textContent = `${strongConcepts.length} Concept${strongConcepts.length === 1 ? '' : 's'}`;

  if (!strongConcepts || strongConcepts.length === 0) {
    container.innerHTML = `
      <p style="color: var(--text-secondary); text-align: center; padding: 1.5rem; font-size: 0.9rem;">
        No strong concepts logged yet.
      </p>
    `;
    return;
  }

  container.innerHTML = '';
  strongConcepts.forEach((sc, i) => {
    const card = document.createElement('div');
    card.className = 'concept-card concept-card-strong';
    
    const qsList = (sc.questionNumbers || []).map(num => `Q${num}`).join(', ') || 'N/A';

    card.innerHTML = `
      <div class="concept-title">
        <span>✓ ${sc.concept}</span>
        <span class="badge-qs-strong">Questions: ${qsList}</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem; line-height: 1.4;">
        ${sc.explanation || `You correctly understood ${sc.concept} concepts.`}
      </p>
    `;
    container.appendChild(card);
  });
}

function renderRecommendedPractice(weakConcepts, recommendations) {
  const container = document.getElementById('recommendedPracticeContainer');
  if (!container) return;

  if (!weakConcepts || weakConcepts.length === 0) {
    container.innerHTML = `
      <p style="color: var(--accent-success); font-weight: 500;">
        Great performance! Keep sharpening your skills by practicing advanced mock interviews.
      </p>
    `;
    return;
  }

  container.innerHTML = '';
  weakConcepts.forEach((wc) => {
    const box = document.createElement('div');
    box.style.borderLeft = '3px solid var(--accent-secondary)';
    box.style.background = 'rgba(255, 255, 255, 0.01)';
    box.style.padding = '1rem 1.25rem';
    box.style.borderRadius = '0 8px 8px 0';
    box.innerHTML = `
      <h4 style="color: var(--text-primary); font-size: 1rem; margin-bottom: 0.25rem;">
        Concept: ${wc.concept}
      </h4>
      <p style="color: var(--accent-danger); font-size: 0.85rem; margin-bottom: 0.4rem; font-weight: 500;">
        Needs Improvement: ${wc.whatToImprove || 'Understanding core principles.'}
      </p>
      <div style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5;">
        <strong style="color: var(--accent-secondary);">Recommended Practice:</strong>
        <p style="margin-top: 0.2rem;">${wc.recommendation || `Study ${wc.concept} fundamentals and complete coding exercises.`}</p>
      </div>
    `;
    container.appendChild(box);
  });
}

window.filterQuestionReport = function(filter) {
  currentFilter = filter;
  const btns = document.querySelectorAll('.report-tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  
  if (filter === 'all') btns[0]?.classList.add('active');
  if (filter === 'correct') btns[1]?.classList.add('active');
  if (filter === 'wrong') btns[2]?.classList.add('active');

  renderQuestionAuditList();
};

function renderQuestionAuditList() {
  const container = document.getElementById('questionAuditContainer');
  if (!container || !currentInterviewData) return;

  const report = currentInterviewData.finalReport || {};
  let analyses = report.questionAnalyses || [];

  if (analyses.length === 0 && currentInterviewData.questions) {
    analyses = currentInterviewData.questions.map((q, idx) => {
      const userAns = q.answerText || '[No Answer Selected]';
      const correctAns = q.correctAnswer || q.correctOption || '';
      const isCorr = q.isCorrect || isAnswerMatch(userAns, correctAns);

      return {
        questionNumber: idx + 1,
        questionText: q.questionText,
        concept: q.topic || q.category || 'General',
        category: q.category,
        difficulty: q.difficulty,
        options: q.options || [],
        userAnswer: userAns,
        correctAnswer: correctAns,
        isCorrect: isCorr,
        explanation: isCorr ? `You correctly understood how ${q.topic} works.` : `The correct answer is "${correctAns}". You selected "${userAns}".`,
        conceptToImprove: isCorr ? null : `${q.topic} concepts.`,
        recommendation: isCorr ? null : `Review ${q.topic} documentation.`
      };
    });
  }

  let filtered = analyses;
  if (currentFilter === 'correct') filtered = analyses.filter(q => q.isCorrect);
  if (currentFilter === 'wrong') filtered = analyses.filter(q => !q.isCorrect);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No questions match this filter.</p>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(q => {
    const card = document.createElement('div');
    card.className = `q-audit-card ${q.isCorrect ? 'is-correct' : 'is-wrong'}`;

    let optionsHtml = '';
    if (q.options && q.options.length > 0) {
      optionsHtml = `
        <div style="margin: 1rem 0;">
          <h5 style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Options:</h5>
          ${q.options.map(opt => {
            const isUserOpt = isAnswerMatch(q.userAnswer, opt);
            const isCorrectOpt = isAnswerMatch(q.correctAnswer, opt);
            
            let optClass = 'opt-box';
            let badgeText = '';

            if (isCorrectOpt) {
              optClass += ' is-correct-ans';
              badgeText = '✓ Correct Answer';
            }
            if (isUserOpt && !q.isCorrect) {
              optClass += ' user-wrong';
              badgeText = '✗ Your Answer';
            } else if (isUserOpt && q.isCorrect) {
              badgeText = '✓ Your Answer';
            }

            return `
              <div class="${optClass}">
                <span>${opt}</span>
                ${badgeText ? `<span style="font-weight: 700; font-size: 0.78rem;">${badgeText}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">Question ${q.questionNumber}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.75rem;">Concept: <strong style="color: var(--accent-primary);">${q.concept}</strong></span>
          <span style="font-size: 0.75rem; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem;">${q.difficulty}</span>
        </div>
        <span class="${q.isCorrect ? 'q-badge-correct' : 'q-badge-wrong'}">
          ${q.isCorrect ? '✓ Correct' : '✗ Wrong'}
        </span>
      </div>

      <p style="font-size: 1.05rem; line-height: 1.5; color: var(--text-primary); font-weight: 500; margin-bottom: 0.75rem;">
        ${q.questionText}
      </p>

      ${optionsHtml}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(0,0,0,0.2); padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase;">Your Answer:</span>
          <div style="font-weight: 600; color: ${q.isCorrect ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-size: 0.95rem; margin-top: 0.15rem;">
            ${q.userAnswer}
          </div>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase;">Correct Answer:</span>
          <div style="font-weight: 600; color: var(--accent-success); font-size: 0.95rem; margin-top: 0.15rem;">
            ${q.correctAnswer}
          </div>
        </div>
      </div>

      <!-- Explanation & Concept details -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 8px; padding: 1rem;">
        <h5 style="color: ${q.isCorrect ? 'var(--accent-success)' : 'var(--accent-secondary)'}; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">
          ${q.isCorrect ? '✓ Correct Answer Analysis' : '✗ Wrong Answer Analysis'}
        </h5>
        <p style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.4; margin-bottom: 0.5rem;">
          ${q.explanation}
        </p>

        ${!q.isCorrect ? `
          <div style="margin-top: 0.5rem; border-top: 1px dashed var(--border-light); padding-top: 0.5rem;">
            <div style="font-size: 0.85rem; margin-bottom: 0.25rem;">
              <strong style="color: var(--accent-danger);">Concept to Improve:</strong>
              <span style="color: var(--text-secondary);">${q.conceptToImprove || q.concept}</span>
            </div>
            <div style="font-size: 0.85rem;">
              <strong style="color: var(--accent-secondary);">Recommendation:</strong>
              <span style="color: var(--text-secondary);">${q.recommendation || 'Practice related exercises.'}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}
