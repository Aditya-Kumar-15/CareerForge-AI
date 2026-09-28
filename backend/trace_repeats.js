const mongoose = require('mongoose');
const { isDuplicateQuestion, normalizeText } = require('./utils/questionDeduplicator');

mongoose.connect('mongodb://127.0.0.1:27017/college_portal').then(async () => {
  const QuestionHistory = require('./models/QuestionHistory');
  const Interview = require('./models/Interview');
  const Student = require('./models/Student');

  const aditya = await Student.findOne({ email: 'aditya15@gmail.com' });
  const userId = aditya._id;

  // The two repeated questions
  const Q1 = "When developing software with Python, how do you address design patterns and modularity in production environments?";
  const Q2 = "When developing software with C, how do you address performance profiling and monitoring in production environments?";

  console.log('=== ROOT CAUSE TRACE ===\n');
  console.log('Q1:', Q1);
  console.log('Q2:', Q2);

  // Load all questions from QuestionHistory for this user
  const mongoose2 = mongoose;
  const studentObjId = new mongoose2.Types.ObjectId(userId);
  
  const historyRecords = await QuestionHistory.find({
    $or: [{ studentId: userId }, { studentId: studentObjId }]
  }).select('questionText interviewId createdAt').lean();

  console.log('\n--- QuestionHistory records for Aditya:', historyRecords.length);
  historyRecords.forEach(r => console.log('  hist:', r.questionText.substring(0,70), '| interviewId:', r.interviewId));

  // Load all past Interview questions
  const pastInterviews = await Interview.find({
    $or: [{ studentId: userId }, { studentId: studentObjId }]
  }).select('questions.questionText _id createdAt').lean();

  const pastIvQuestions = [];
  pastInterviews.forEach(iv => {
    (iv.questions||[]).forEach(q => { if(q.questionText) pastIvQuestions.push(q.questionText); });
  });

  console.log('\n--- All past Interview question texts:', pastIvQuestions.length);
  
  // Check if Q1 and Q2 are in the history or past interviews (exact match)
  const allHistory = [...historyRecords.map(r=>r.questionText), ...pastIvQuestions];
  
  const Q1_exact = allHistory.some(h => h.toLowerCase().trim() === Q1.toLowerCase().trim());
  const Q2_exact = allHistory.some(h => h.toLowerCase().trim() === Q2.toLowerCase().trim());
  console.log('\nQ1 in history (exact match):', Q1_exact);
  console.log('Q2 in history (exact match):', Q2_exact);

  // Check Jaccard similarity of Q1/Q2 against history
  const Q1_jaccard = allHistory.map(h => {
    const sim = require('./utils/questionDeduplicator').calculateJaccardSimilarity(Q1, h);
    return { sim, text: h.substring(0,60) };
  }).filter(x => x.sim > 0.2).sort((a,b) => b.sim - a.sim);
  
  const Q2_jaccard = allHistory.map(h => {
    const sim = require('./utils/questionDeduplicator').calculateJaccardSimilarity(Q2, h);
    return { sim, text: h.substring(0,60) };
  }).filter(x => x.sim > 0.2).sort((a,b) => b.sim - a.sim);
  
  console.log('\nQ1 best Jaccard similarity matches:');
  Q1_jaccard.slice(0,5).forEach(x => console.log(`  sim=${x.sim.toFixed(3)}: "${x.text}"`));
  console.log('\nQ2 best Jaccard similarity matches:');
  Q2_jaccard.slice(0,5).forEach(x => console.log(`  sim=${x.sim.toFixed(3)}: "${x.text}"`));
  
  // The question: are Q1/Q2 detected as duplicates when ALL history is loaded?
  const Q1_detected = isDuplicateQuestion(Q1, allHistory);
  const Q2_detected = isDuplicateQuestion(Q2, allHistory);
  console.log('\nQ1 detected as duplicate by isDuplicateQuestion:', Q1_detected);
  console.log('Q2 detected as duplicate by isDuplicateQuestion:', Q2_detected);

  // Check normalizations
  console.log('\nQ1 normalized:', normalizeText(Q1));
  console.log('Q2 normalized:', normalizeText(Q2));

  // FIND the specific interviews that both questions appear in (from Interview collection)
  const matchingIvs = pastInterviews.filter(iv =>
    (iv.questions||[]).some(q => 
      /(design patterns and modularity|performance profiling and monitoring)/i.test(q.questionText||'')
    )
  );
  
  console.log('\n--- Interviews containing Q1 or Q2:', matchingIvs.length);
  matchingIvs.forEach(iv => {
    console.log('  interviewId:', iv._id, '| date:', iv.createdAt?.toISOString());
    (iv.questions||[]).filter(q => /(design patterns|performance profiling)/i.test(q.questionText||'')).forEach(q => {
      console.log('    MATCH:', q.questionText);
    });
  });

  // NOW: Simulate what interviewController does to build history
  const userHistoryQuestions = [];
  historyRecords.forEach(r => { if (r.questionText) userHistoryQuestions.push(r.questionText); });
  pastInterviews.forEach(inv => {
    (inv.questions||[]).forEach(q => { if (q.questionText) userHistoryQuestions.push(q.questionText); });
  });
  
  console.log('\n--- Combined history that interview controller builds:', userHistoryQuestions.length, 'entries');
  
  // Check if duplicates would be caught with this history
  const Q1_wouldBeCaught = isDuplicateQuestion(Q1, userHistoryQuestions);
  const Q2_wouldBeCaught = isDuplicateQuestion(Q2, userHistoryQuestions);
  console.log('Q1 would be caught by combined history:', Q1_wouldBeCaught);
  console.log('Q2 would be caught by combined history:', Q2_wouldBeCaught);

  // Test: what is the ACTUAL content of the current interview (6ab3b95a27087ff07a08dd2c)?
  // vs the test we just ran
  const allIvQuestions = [];
  pastInterviews.forEach(iv => {
    (iv.questions||[]).forEach(q => {
      if(/(design patterns|performance profiling)/i.test(q.questionText||'')) {
        allIvQuestions.push({ iv: iv._id.toString(), q: q.questionText, date: iv.createdAt });
      }
    });
  });
  console.log('\n--- All occurrences of Q1/Q2 in any interview:');
  allIvQuestions.forEach(x => console.log('  IV:', x.iv, '| date:', x.date?.toISOString(), '| q:', x.q));

  await mongoose.disconnect();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
