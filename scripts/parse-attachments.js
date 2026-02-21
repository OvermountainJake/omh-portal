const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// pdf-parse exports differently
let pdfParse;
try {
  const pdfModule = require('pdf-parse');
  pdfParse = typeof pdfModule === 'function' ? pdfModule : pdfModule.default || Object.values(pdfModule)[0];
} catch(e) {
  console.error('pdf-parse load error:', e.message);
}

const DATA_DIR = path.join(__dirname, '../data');

async function main() {
  // Parse the DOCX calendar
  try {
    console.log('\n=== Monthly-Calendar-2026- DAVE.docx ===');
    const result = await mammoth.extractRawText({ path: path.join(DATA_DIR, 'Monthly-Calendar-2026- DAVE.docx') });
    console.log(result.value.substring(0, 6000));
  } catch(e) {
    console.error('DOCX error:', e.message);
  }

  // Parse the PDF calendar
  try {
    console.log('\n=== 2026 Family Calendar.pdf ===');
    const buf = fs.readFileSync(path.join(DATA_DIR, '2026 Family Calendar.pdf'));
    const data = await pdfParse(buf);
    console.log(data.text.substring(0, 6000));
  } catch(e) {
    console.error('PDF calendar error:', e.message);
  }

  // Parse the menu PDF
  try {
    console.log('\n=== Winter 2024-25 Menu YCDC.pdf ===');
    const buf = fs.readFileSync(path.join(DATA_DIR, 'Winter 2024-25 Menu YCDC.pdf'));
    const data = await pdfParse(buf);
    console.log(data.text.substring(0, 6000));
  } catch(e) {
    console.error('Menu PDF error:', e.message);
  }

  // Parse the master menu DOCX
  try {
    console.log('\n=== Fall Winter 2025 Master.docx ===');
    const result = await mammoth.extractRawText({ path: path.join(DATA_DIR, 'Fall Winter 2025 Master.docx') });
    console.log(result.value.substring(0, 6000));
  } catch(e) {
    console.error('Master DOCX error:', e.message);
  }
}

main();
