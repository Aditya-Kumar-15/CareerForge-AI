const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const Interview = require('./backend/models/Interview');
const Resume = require('./backend/models/Resume');
const Student = require('./backend/models/Student');
const QuestionHistory = require('./backend/models/QuestionHistory');
const interviewController = require('./backend/controllers/interviewController');
const { isDuplicateQuestion } = require('./backend/utils/questionDeduplicator');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal');
  console.log('Connected to MongoDB');

  // Find or create test student
  let student = await Student.findOne({ email: 'test_norepeat@careerforge.ai' });
  if (!student) {
    student = await Student.create({
      fullName: 'Test NoRepeat Candidate',
      email: 'test_norepeat@careerforge.ai',
      password: 'password123',
      college: 'Test University',
      department: 'Computer Science',
      year: 4,
      rollNo: 'TEST100'
    });
  }

  // Ensure verified resume
  let resume = await Resume.findOne({ studentId: student._id });
  if (!resume) {
    resume = await Resume.create({
      studentId: student._id,
      verified: true,
      rawText: 'Python JavaScript React MongoDB Express REST API Git',
      extractedData: {
        skills: {
          languages: ['Python', 'JavaScript'],
          frameworks: ['React', 'Express'],
          databases: ['MongoDB'],
          technologies: ['REST API', 'Git']
        },
        projects: [
          { name: 'Student Portal Platform', functionality: 'Full stack student management portal', technologies: ['React', 'MongoDB'] }
        ]
      }
    });
  } else if (!resume.verified) {
    resume.verified = true;
    await resume.save();
  }

  // Clear previous test records for clean run
  await QuestionHistory.deleteMany({ studentId: student._id });
  await Interview.deleteMany({ studentId: student._id });

  function createReqRes() {
    let resObj = {};
    const req = {
      user: { id: student._id.toString() },
      body: { type: 'Mixed', difficulty: 'Adaptive', questionCount: 10, mode: 'Text' }
    };
    const res = {
      status: (code) => { resObj.statusCode = code; return res; },
      json: (data) => { resObj.body = data; return res; }
    };
    return { req, res, getResult: () => resObj };
  }

  // Attempt 1
  console.log('\n--- CREATING ATTEMPT 1 ---');
  const t1 = createReqRes();
  await interviewController.setupInterview(t1.req, t1.res);
  const body1 = t1.getResult().body;
  if (!body1.questions) {
    console.error("Attempt 1 Error:", body1);
    process.exit(1);
  }
  const q1 = body1.questions.map(q => q.questionText);
  console.log('Attempt 1 ID:', body1.interviewId);
  console.log('Attempt 1 Qs Count:', q1.length);
  q1.forEach((q, i) => console.log(`  Q${i+1}: ${q}`));

  // Attempt 2
  console.log('\n--- CREATING ATTEMPT 2 ---');
  const t2 = createReqRes();
  await interviewController.setupInterview(t2.req, t2.res);
  const body2 = t2.getResult().body;
  if (!body2.questions) {
    console.error("Attempt 2 Error:", body2);
    process.exit(1);
  }
  const q2 = body2.questions.map(q => q.questionText);
  console.log('Attempt 2 ID:', body2.interviewId);
  console.log('Attempt 2 Qs Count:', q2.length);
  q2.forEach((q, i) => console.log(`  Q${i+1}: ${q}`));

  // Compare Attempt 1 vs Attempt 2
  let dups12 = 0;
  q2.forEach((q, i) => {
    if (isDuplicateQuestion(q, q1)) {
      dups12++;
      console.log(`  [ATTEMPT 2 DUP]: Q${i+1}: ${q}`);
    }
  });
  console.log(`\nAttempt 1 vs Attempt 2 Duplicates: ${dups12}`);

  // Attempt 3
  console.log('\n--- CREATING ATTEMPT 3 ---');
  const t3 = createReqRes();
  await interviewController.setupInterview(t3.req, t3.res);
  const body3 = t3.getResult().body;
  if (!body3.questions) {
    console.error("Attempt 3 Error:", body3);
    process.exit(1);
  }
  const q3 = body3.questions.map(q => q.questionText);
  console.log('Attempt 3 ID:', body3.interviewId);
  console.log('Attempt 3 Qs Count:', q3.length);
  q3.forEach((q, i) => console.log(`  Q${i+1}: ${q}`));

  let dups123 = 0;
  const past12 = [...q1, ...q2];
  q3.forEach((q, i) => {
    if (isDuplicateQuestion(q, past12)) {
      dups123++;
      console.log(`  [ATTEMPT 3 DUP]: Q${i+1}: ${q}`);
    }
  });
  console.log(`\nAttempt 3 vs (Attempt 1 & 2) Duplicates: ${dups123}`);

  await mongoose.disconnect();
}

test().catch(err => { console.error(err); process.exit(1); });
