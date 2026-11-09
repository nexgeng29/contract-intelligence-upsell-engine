const EMBEDDING_DIMENSION = 768;

export class EmbeddingService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL;
    this.model = process.env.EMBEDDING_MODEL;
  }

  async generateEmbedding(text) {
    const startTime = Date.now();
    console.log("Generating embedding for text", { length: text.length });

    const response = await fetch(`${this.ollamaUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const fetchTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding failed (${response.status}): ${error}`);
    }

    const result = await response.json();
    const embedding = result.embeddings?.[0];

    if (!embedding || embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSION}-dimensional embedding, got ${embedding?.length || "none"}`,
      );
    }

    const totalTime = Date.now() - startTime;
    console.log("Embedding generated", { dimension: embedding.length, fetchMs: fetchTime, totalMs: totalTime });
    return embedding;
  }

  async generateEmbeddings(texts) {
    console.log("Generating embeddings for multiple texts", {
      count: texts.length,
    });

    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }
}
