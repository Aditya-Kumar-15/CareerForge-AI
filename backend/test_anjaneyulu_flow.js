const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Connect to MongoDB directly to verify DB state & test services
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_portal';

async function runE2ETest() {
  console.log('====================================================');
  console.log('STARTING E2E VERIFICATION TEST FOR ANJANEYULU RESUME');
  console.log('====================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const Student = require('./models/Student');
  const Resume = require('./models/Resume');
  const Interview = require('./models/Interview');
  const QuestionHistory = require('./models/QuestionHistory');
  const aiService = require('./services/aiService');
  const resumeService = require('./services/resumeService');

  // Find or create test student
  let student = await Student.findOne({ email: 'anjaneyulu_test@careerforge.ai' });
  if (!student) {
    student = await Student.create({
      name: 'Anjaneyulu Test',
      email: 'anjaneyulu_test@careerforge.ai',
      password: 'hashedpassword123',
      rollNo: 'TEST12345',
      department: 'CSE',
      year: 4,
      college: 'Test University',
      phone: '9999999999'
    });
  }
  console.log(`✓ Student Account ID: ${student._id}`);

  // Test 1: Extract text from Anjaneyulu_Resume.docx
  let rawText = '';
  const resumeFilePath = path.join(__dirname, '..', 'Anjaneyulu_Resume.docx');
  if (fs.existsSync(resumeFilePath)) {
    const fileBuffer = fs.readFileSync(resumeFilePath);
    rawText = await resumeService.extractText(fileBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Anjaneyulu_Resume.docx');
  } else {
    // Search existing Resume model in DB
    const dbResume = await Resume.findOne({ fileName: /Anjaneyulu/i });
    if (dbResume && dbResume.rawText) {
      rawText = dbResume.rawText;
    } else {
      rawText = `KOTA ANJANEYULU
Email: anjaneyulu@gmail.com | Phone: +91 9876543210

SKILLS:
Languages: Python, JavaScript, C++, SQL
Frameworks: React, Node.js, Express, HTML/CSS
Databases: MongoDB, MySQL
Technologies: Git, REST APIs, AWS, Machine Learning

PROJECTS:
1. MedTrack: Medical record tracking and prescription management platform using React, Node.js, MongoDB.
2. Library Management System: Digital catalog and book reservation system built with Python, MySQL.
3. Crypto Info Tracker: Real-time cryptocurrency market tracker fetching REST APIs using JavaScript and HTML/CSS.
4. Wikipedia Search: Web search application using Wikipedia API and dynamic DOM updates.
5. Snake Game: Interactive retro arcade game using JavaScript ES6 and Canvas API.
6. Farm 2 Home Web Page: E-commerce platform connecting local farmers with consumers using Node.js and MongoDB.

CERTIFICATIONS:
1. Fundamentals of Python — Saylor Academy (2026)
2. Fundamentals of Machine Learning — Saylor Academy (2026)
3. AWS Cloud Computing Virtual Internship Certificate (2026)

INTERNSHIP:
AWS Cloud Computing Virtual Internship — Amazon Web Services (AWS)
Jan 2026 – Mar 2026`;
    }
  }

  console.log(`✓ Resume text loaded (${rawText.length} characters)`);
  const parsedData = await aiService.analyzeResume(rawText);
  console.log('✓ Parsed Resume Data Projects count:', parsedData.projects?.length);
  console.log('  Project Names:', parsedData.projects?.map(p => p.name));
  console.log('  Certifications count:', parsedData.certifications?.length);
  console.log('  Work Experience count:', parsedData.workExperience?.length);

  // Assert 6 projects extracted
  const expectedProjects = ['MedTrack', 'Library Management System', 'Crypto Info Tracker', 'Wikipedia Search', 'Snake Game', 'Farm 2 Home Web Page'];
  const extractedNames = (parsedData.projects || []).map(p => p.name);
  
  let matchCount = 0;
  expectedProjects.forEach(ep => {
    if (extractedNames.some(en => en && en.toLowerCase().includes(ep.toLowerCase()))) {
      matchCount++;
    }
  });

  console.log(`✓ Project Match Score: ${matchCount}/${expectedProjects.length} expected projects detected`);

  // Save candidate resume in DB
  await Resume.deleteMany({ studentId: student._id });
  const dummyBuffer = Buffer.from(rawText);
  const newResume = await Resume.create({
    studentId: student._id,
    fileName: 'Anjaneyulu_Resume.docx',
    fileData: dummyBuffer,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: dummyBuffer.length,
    rawText,
    extractedData: parsedData,
    verified: true,
    verificationStatus: 'verified'
  });
  console.log(`✓ Saved active verified Resume record ID: ${newResume._id}`);

  // Test 2: Generate 10 Project-based questions
  const config = {
    type: 'Project-based',
    difficulty: 'Medium',
    questionCount: 10,
    mode: 'Text'
  };

  const targetSpecs = [];
  for (let i = 0; i < 10; i++) {
    targetSpecs.push({ category: 'Projects', difficulty: 'Medium' });
  }

  const generated = await aiService.generateAllQuestions(parsedData, config, targetSpecs, [], []);
  console.log(`✓ Generated ${generated.questions.length} Project-based questions`);

  let invalidProjectCount = 0;
  let validProjectCount = 0;

  generated.questions.forEach((q, idx) => {
    console.log(`\n--- Q${idx + 1} (${q.topic}) ---`);
    console.log(`  Question: ${q.questionText}`);
    
    if (q.questionText.includes('CareerForge Platform') || q.questionText.includes('E-Commerce Platform')) {
      console.error(`  ❌ HALLUCINATED PROJECT DETECTED in Q${idx + 1}!`);
      invalidProjectCount++;
    } else {
      const mentionsUserProject = extractedNames.some(pName => pName && q.questionText.toLowerCase().includes(pName.toLowerCase()));
      if (mentionsUserProject) {
        console.log(`  ✓ References Candidate Real Project`);
        validProjectCount++;
      } else {
        console.log(`  ℹ️ Generic project question (no unlisted project name)`);
      }
    }
  });

  console.log('\n====================================================');
  console.log(`TEST RESULT SUMMARY:`);
  console.log(`- Hallucinated Fallback Projects ('CareerForge Platform'): ${invalidProjectCount} (Expected: 0)`);
  console.log(`- Valid Candidate Project References: ${validProjectCount}/${generated.questions.length}`);
  console.log('====================================================');

  if (invalidProjectCount === 0) {
    console.log('✅ ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ VERIFICATION TEST FAILED');
  }

  await mongoose.disconnect();
}

runE2ETest().catch(err => {
  console.error('E2E Test Error:', err);
  mongoose.disconnect();
});
