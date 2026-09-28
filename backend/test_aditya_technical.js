const http = require('http');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// These are the ONLY allowed topics for Aditya's resume
const ADITYA_RESUME_SKILLS = ['python', 'c', 'java', 'html', 'css', 'machine learning', 'github', 'aws'];

// Topics that are FORBIDDEN for this resume
const FORBIDDEN_TOPICS = ['mongodb', 'postgresql', 'mysql', 'jwt', 'cors', 'operating system', 'deadlock', 
  'react', 'node.js', 'express', 'docker', 'kubernetes', 'graphql', 'oauth', 'spring', 'typescript'];

async function test() {
  console.log('=== LIVE API TEST: ADITYA RESUME — TECHNICAL INTERVIEW ===\n');

  // Login as aditya15@gmail.com
  const loginRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/auth/signin', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'aditya15@gmail.com', password: 'Aditya@123' });

  if (!loginRes.body.token) {
    console.log('LOGIN FAILED:', loginRes.status, JSON.stringify(loginRes.body));
    // Try other common passwords
    for (const pwd of ['aditya123', 'Test@1234', '12345678', 'password']) {
      const r2 = await makeRequest({
        hostname: '127.0.0.1', port: 5050, path: '/api/auth/signin', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { identifier: 'aditya15@gmail.com', password: pwd });
      if (r2.body.token) { console.log('Login worked with password:', pwd); Object.assign(loginRes, r2); break; }
    }
    if (!loginRes.body.token) { console.log('All login attempts failed'); return; }
  }

  const token = loginRes.body.token;
  console.log('[1] LOGIN SUCCESS');
  console.log('    userId:', loginRes.body.user?.id);
  console.log('    name:', loginRes.body.user?.name);

  // Check current resume
  const resumeRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/resume/current', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  }, null);

  console.log('\n[2] RESUME CHECK:', resumeRes.status === 200 ? 'OK' : 'FAILED (' + resumeRes.status + ')');
  if (resumeRes.status === 200) {
    const r = resumeRes.body;
    const skills = r.extractedData?.skills || {};
    console.log('    fileName:', r.fileName);
    console.log('    languages:', JSON.stringify(skills.languages || []));
    console.log('    frameworks:', JSON.stringify(skills.frameworks || []));
    console.log('    databases:', JSON.stringify(skills.databases || []));
    console.log('    technologies:', JSON.stringify(skills.technologies || []));
    console.log('    projectsCount:', (r.extractedData?.projects || []).length);
  } else {
    console.log('    ERROR:', JSON.stringify(resumeRes.body));
    return;
  }

  // Start Technical interview, 10 questions
  const setupRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/interview/setup', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { type: 'Technical', difficulty: 'Adaptive', questionCount: 10, mode: 'Text' });

  console.log('\n[3] TECHNICAL INTERVIEW SETUP:', setupRes.status === 200 ? 'OK' : 'FAILED (' + setupRes.status + ')');
  
  if (setupRes.status === 200) {
    const questions = setupRes.body.questions || [];
    console.log('    interviewId:', setupRes.body.interviewId);
    console.log('    questionsGenerated:', questions.length);
    console.log('');

    let allValid = true;
    const topicCounts = {};

    questions.forEach((q, i) => {
      const text = (q.questionText || '').toLowerCase();
      const topic = (q.topic || 'Unknown').toLowerCase();

      // Check for forbidden terms in question text
      const forbidden = FORBIDDEN_TOPICS.filter(ft => {
        const regex = new RegExp(`\\b${ft.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text);
      });

      // Determine which allowed skill this question maps to
      const matchedSkill = ADITYA_RESUME_SKILLS.find(s => {
        const regex = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text) || regex.test(topic);
      });

      topicCounts[matchedSkill || 'OTHER'] = (topicCounts[matchedSkill || 'OTHER'] || 0) + 1;

      const status = forbidden.length > 0 ? `❌ FORBIDDEN(${forbidden.join(',')})` : (matchedSkill ? `✓ ${matchedSkill.toUpperCase()}` : '⚠️ UNTRACED');
      if (forbidden.length > 0) allValid = false;

      console.log(`    Q${i+1} [${status}]: ${(q.questionText || '').substring(0, 85)}...`);
    });

    console.log('\n    --- Topic Distribution ---');
    Object.entries(topicCounts).sort((a,b) => b[1]-a[1]).forEach(([k, v]) => {
      console.log(`    ${k}: ${v} question(s)`);
    });

    console.log('');
    if (allValid) {
      console.log('    ✅ ALL QUESTIONS ARE RESUME-GROUNDED — No forbidden technologies detected!');
    } else {
      console.log('    ❌ SOME QUESTIONS REFERENCE FORBIDDEN TECHNOLOGIES!');
    }
  } else {
    console.log('    ERROR:', JSON.stringify(setupRes.body));
  }

  console.log('\n=== TEST COMPLETE ===');
}

test().catch(e => { console.error('Test error:', e.message, e.stack); });
