const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup/request-otp', authController.requestSignupOtp);
router.post('/signup/resend-otp', authController.resendSignupOtp);
router.post('/signup/verify-otp', authController.verifySignupOtp);
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);

module.exports = router;
