const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String },
  correctOption: { type: String },
  category: { type: String, required: true }, // Technical Skills, Projects, Technologies, Problem Solving, Resume/Experience
  difficulty: { type: String, required: true }, // Easy, Medium, Hard, Expert
  topic: { type: String, required: true }, // e.g. React, MongoDB, Git
  answerText: { type: String, default: '' },
  isCorrect: { type: Boolean, default: false },
  startTime: { type: Date },
  evaluation: {
    technicalAccuracy: { type: Number, default: 0 },
    relevance: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    overallScore: { type: Number, default: 0 },
    feedback: { type: String, default: '' }
  }
});

const interviewSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  config: {
    type: { type: String, enum: ['Technical', 'Project-based', 'Mixed'], default: 'Mixed' },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Adaptive'], default: 'Adaptive' },
    questionCount: { type: Number, default: 10 },
    mode: { type: String, enum: ['Text', 'Voice'], default: 'Text' }
  },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  currentQuestionIndex: { type: Number, default: 0 },
  questions: [questionSchema],
  integrityWarnings: { type: Number, default: 0 },
  finalReport: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
