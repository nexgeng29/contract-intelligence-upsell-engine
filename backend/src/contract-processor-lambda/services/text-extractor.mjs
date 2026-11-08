// text-extractor.mjs
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export class TextExtractor {
  async extractFromPDF(buffer) {
    console.log('Extracting text from PDF', { size: buffer.length });

    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const pages = [];

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 0) {
          pages.push({ pageNumber, text });
        }

        page.cleanup();
      }
    } finally {
      await pdf.destroy();
    }

    console.log('Text extracted from PDF', { pages: pages.length });
    return pages;
  }
}
