import { LLMService } from "./llm-service.mjs";
import { EmbeddingService } from "./embedding-service.mjs";
import { PromptBuilder } from "./prompt-builder.mjs";
import { DatabaseRepository } from "../repositories/database-repository.mjs";

export class ContractQueryEngine {
  constructor({
    llmService = new LLMService(),
    embeddingService = new EmbeddingService(),
    repository = new DatabaseRepository(),
  } = {}) {
    this.llmService = llmService;
    this.embeddingService = embeddingService;
    this.repository = repository;
    this.topK = parseInt(process.env.QUERY_TOP_K || "10", 10);
    this.minSimilarity = parseFloat(process.env.QUERY_MIN_SIMILARITY || "0.5");
  }

  async executeSemanticQuery(customerId, question) {
    const startTime = Date.now();
    console.log("Executing semantic query", { customerId });

    const embStart = Date.now();
    const embedding = await this.embeddingService.generateEmbedding(question);
    const embTime = Date.now() - embStart;

    const dbStart = Date.now();
    const chunks = await this.repository.searchByEmbedding(
      customerId,
      null,
      embedding,
      this.topK,
    );
    const dbTime = Date.now() - dbStart;

    const evidence = chunks.filter(
      (item) => item.similarity >= this.minSimilarity,
    );

    if (evidence.length === 0) {
      console.log("No relevant evidence found for query");
      return {
        answer:
          "I could not find relevant information in the customer's contracts.",
        evidence: [],
      };
    }

    console.log("Found relevant evidence chunks", {
      count: evidence.length,
      embMs: embTime,
      dbMs: dbTime,
    });

    const llmStart = Date.now();
    const answer = await this.llmService.chat(
      PromptBuilder.answerFromEvidence(
        question,
        evidence.map((item) => ({
          contractId: item.contract_id,
          pageNumber: item.page_number,
          content: item.content,
        })),
      ),
      { temperature: 0.01 },
    );
    const llmTime = Date.now() - llmStart;

    const totalTime = Date.now() - startTime;
    console.log("Semantic search completed", {
      embMs: embTime,
      dbMs: dbTime,
      llmMs: llmTime,
      totalMs: totalTime,
    });

    return {
      answer,
      evidence: evidence.map((item) => ({
        chunkId: item.id,
        contractId: item.contract_id,
        documentId: item.document_id,
        fileName: item.file_name,
        pageNumber: item.page_number,
        chunkIndex: item.chunk_index,
      })),
    };
  }

  async query(customerId, question) {
    if (!customerId?.trim()) {
      throw new Error("Customer ID is required");
    }

    if (!question?.trim()) {
      throw new Error("Question is required");
    }

    const startTime = Date.now();
    console.log("Processing contract query", {
      customerId,
      question: question.substring(0, 100),
    });

    const semanticStart = Date.now();
    const semanticResult = await this.executeSemanticQuery(
      customerId,
      question,
    );
    const semanticTime = Date.now() - semanticStart;

    const totalTime = Date.now() - startTime;
    console.log("Query completed", {
      totalTime: `${totalTime}ms`,
      semanticMs: semanticTime,
    });

    return {
      customerId,
      question,
      intent: "SEMANTIC_SEARCH",
      timing: {
        totalMs: totalTime,
      },
      ...semanticResult,
    };
  }
}
