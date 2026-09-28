const express = require('express');
const router = express.Router();
const multer = require('multer');
const resumeController = require('../controllers/resumeController');
const { verifyToken } = require('../middleware/auth');

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5MB file
});

router.post('/upload', verifyToken, upload.single('resume'), resumeController.uploadResume);
router.get('/current', verifyToken, resumeController.getCurrentResume);
router.get('/file', verifyToken, resumeController.getResumeFile);
router.get('/my/file', verifyToken, resumeController.getResumeFile);
router.post('/verify', verifyToken, resumeController.verifyResume);
router.post('/reparse', verifyToken, resumeController.reparseResume);

module.exports = router;
