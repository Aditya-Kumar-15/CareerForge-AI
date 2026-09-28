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

async function test() {
  console.log('=== LIVE API TEST FOR ANJANEYULU RESUME FLOW ===\n');

  // Login as s@gmail.com
  const loginRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/auth/signin', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 's@gmail.com', password: 'Test@1234' });

  if (!loginRes.body.token) {
    console.log('LOGIN FAILED:', loginRes.status, JSON.stringify(loginRes.body));
    return;
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
    const projCount = r.extractedData?.projects?.length || 0;
    const projNames = (r.extractedData?.projects || []).map(p => p?.name || p);
    console.log('    fileName:', r.fileName);
    console.log('    verified:', r.verified);
    console.log('    projectsCount:', projCount);
    console.log('    projectNames:', JSON.stringify(projNames));
  } else {
    console.log('    ERROR:', JSON.stringify(resumeRes.body));
    return;
  }

  // Test reparse endpoint
  const reparseRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/resume/reparse', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});

  console.log('\n[3] REPARSE ENDPOINT:', reparseRes.status === 200 ? 'OK' : 'FAILED (' + reparseRes.status + ')');
  if (reparseRes.status === 200) {
    const d = reparseRes.body;
    console.log('    message:', d.message);
    console.log('    projectsCount:', d.debug?.projectsCount);
    console.log('    projectNames:', JSON.stringify(d.debug?.projectNames));
    console.log('    verified:', d.resume?.verified);
  } else {
    console.log('    ERROR:', JSON.stringify(reparseRes.body));
  }

  // Test interview setup (Project-based, 5 questions)
  const setupRes = await makeRequest({
    hostname: '127.0.0.1', port: 5050, path: '/api/interview/setup', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { type: 'Project-based', difficulty: 'Adaptive', questionCount: 5, mode: 'Text' });

  console.log('\n[4] INTERVIEW SETUP:', setupRes.status === 200 ? 'OK' : 'FAILED (' + setupRes.status + ')');
  const b = setupRes.body;
  if (setupRes.status === 200) {
    const questions = b.questions || [];
    console.log('    interviewId:', b.interviewId);
    console.log('    questionsGenerated:', questions.length);
    
    const realProjects = ['MedTrack', 'Library Management System', 'Crypto Info Tracker', 'Wikipedia Search', 'Snake Game', 'Farm 2 Home Web Page'];
    const fakeProjectNames = ['CareerForge Platform', 'Candidate Project', 'E-Commerce Platform', 'Student Portal Platform'];
    let hasFake = false;
    let hasRealRef = false;
    
    questions.forEach((q, i) => {
      const text = q.questionText || '';
      const isFake = fakeProjectNames.some(fp => text.includes(fp));
      const isReal = realProjects.some(rp => text.includes(rp));
      if (isFake) hasFake = true;
      if (isReal) hasRealRef = true;
      console.log('    Q' + (i+1) + (isFake ? ' [FAKE!]' : '') + (isReal ? ' [REAL✓]' : '') + ': ' + text.substring(0, 100));
    });
    
    console.log('');
    if (hasFake) {
      console.log('    ❌ FAKE PROJECT NAMES DETECTED IN QUESTIONS!');
    } else {
      console.log('    ✓ No fake project names detected!');
    }
    if (hasRealRef) {
      console.log('    ✓ Questions reference REAL projects from Anjaneyulu resume!');
    }
  } else {
    console.log('    ERROR:', JSON.stringify(b));
  }

  console.log('\n=== TEST COMPLETE ===');
}

test().catch(e => { console.error('Test error:', e.message, e.stack); });
