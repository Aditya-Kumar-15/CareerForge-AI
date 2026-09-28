const mongoose = require('mongoose');

const questionHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
  questionText: { type: String, required: true },
  normalizedText: { type: String, required: true, index: true },
  conceptKey: { type: String, required: true, index: true },
  category: { type: String, required: true },
  topic: { type: String, required: true },
  difficulty: { type: String, required: true },
  interviewType: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('QuestionHistory', questionHistorySchema);
