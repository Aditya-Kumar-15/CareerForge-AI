const Student = require('../models/Student');
const PendingVerification = require('../models/PendingVerification');
const LoginHistory = require('../models/LoginHistory');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

// Helper to generate a 6-digit numeric OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Request Signup OTP (User chooses Email OR Mobile verification)
exports.requestSignupOtp = async (req, res) => {
  try {
    const { name, rollNo, email, department, year, college, phone, password, verificationMethod } = req.body;
    const method = (verificationMethod === 'mobile') ? 'mobile' : 'email';

    // Validate Required Inputs
    if (!name || !name.trim()) return res.status(400).json({ message: 'Full Name is required.' });
    if (!rollNo || !rollNo.trim()) return res.status(400).json({ message: 'Roll Number is required.' });
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: 'Please use a valid original email address.' });
    }
    if (!phone || !phone.trim() || phone.trim().replace(/\D/g, '').length < 10) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRollNo = rollNo.trim().toUpperCase();
    const normalizedPhone = phone.trim();

    // Check if Email or originalEmail is already registered in MongoDB
    const existingEmail = await Student.findOne({
      $or: [
        { email: normalizedEmail },
        { originalEmail: normalizedEmail }
      ]
    });
    if (existingEmail) {
      return res.status(400).json({ message: 'This email is already registered. Please sign in with your original registered email address.' });
    }

    // Check if Roll Number is already registered
    const existingRollNo = await Student.findOne({ rollNo: normalizedRollNo });
    if (existingRollNo) {
      return res.status(400).json({ message: 'This Roll Number is already registered.' });
    }

    // Check if Mobile Number is already registered
    const existingPhone = await Student.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ message: 'This Mobile Number is already registered.' });
    }

    // Generate single 6-digit OTP for chosen method
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(24).toString('hex');
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Delete any previous pending verifications for this email/phone/rollNo
    await PendingVerification.deleteMany({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
        { rollNo: normalizedRollNo }
      ]
    });

    const pending = new PendingVerification({
      verificationToken,
      verificationMethod: method,
      name: name.trim(),
      rollNo: normalizedRollNo,
      email: normalizedEmail,
      originalEmail: normalizedEmail,
      department,
      year: parseInt(year),
      college: college.trim(),
      phone: normalizedPhone,
      hashedPassword,
      otpHash,
      emailOtpHash: otpHash,
      mobileOtpHash: otpHash,
      otpExpiresAt,
      attempts: 0,
      lastResendAt: new Date()
    });

    await pending.save();

    // Dispatch OTP using selected service
    let deliveryResult = { success: false, providerConfigured: false };
    if (method === 'email') {
      deliveryResult = await emailService.sendOtpEmail(normalizedEmail, otp);
    } else {
      deliveryResult = await smsService.sendOtpSms(normalizedPhone, otp);
    }

    console.log(`\n==================================================`);
    console.log(`[SIGNUP OTP DISPATCH] Method: ${method.toUpperCase()}`);
    console.log(`  -> Candidate: ${pending.name}`);
    console.log(`  -> Target:    ${method === 'email' ? pending.email : pending.phone}`);
    console.log(`  -> Provider Configured: ${deliveryResult.providerConfigured ? 'YES' : 'NO'}`);
    console.log(`  -> Delivery Success:    ${deliveryResult.success ? 'YES' : 'NO'}`);
    console.log(`==================================================\n`);

    if (deliveryResult.success) {
      return res.status(200).json({
        message: `Verification OTP has been sent to ${method === 'email' ? pending.email : pending.phone} via ${method === 'email' ? 'Gmail SMTP' : 'SMS'}.`,
        verificationToken,
        verificationMethod: method,
        email: pending.email,
        phone: pending.phone,
        providerConfigured: true
      });
    }

    if (!deliveryResult.providerConfigured) {
      return res.status(400).json({
        message: deliveryResult.message || `Gmail SMTP credentials (SMTP_USER, SMTP_PASS) are not configured in backend/.env. Please configure your Gmail App Password.`,
        verificationToken,
        verificationMethod: method,
        email: pending.email,
        phone: pending.phone,
        providerConfigured: false
      });
    }

    return res.status(500).json({
      message: `Failed to deliver OTP to ${method === 'email' ? pending.email : pending.phone}: ${deliveryResult.error || 'SMTP delivery error'}.`,
      verificationToken,
      verificationMethod: method,
      providerConfigured: true
    });

  } catch (err) {
    console.error('Request Signup OTP Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 2. Resend Signup OTP
exports.resendSignupOtp = async (req, res) => {
  try {
    const { verificationToken, verificationMethod } = req.body;

    if (!verificationToken) {
      return res.status(400).json({ message: 'Missing verification token.' });
    }

    const pending = await PendingVerification.findOne({ verificationToken });
    if (!pending) {
      return res.status(400).json({ message: 'OTP verification session has expired. Please click Sign Up to try again.' });
    }

    // Rate Limit: 20 seconds between resends
    const timeSinceLastResend = (Date.now() - new Date(pending.lastResendAt).getTime()) / 1000;
    if (timeSinceLastResend < 20) {
      const waitSecs = Math.ceil(20 - timeSinceLastResend);
      return res.status(429).json({ message: `Please wait ${waitSecs} seconds before requesting a new OTP.` });
    }

    const method = (verificationMethod || pending.verificationMethod || 'email') === 'mobile' ? 'mobile' : 'email';
    pending.verificationMethod = method;

    const newOtp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const newOtpHash = await bcrypt.hash(newOtp, salt);

    pending.otpHash = newOtpHash;
    pending.emailOtpHash = newOtpHash;
    pending.mobileOtpHash = newOtpHash;
    pending.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    pending.lastResendAt = new Date();
    await pending.save();

    let deliveryResult = { success: false, providerConfigured: false };
    if (method === 'email') {
      deliveryResult = await emailService.sendOtpEmail(pending.email, newOtp);
    } else {
      deliveryResult = await smsService.sendOtpSms(pending.phone, newOtp);
    }

    console.log(`\n==================================================`);
    console.log(`[RESEND OTP DISPATCH] Method: ${method.toUpperCase()} for Candidate: ${pending.name}`);
    console.log(`  -> Target:   ${method === 'email' ? pending.email : pending.phone}`);
    console.log(`  -> Provider Configured: ${deliveryResult.providerConfigured ? 'YES' : 'NO'}`);
    console.log(`==================================================\n`);

    if (deliveryResult.success) {
      return res.status(200).json({
        message: `New verification OTP sent to your ${method === 'email' ? 'email address' : 'mobile number'}.`,
        verificationMethod: method,
        email: pending.email,
        phone: pending.phone,
        providerConfigured: true
      });
    }

    return res.status(400).json({
      message: deliveryResult.message || `Gmail SMTP credentials are not configured in backend/.env.`,
      verificationMethod: method,
      email: pending.email,
      phone: pending.phone,
      providerConfigured: false
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 3. Verify OTP and Create Account
exports.verifySignupOtp = async (req, res) => {
  try {
    const { verificationToken, otp, emailOtp, mobileOtp } = req.body;

    if (!verificationToken) {
      return res.status(400).json({ message: 'Missing verification token.' });
    }

    const pending = await PendingVerification.findOne({ verificationToken });

    if (!pending) {
      return res.status(400).json({
        message: 'Verification session expired. Please click Sign Up to try again.',
        expired: true
      });
    }

    // Check Expiration (5 minutes)
    if (Date.now() > new Date(pending.otpExpiresAt).getTime()) {
      await PendingVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({
        message: 'Verification OTP code has expired. Please request a new OTP.',
        expired: true
      });
    }

    // Rate Limit Attempt Count (Max 5 attempts allowed)
    if (pending.attempts >= 5) {
      await PendingVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({
        message: 'Exceeded maximum verification attempts (5/5). Please request a new OTP.',
        exceeded: true
      });
    }

    pending.attempts += 1;
    await pending.save();

    const cleanOtp = (otp || emailOtp || mobileOtp || '').toString().trim();

    if (!cleanOtp) {
      return res.status(400).json({ message: 'Please enter the 6-digit OTP code.' });
    }

    let isValid = false;

    if (pending.otpHash) {
      isValid = await bcrypt.compare(cleanOtp, pending.otpHash);
    }

    if (!isValid) {
      return res.status(400).json({
        message: `Invalid verification code. Please check and try again. (${5 - pending.attempts} attempts remaining)`,
        remainingAttempts: 5 - pending.attempts
      });
    }

    // OTP IS VALID -> CREATE STUDENT ACCOUNT
    const method = pending.verificationMethod || 'email';
    const isEmailVerified = (method === 'email');
    const isPhoneVerified = (method === 'mobile');

    // Final DB Uniqueness Check
    const existingEmail = await Student.findOne({
      $or: [{ email: pending.email }, { originalEmail: pending.email }]
    });
    if (existingEmail) {
      await PendingVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'This email is already registered. Please sign in with your original registered email address.' });
    }

    const existingPhone = await Student.findOne({ phone: pending.phone });
    if (existingPhone) {
      await PendingVerification.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'This Mobile Number is already registered.' });
    }

    // Save Student Account in MongoDB
    const student = new Student({
      name: pending.name,
      rollNo: pending.rollNo,
      email: pending.email,
      originalEmail: pending.originalEmail,
      department: pending.department,
      year: pending.year,
      college: pending.college,
      phone: pending.phone,
      password: pending.hashedPassword,
      isEmailVerified,
      isPhoneVerified
    });

    await student.save();
    await PendingVerification.deleteOne({ _id: pending._id });

    return res.status(201).json({
      success: true,
      message: `Account created successfully! ${method === 'email' ? 'Email' : 'Mobile number'} verified.`,
      verifiedMethod: method,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone
      }
    });

  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Direct Registration Endpoint (Creates Account immediately without OTP)
exports.signup = async (req, res) => {
  try {
    const { name, rollNo, email, department, year, college, phone, password } = req.body;

    // Validate Required Inputs
    if (!name || !name.trim()) return res.status(400).json({ message: 'Full Name is required.' });
    if (!rollNo || !rollNo.trim()) return res.status(400).json({ message: 'Roll Number is required.' });
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: 'Please use a valid original email address.' });
    }
    if (!phone || !phone.trim() || phone.trim().replace(/\D/g, '').length < 10) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRollNo = rollNo.trim().toUpperCase();
    const normalizedPhone = phone.trim();

    // Check if Email or originalEmail is already registered in MongoDB
    const existingEmail = await Student.findOne({
      $or: [
        { email: normalizedEmail },
        { originalEmail: normalizedEmail }
      ]
    });
    if (existingEmail) {
      return res.status(400).json({ message: 'This email is already registered. Please sign in with your original registered email address.' });
    }

    // Check if Roll Number is already registered
    const existingRollNo = await Student.findOne({ rollNo: normalizedRollNo });
    if (existingRollNo) {
      return res.status(400).json({ message: 'This Roll Number is already registered.' });
    }

    // Check if Mobile Number is already registered
    const existingPhone = await Student.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ message: 'This Mobile Number is already registered.' });
    }

    // Hash user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save Student Account directly in MongoDB
    const student = new Student({
      name: name.trim(),
      rollNo: normalizedRollNo,
      email: normalizedEmail,
      originalEmail: normalizedEmail,
      department,
      year: parseInt(year),
      college: college.trim(),
      phone: normalizedPhone,
      password: hashedPassword,
      isEmailVerified: true,
      isPhoneVerified: true
    });

    await student.save();

    console.log(`[DIRECT REGISTRATION SUCCESS] Student account created: ${student.name} (${student.email})`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! You can now sign in.',
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone
      }
    });

  } catch (err) {
    console.error('Direct Signup Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 5. Sign In
exports.signin = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please enter your registered email or roll number and password' });
    }

    const cleanIdentifier = identifier.trim();
    const isEmailInput = cleanIdentifier.includes('@');

    let student = null;

    if (isEmailInput) {
      const normalizedEmail = cleanIdentifier.toLowerCase();
      // Find student by original registered email or email field
      student = await Student.findOne({
        $or: [
          { email: normalizedEmail },
          { originalEmail: normalizedEmail }
        ]
      });

      if (!student) {
        return res.status(400).json({ message: 'Please use your original registered email address.' });
      }
    } else {
      const normalizedRollNo = cleanIdentifier.toUpperCase();
      student = await Student.findOne({ rollNo: normalizedRollNo });

      if (!student) {
        return res.status(400).json({ message: 'Invalid email or password.' });
      }
    }

    const validPass = await bcrypt.compare(password, student.password);
    if (!validPass) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: student.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Save Login History entry
    await LoginHistory.create({
      studentId: student._id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      token,
      user: {
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
        originalEmail: student.originalEmail || student.email,
        department: student.department,
        year: student.year,
        college: student.college,
        phone: student.phone,
        role: student.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
