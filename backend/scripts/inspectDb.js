const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('../models/Student');
const Resume = require('../models/Resume');
const Interview = require('../models/Interview');

dotenv.config();

const inspect = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal';
  try {
    await mongoose.connect(mongoUri);
    console.log('Database Connected Successfully.');

    const students = await Student.find({}, 'name email role');
    console.log('\n--- Students ---');
    console.log(students);

    const resumes = await Resume.find({});
    console.log('\n--- Resumes ---');
    resumes.forEach(r => {
      console.log(`ID: ${r._id}, StudentId: ${r.studentId}, fileName: ${r.fileName}, verified: ${r.verified}`);
      console.log('Extracted Skills:', JSON.stringify(r.extractedData ? r.extractedData.skills : {}, null, 2));
    });

    const activeInterviews = await Interview.find({ status: 'active' });
    console.log('\n--- Active Interviews ---');
    activeInterviews.forEach(i => {
      console.log(`ID: ${i._id}, StudentId: ${i.studentId}, status: ${i.status}, currentQuestionIndex: ${i.currentQuestionIndex}`);
      console.log(`Questions count: ${i.questions.length}`);
      if (i.questions.length > 0) {
        console.log(`Current Question [${i.currentQuestionIndex}]:`, JSON.stringify(i.questions[i.currentQuestionIndex], null, 2));
      } else {
        console.log('No questions generated for this active interview!');
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
};

inspect();
