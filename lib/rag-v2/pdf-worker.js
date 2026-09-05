import process from 'node:process';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Input is already bounded bytes. No URL, embedded JavaScript or annotation action is executed.
globalThis.fetch = () => { throw new Error('network_disabled'); };
const workerData = await new Promise(resolve => process.once('message', resolve));
try {
  const task = getDocument({ data: workerData.bytes, isEvalSupported: false, useSystemFonts: true,
    disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > workerData.config.maxPages) throw new Error('page_limit');
    const pages = [];
    let length = 0;
    for (let index = 0; index < pdf.numPages; index++) {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      const items = content.items.filter(item => typeof item.str === 'string').map((item, i) => ({
        text: item.str, item_index: i, x: item.transform[4], y: item.transform[5],
        width: item.width, height: item.height, font: item.fontName, transform: item.transform,
      }));
      length += items.reduce((sum, item) => sum + item.text.length, 0);
      if (length > workerData.config.maxTextChars) throw new Error('text_limit');
      pages.push({ parser_page_index: index, pdf_page: index + 1, view: page.view, items });
      page.cleanup();
    }
    process.send({ pages, info: (await pdf.getMetadata()).info });
  } finally { await pdf.destroy(); }
} catch (error) {
  const code = ['page_limit', 'text_limit'].includes(error.message) ? error.message : 'pdf_parse_failed';
  process.send({ error: code });
} finally {
  process.disconnect();
}
