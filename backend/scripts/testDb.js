const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('../models/Student');
const Resume = require('../models/Resume');
const Interview = require('../models/Interview');

dotenv.config();

const test = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal';
  console.log(`Connecting to: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri);
    console.log('Mongoose Connection: SUCCESS!');
    
    // Check tables counts
    const studCount = await Student.countDocuments();
    const resCount = await Resume.countDocuments();
    const intCount = await Interview.countDocuments();
    
    console.log(`Database Status:`);
    console.log(`  - Students: ${studCount}`);
    console.log(`  - Resumes: ${resCount}`);
    console.log(`  - Interviews: ${intCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`Database Connection: FAIL! Details: ${error.message}`);
    process.exit(1);
  }
};

test();
