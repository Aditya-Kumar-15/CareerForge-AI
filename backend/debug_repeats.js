const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/college_portal').then(async () => {
  const QuestionHistory = require('./models/QuestionHistory');
  const Interview = require('./models/Interview');
  const Student = require('./models/Student');

  const aditya = await Student.findOne({ email: 'aditya15@gmail.com' });
  console.log('=== ADITYA DEBUG ===');
  console.log('userId:', aditya._id.toString());

  // Count all QuestionHistory records for aditya
  const histCount = await QuestionHistory.countDocuments({ studentId: aditya._id });
  console.log('QuestionHistory total records:', histCount);

  // Check if the two repeated questions exist in QuestionHistory
  const allHist = await QuestionHistory.find({ studentId: aditya._id }).lean();
  const q1Matches = allHist.filter(q => /design patterns and modularity/i.test(q.questionText || ''));
  const q2Matches = allHist.filter(q => /performance profiling and monitoring/i.test(q.questionText || ''));
  
  console.log('\nQ1 "design patterns" in QuestionHistory:', q1Matches.length, 'records');
  q1Matches.forEach(q => {
    console.log('  interviewId:', q.interviewId?.toString());
    console.log('  text:', q.questionText);
    console.log('  hash:', q.questionHash);
  });

  console.log('\nQ2 "performance profiling" in QuestionHistory:', q2Matches.length, 'records');
  q2Matches.forEach(q => {
    console.log('  interviewId:', q.interviewId?.toString());
    console.log('  text:', q.questionText);
    console.log('  hash:', q.questionHash);
  });

  // Show ALL interviews for aditya (newest first)
  const interviews = await Interview.find({ studentId: aditya._id }).sort({ createdAt: -1 }).limit(15).lean();
  console.log('\n=== ALL ADITYA INTERVIEWS ===');
  interviews.forEach((iv, i) => {
    const qs = iv.questions || [];
    console.log(`\n[${i+1}] ID: ${iv._id} | type: ${iv.type} | diff: ${iv.difficulty} | date: ${iv.createdAt?.toISOString()} | qCount: ${qs.length}`);
    qs.forEach((q, qi) => {
      const flag = /(design patterns|performance profiling)/i.test(q.questionText || '') ? ' <<< REPEATED' : '';
      console.log(`  Q${qi+1}: ${(q.questionText||'').substring(0,90)}${flag}`);
    });
  });

  // Find which two interviews contain the repeated questions
  console.log('\n=== REPEAT TRACE ===');
  const interviewsWithQ1 = interviews.filter(iv => 
    (iv.questions||[]).some(q => /design patterns and modularity/i.test(q.questionText||''))
  );
  const interviewsWithQ2 = interviews.filter(iv => 
    (iv.questions||[]).some(q => /performance profiling and monitoring/i.test(q.questionText||''))
  );
  
  console.log('Q1 appears in', interviewsWithQ1.length, 'interviews:');
  interviewsWithQ1.forEach(iv => console.log('  ', iv._id.toString(), iv.createdAt?.toISOString()));
  
  console.log('Q2 appears in', interviewsWithQ2.length, 'interviews:');
  interviewsWithQ2.forEach(iv => console.log('  ', iv._id.toString(), iv.createdAt?.toISOString()));

  // Check QuestionHistory schema
  console.log('\n=== QuestionHistory SCHEMA FIELDS ===');
  if (allHist.length > 0) {
    console.log('Sample record keys:', Object.keys(allHist[0]).join(', '));
    console.log('Sample record:', JSON.stringify(allHist[0], null, 2));
  } else {
    console.log('NO records in QuestionHistory for Aditya!');
  }

  await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
