const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_portal';

async function reparseMigration() {
  await mongoose.connect(MONGODB_URI);
  const Resume = require('./models/Resume');
  const aiService = require('./services/aiService');
  
  console.log('=== RESUME RE-PARSE MIGRATION ===');
  const resumes = await Resume.find({ rawText: { $exists: true, $ne: '' } });
  console.log('Total resumes with rawText:', resumes.length);
  
  let fixedCount = 0;

  for (const resume of resumes) {
    const oldProjCount = resume.extractedData?.projects?.length || 0;
    const rawText = resume.rawText || '';
    
    // Only re-parse if rawText mentions PROJECTS but stored 0 projects
    const hasProjectsSection = /PROJECTS/i.test(rawText);
    
    if (hasProjectsSection && oldProjCount === 0) {
      console.log('\nRe-parsing resume:', resume.fileName, '(studentId:', resume.studentId.toString() + ')');
      
      const reParsed = await aiService.analyzeResume(rawText);
      const newProjCount = reParsed.projects?.length || 0;
      
      console.log('  Old projects:', oldProjCount, '-> New projects:', newProjCount);
      if (reParsed.projects?.length > 0) {
        console.log('  Project names:', reParsed.projects.map(p => p?.name));
      }
      
      if (newProjCount > 0) {
        resume.extractedData = reParsed;
        await resume.save();
        fixedCount++;
        console.log('  FIXED - Saved updated extractedData to MongoDB');
      } else {
        console.log('  (no projects found even after re-parse, skipping)');
      }
    } else {
      console.log('Resume:', resume.fileName, '| projects:', oldProjCount, '| hasProjectsSection:', hasProjectsSection, '(skipped)');
    }
  }
  
  console.log('\n=== MIGRATION COMPLETE ===');
  console.log('Fixed resumes:', fixedCount + '/' + resumes.length);
  await mongoose.disconnect();
}

reparseMigration().catch(e => { console.error('Error:', e.message); process.exit(1); });
