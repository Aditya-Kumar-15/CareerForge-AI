const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { verifyToken } = require('../middleware/auth');

router.post('/setup', verifyToken, interviewController.setupInterview);
router.get('/active', verifyToken, interviewController.getActiveInterview);
router.post('/save-answer', verifyToken, interviewController.saveAnswer);
router.post('/finalize', verifyToken, interviewController.finalizeInterview);
router.post('/warning', verifyToken, interviewController.reportIntegrityWarning);
router.get('/history', verifyToken, interviewController.getInterviewHistory);
router.get('/details/:id', verifyToken, interviewController.getInterviewDetails);
router.get('/stats', verifyToken, interviewController.getDashboardStats);

module.exports = router;
