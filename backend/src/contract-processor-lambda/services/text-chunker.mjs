// text-chunker.mjs
export class TextChunker {
  constructor(chunkSize = 1200, chunkOverlap = 150) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  chunk(pages) {
    console.log('Chunking pages', { pages: pages.length, chunkSize: this.chunkSize, overlap: this.chunkOverlap });

    const chunks = [];

    for (const page of pages) {
      const text = String(page.text || '').replace(/\s+/g, ' ').trim();

      if (!text) continue;

      let start = 0;
      let chunkIndex = 0;

      while (start < text.length) {
        const end = Math.min(start + this.chunkSize, text.length);
        const content = text.slice(start, end).trim();

        if (content.length > 30) {
          chunks.push({
            pageNumber: page.pageNumber,
            chunkIndex,
            content,
          });
          chunkIndex++;
        }

        if (end >= text.length) break;

        start = end - this.chunkOverlap;
      }
    }

    console.log('Pages chunked', { chunks: chunks.length });
    return chunks;
  }
}
