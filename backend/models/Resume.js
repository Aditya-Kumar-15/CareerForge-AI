const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, default: 'application/pdf' },
  filePath: { type: String },
  fileBuffer: { type: Buffer },
  rawText: { type: String, required: true },
  extractedData: {
    skills: {
      languages: [{ type: String }],
      frameworks: [{ type: String }],
      databases: [{ type: String }],
      technologies: [{ type: String }]
    },
    projects: [{
      name: { type: String },
      description: { type: String },
      technologies: [{ type: String }],
      role: { type: String },
      functionality: { type: String },
      technicalAreas: [{ type: String }]
    }],
    certifications: [{
      name: { type: String },
      domain: { type: String }
    }],
    experience: [{
      company: { type: String },
      role: { type: String },
      responsibilities: { type: String },
      technologies: [{ type: String }]
    }]
  },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Resume', resumeSchema);
