const fs = require('fs');
const path = require('path');
const Resume = require('../models/Resume');
const resumeService = require('../services/resumeService');
const aiService = require('../services/aiService');

const uploadsDir = path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function getCorrectMimeType(fileName, originalType) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt') return 'text/plain';
  return originalType || 'application/octet-stream';
}

// Upload and Parse Resume
exports.uploadResume = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, size, buffer, mimetype } = req.file;

    // Validate size (< 5MB)
    if (size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File is too large. Max size is 5MB.' });
    }

    // Extract raw text
    let rawText;
    try {
      rawText = await resumeService.extractText(buffer, mimetype, originalname);
    } catch (parseError) {
      return res.status(400).json({ message: parseError.message });
    }

    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ message: 'The uploaded file does not contain enough readable text to parse as a resume.' });
    }

    const fileType = getCorrectMimeType(originalname, mimetype);
    const ext = path.extname(originalname) || (fileType.includes('pdf') ? '.pdf' : (fileType.includes('word') ? '.docx' : '.txt'));
    const safeFileName = `resume-${req.user.id}-${Date.now()}${ext}`;
    const targetFilePath = path.join(uploadsDir, safeFileName);
    fs.writeFileSync(targetFilePath, buffer);

    // Analyze with AI
    const extractedData = await aiService.analyzeResume(rawText);

    // Save or update in MongoDB
    let resume = await Resume.findOne({ studentId: req.user.id });

    if (resume) {
      if (resume.filePath && fs.existsSync(resume.filePath)) {
        try { fs.unlinkSync(resume.filePath); } catch (e) {}
      }
      resume.fileName = originalname;
      resume.fileSize = size;
      resume.fileType = fileType;
      resume.filePath = targetFilePath;
      resume.fileBuffer = buffer;
      resume.rawText = rawText;
      resume.extractedData = extractedData;
      resume.verified = false;
    } else {
      resume = new Resume({
        studentId: req.user.id,
        fileName: originalname,
        fileSize: size,
        fileType,
        filePath: targetFilePath,
        fileBuffer: buffer,
        rawText,
        extractedData,
        verified: false
      });
    }

    await resume.save();

    console.log(`[RESUME UPLOAD] userId: ${req.user.id}, resumeId: ${resume._id}, fileName: ${resume.fileName}, projects: ${resume.extractedData?.projects?.length || 0}, certs: ${resume.extractedData?.certifications?.length || 0}, exp: ${resume.extractedData?.experience?.length || 0}`);

    res.json({
      message: 'Resume parsed and saved successfully. Please verify details.',
      resume
    });
  } catch (err) {
    console.error('Resume Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get current student's resume
exports.getCurrentResume = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const resume = await Resume.findOne({ studentId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'No resume uploaded for this account.' });
    }

    // Update fileType in DB if mismatched
    const correctType = getCorrectMimeType(resume.fileName, resume.fileType);
    if (resume.fileType !== correctType) {
      resume.fileType = correctType;
      await resume.save();
    }

    console.log(`[RESUME LOAD] userId: ${req.user.id}, resumeId: ${resume._id}, fileName: ${resume.fileName}, uploadedAt: ${resume.updatedAt || resume.createdAt}, projects: ${resume.extractedData?.projects?.length || 0}, certs: ${resume.extractedData?.certifications?.length || 0}, exp: ${resume.extractedData?.experience?.length || 0}`);

    res.json(resume);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Download / View actual uploaded resume file for authenticated student
exports.getResumeFile = async (req, res) => {
  try {
    const resume = await Resume.findOne({ studentId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'No resume uploaded for this account.' });
    }

    const download = req.query.download === 'true';
    const contentType = getCorrectMimeType(resume.fileName, resume.fileType);

    // 1. Try sending file from disk if path exists
    if (resume.filePath && resume.filePath !== 'undefined' && fs.existsSync(resume.filePath)) {
      res.setHeader('Content-Type', contentType);
      const disposition = download ? `attachment; filename="${encodeURIComponent(resume.fileName)}"` : `inline; filename="${encodeURIComponent(resume.fileName)}"`;
      res.setHeader('Content-Disposition', disposition);
      return res.sendFile(path.resolve(resume.filePath));
    }

    // 2. Try sending file from MongoDB fileBuffer
    if (resume.fileBuffer && resume.fileBuffer.length > 0) {
      res.setHeader('Content-Type', contentType);
      const disposition = download ? `attachment; filename="${encodeURIComponent(resume.fileName)}"` : `inline; filename="${encodeURIComponent(resume.fileName)}"`;
      res.setHeader('Content-Disposition', disposition);
      return res.send(resume.fileBuffer);
    }

    // 3. Fallback: Search local storage locations for legacy uploaded files
    const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\KOTA ADITYA KUMAR';
    const potentialPaths = [
      path.join(uploadsDir, resume.fileName),
      path.join(userHome, 'Downloads', resume.fileName),
      path.join(userHome, 'OneDrive\\Documents', resume.fileName),
      path.join(userHome, 'Documents', resume.fileName)
    ];

    let foundPath = null;
    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (foundPath) {
      console.log(`[STORAGE RECOVERY] Found legacy resume file for student ${req.user.id} at: ${foundPath}`);
      const fileBuffer = fs.readFileSync(foundPath);
      
      const ext = path.extname(resume.fileName) || '.docx';
      const safeFileName = `resume-${req.user.id}-${Date.now()}${ext}`;
      const savedPath = path.join(uploadsDir, safeFileName);
      fs.writeFileSync(savedPath, fileBuffer);

      resume.filePath = savedPath;
      resume.fileBuffer = fileBuffer;
      resume.fileType = contentType;
      await resume.save();

      res.setHeader('Content-Type', contentType);
      const disposition = download ? `attachment; filename="${encodeURIComponent(resume.fileName)}"` : `inline; filename="${encodeURIComponent(resume.fileName)}"`;
      res.setHeader('Content-Disposition', disposition);
      return res.sendFile(path.resolve(savedPath));
    }

    return res.status(404).json({ message: 'Resume record exists, but the uploaded file could not be found in storage.' });
  } catch (err) {
    console.error('Get Resume File Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Verify/update extracted data
exports.verifyResume = async (req, res) => {
  try {
    const { extractedData } = req.body;
    if (!extractedData) {
      return res.status(400).json({ message: 'No verification data provided.' });
    }

    const resume = await Resume.findOne({ studentId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'No resume found to verify.' });
    }

    resume.extractedData = extractedData;
    resume.verified = true;

    await resume.save();
    res.json({ message: 'Resume details verified and saved successfully.', resume });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Re-parse existing resume from stored rawText
exports.reparseResume = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const resume = await Resume.findOne({ studentId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'No resume found for this account.' });
    }

    if (!resume.rawText || resume.rawText.trim().length < 50) {
      return res.status(400).json({ message: 'No stored resume text available to re-parse. Please re-upload your resume file.' });
    }

    console.log(`[RESUME REPARSE] userId: ${req.user.id}, resumeId: ${resume._id}, fileName: ${resume.fileName}`);

    const extractedData = await aiService.analyzeResume(resume.rawText);

    const projectsCount = extractedData?.projects?.length || 0;
    const projectNames = (extractedData?.projects || []).map(p => p?.name || p);

    console.log(`[RESUME REPARSE] projectsCount: ${projectsCount}, projectNames: ${JSON.stringify(projectNames)}`);

    resume.extractedData = extractedData;
    // Preserve previous verification status — re-parse is automatic, not user-edited
    // Only set verified=true if we found something useful (projects or skills)
    const hasUsefulData = projectsCount > 0 || Object.values(extractedData?.skills || {}).flat().length > 0;
    if (hasUsefulData) {
      resume.verified = true;
    }
    await resume.save();

    res.json({
      message: `Resume successfully re-parsed. Found ${projectsCount} project(s).`,
      resume,
      debug: {
        projectsCount,
        projectNames
      }
    });
  } catch (err) {
    console.error('Resume Re-parse Error:', err);
    res.status(500).json({ error: err.message });
  }
};

