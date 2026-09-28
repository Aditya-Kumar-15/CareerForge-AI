const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Interview = require('../models/Interview');
const Resume = require('../models/Resume');

dotenv.config();

const inspect = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal';
  try {
    await mongoose.connect(mongoUri);
    console.log('Database Connected.');

    const interviews = await Interview.find({ studentId: '6a7b337c84056450660a5206', status: 'completed' });
    console.log(`\nCompleted Interviews Count: ${interviews.length}`);
    
    interviews.forEach((i, idx) => {
      console.log(`\n--- Completed Interview #${idx + 1} ---`);
      console.log(`ID: ${i._id}`);
      console.log(`Created At: ${i.createdAt}`);
      console.log(`Questions Count: ${i.questions.length}`);
      console.log(`Integrity Warnings: ${i.integrityWarnings}`);
      console.log(`Config:`, JSON.stringify(i.config, null, 2));
      console.log(`Final Report:`, JSON.stringify(i.finalReport, null, 2));
    });

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
};

inspect();
