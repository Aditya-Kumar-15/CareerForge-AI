const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Resume = require('../models/Resume');
const Student = require('../models/Student');

async function inspectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const students = await Student.find({});
    console.log(`Total Students: ${students.length}`);
    students.forEach(s => console.log(` - Student: id=${s._id}, name="${s.name}", email="${s.email}", phone="${s.phone}"`));

    const resumes = await Resume.find({});
    console.log(`Total Resumes: ${resumes.length}`);
    resumes.forEach(r => {
      console.log(` - Resume: id=${r._id}, studentId=${r.studentId}, fileName="${r.fileName}", fileSize=${r.fileSize}, fileType="${r.fileType}", filePath="${r.filePath}", bufferLen=${r.fileBuffer ? r.fileBuffer.length : 0}`);
    });

  } catch (err) {
    console.error("Inspect DB Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectDB();
