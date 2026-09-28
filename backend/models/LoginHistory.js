const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  loginTime: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String }
});

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
