import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
await fs.mkdir(fixturesDir, { recursive: true });

const docxZip = new JSZip();

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Report 2026-01</w:t></w:r></w:p>
    <w:p><w:r><w:t>Total cases: 3</w:t></w:r></w:p>
    <w:p><w:r><w:t>In production: 1</w:t></w:r></w:p>
    <w:p><w:r><w:t>Closed cases: 2</w:t></w:r></w:p>
    <w:p><w:r><w:t>New cases: 3</w:t></w:r></w:p>
    <w:p><w:r><w:t>Previous month leftover: 0</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>KЖБР</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Applicant</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A-001</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Alpha LLC</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Open</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A-002</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Beta LLC</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Closed</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A-003</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Gamma LLC</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Closed</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

// DOCX structure
// /[Content_Types].xml
// /_rels/.rels
// /word/document.xml
// /word/_rels/document.xml.rels

docxZip.file('[Content_Types].xml', contentTypes);
docxZip.folder('_rels')?.file('.rels', rels);
docxZip.folder('word')?.file('document.xml', documentXml);
docxZip.folder('word')?.folder('_rels')?.file('document.xml.rels', docRels);

const docxBuffer = await docxZip.generateAsync({ type: 'nodebuffer' });
await fs.writeFile(path.join(fixturesDir, 'sample.docx'), docxBuffer);

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Template');
sheet.getCell('B2').value = 0;
sheet.getCell('B3').value = 0;
sheet.getCell('B4').value = 0;
sheet.getCell('B5').value = 0;
const xlsxBuffer = await workbook.xlsx.writeBuffer();
await fs.writeFile(path.join(fixturesDir, 'sample.xlsx'), Buffer.from(xlsxBuffer));

console.log('Fixtures generated in tests/fixtures');

