const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdmin } = require('../middleware/auth');

router.get('/students', verifyAdmin, adminController.getAllStudents);
router.get('/login-history', verifyAdmin, adminController.getLoginHistory);
router.get('/candidates', verifyAdmin, adminController.getCandidates);
router.get('/candidate/:id/report', verifyAdmin, adminController.getCandidateReport);

module.exports = router;
