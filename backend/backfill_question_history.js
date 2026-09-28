/**
 * BACKFILL SCRIPT: Save all past Interview questions into QuestionHistory
 * This ensures the global no-repeat system covers all historical exam questions.
 * 
 * Run once: node backfill_question_history.js
 */

const mongoose = require('mongoose');
const { normalizeText, extractConceptKey } = require('./utils/questionDeduplicator');

mongoose.connect('mongodb://127.0.0.1:27017/college_portal').then(async () => {
  const Interview = require('./models/Interview');
  const QuestionHistory = require('./models/QuestionHistory');

  console.log('=== QUESTION HISTORY BACKFILL ===\n');

  // Get all interviews
  const allInterviews = await Interview.find({}).lean();
  console.log(`Found ${allInterviews.length} total interviews across all users.\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalError = 0;

  for (const iv of allInterviews) {
    if (!iv.questions || iv.questions.length === 0) continue;
    
    const studentId = iv.studentId;
    const interviewId = iv._id;
    const interviewType = iv.config?.type || iv.type || 'Mixed';
    const difficulty = iv.config?.difficulty || 'Medium';

    for (const q of iv.questions) {
      if (!q.questionText || q.questionText.includes('skipped due to security')) continue;

      try {
        // Check if already exists for this student+text combination
        const existing = await QuestionHistory.findOne({
          studentId: studentId,
          normalizedText: normalizeText(q.questionText)
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        await QuestionHistory.create({
          studentId: studentId,
          interviewId: interviewId,
          questionText: q.questionText,
          normalizedText: normalizeText(q.questionText),
          conceptKey: extractConceptKey(q.questionText),
          category: q.category || 'Technical Skills',
          topic: q.topic || 'General',
          difficulty: q.difficulty || difficulty,
          interviewType: interviewType,
          createdAt: iv.createdAt || new Date()
        });

        totalInserted++;
      } catch (e) {
        if (e.code === 11000) { totalSkipped++; } // duplicate key
        else { console.error('Error inserting:', e.message); totalError++; }
      }
    }
  }

  console.log(`Backfill complete:`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped (already exists): ${totalSkipped}`);
  console.log(`  Errors: ${totalError}`);

  // Show per-user summary
  const studentIds = [...new Set(allInterviews.map(iv => iv.studentId?.toString()).filter(Boolean))];
  console.log(`\nPer-user QuestionHistory counts:`);
  for (const sid of studentIds) {
    const count = await QuestionHistory.countDocuments({ studentId: new mongoose.Types.ObjectId(sid) });
    console.log(`  ${sid}: ${count} questions in history`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}).catch(e => { console.error(e); process.exit(1); });
