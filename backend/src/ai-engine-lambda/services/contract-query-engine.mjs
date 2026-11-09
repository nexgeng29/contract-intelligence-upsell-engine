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

  async classifyQuestion(question) {
    const intent = await this.llmService.generateJson(
      PromptBuilder.contractIntent(question),
    );

    const supportedIntents = [
      "CONTRACT_EXPIRY",
      "EXPIRED_CONTRACTS",
      "CONTRACT_RENEWAL",
      "AUTO_RENEWAL",
      "TERMINATION_NOTICE",
      "CONTRACT_SEARCH",
      "CONTRACT_SUMMARY",
      "GENERAL_CONTRACT_QUESTION",
    ];

    if (!supportedIntents.includes(intent.intent)) {
      throw new Error("Unsupported contract query intent");
    }

    return intent;
  }

  validatePeriod(value) {
    const period = Number(value ?? 90);

    if (!Number.isInteger(period) || period < 1 || period > 3650) {
      throw new Error("Invalid date search period");
    }

    return period;
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
        type: "SEMANTIC_SEARCH",
        answer:
          "I could not find relevant information in the customer's contracts.",
        evidence: [],
      };
    }

    console.log("Found relevant evidence chunks", { count: evidence.length, embMs: embTime, dbMs: dbTime });

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
      { temperature: 0.1 },
    );
    const llmTime = Date.now() - llmStart;

    const totalTime = Date.now() - startTime;
    console.log("Semantic search completed", { embMs: embTime, dbMs: dbTime, llmMs: llmTime, totalMs: totalTime });

    return {
      type: "SEMANTIC_SEARCH",
      answer,
      evidence: evidence.map((item) => ({
        chunkId: item.id,
        contractId: item.contract_id,
        documentId: item.document_id,
        fileName: item.file_name,
        pageNumber: item.page_number,
        chunkIndex: item.chunk_index,
        similarity: item.similarity,
        content: item.content,
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

    const classifyStart = Date.now();
    const intent = await this.classifyQuestion(question);
    const classifyTime = Date.now() - classifyStart;
    console.log("Intent classified", { intent: intent.intent, duration: `${classifyTime}ms` });

    const semanticStart = Date.now();
    const semanticResult = await this.executeSemanticQuery(
      customerId,
      intent.searchQuery || question,
    );
    const semanticTime = Date.now() - semanticStart;
    console.log("Semantic query completed", { duration: `${semanticTime}ms`, chunks: semanticResult.evidence?.length || 0 });

    const totalTime = Date.now() - startTime;
    console.log("Query completed", { totalTime: `${totalTime}ms` });

    return {
      customerId,
      question,
      intent: intent.intent,
      timing: {
        classifyMs: classifyTime,
        semanticMs: semanticTime,
        totalMs: totalTime,
      },
      ...semanticResult,
    };
  }
}
