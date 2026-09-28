const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const path = require('path');

/**
 * Extracts raw text from a file buffer depending on its mime type or extension
 * @param {Buffer} buffer 
 * @param {string} mimeType 
 * @param {string} [fileName]
 * @returns {Promise<string>}
 */
async function extractText(buffer, mimeType, fileName = '') {
  const ext = (path.extname(fileName || '') || '').toLowerCase();
  const isPdf = mimeType === 'application/pdf' || ext === '.pdf';
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                mimeType === 'application/msword' ||
                ext === '.docx' || ext === '.doc';
  const isTxt = mimeType === 'text/plain' || (mimeType && mimeType.includes('text/')) || ext === '.txt';

  if (isPdf) {
    try {
      const data = await pdfParse(buffer);
      if (data && data.text && data.text.trim().length > 0) {
        return data.text;
      }
    } catch (e) {}
  }

  if (isDocx || !isPdf) {
    try {
      const result = await mammoth.extractRawText({ buffer: buffer });
      if (result && result.value && result.value.trim().length > 0) {
        return result.value;
      }
    } catch (e) {}
  }

  if (isPdf) {
    const data = await pdfParse(buffer);
    if (!data || !data.text) {
      throw new Error('Could not extract text from the PDF file. Ensure it is not a scanned image.');
    }
    return data.text;
  }

  if (isTxt) {
    return buffer.toString('utf-8');
  }

  throw new Error('Unsupported file format. Only PDF, DOCX, and TXT files are allowed.');
}

module.exports = {
  extractText
};
