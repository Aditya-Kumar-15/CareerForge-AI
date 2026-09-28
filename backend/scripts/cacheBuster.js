const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '../../frontend');
const targetVersion = '25';

try {
  const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

  files.forEach(file => {
    const filePath = path.join(frontendDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const updatedContent = content.replace(/src="js\/([^"]+)\.js(\?v=\d+)?"/g, (match, scriptName) => {
      return `src="js/${scriptName}.js?v=${targetVersion}"`;
    });

    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated cache buster in ${file} to v=${targetVersion}`);
    }
  });
} catch (e) {
  console.error('Cache buster error:', e.message);
}
