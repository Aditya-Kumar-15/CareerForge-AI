const mongoose = require('mongoose');

const pendingVerificationSchema = new mongoose.Schema({
  verificationToken: { type: String, required: true, unique: true },
  verificationMethod: { type: String, enum: ['email', 'mobile'], default: 'email' },
  name: { type: String, required: true, trim: true },
  rollNo: { type: String, required: true, uppercase: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  originalEmail: { type: String, required: true, lowercase: true, trim: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  college: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  hashedPassword: { type: String, required: true },
  otpHash: { type: String }, // Hashed single OTP for chosen method
  emailOtpHash: { type: String }, // Legacy/dual fallback
  mobileOtpHash: { type: String }, // Legacy/dual fallback
  otpExpiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastResendAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Document automatically expires after expiry date
pendingVerificationSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingVerification', pendingVerificationSchema);
