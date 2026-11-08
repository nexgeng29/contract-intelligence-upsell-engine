import { EmbeddingService } from "./services/embedding-service.mjs";
import { DatabaseRepository } from "./repositories/database-repository.mjs";
import { OllamaRAGEngine } from "./services/recommendation-engine.mjs";
import customersData from "../../../sample-data/customers.json" assert { type: "json" };
import productsData from "../../../sample-data/products.json" assert { type: "json" };

const embeddingService = new EmbeddingService();
const databaseRepository = new DatabaseRepository();
const ragEngine = new OllamaRAGEngine(embeddingService, databaseRepository);

export const handler = async (event) => {
  console.log("Recommendation Lambda handler invoked", {
    customerId: event.customerId,
    contractId: event.contractId,
  });

  try {
    const { customerId, contractId } = event;

    if (!customerId || !contractId) {
      throw new Error("Missing required fields: customerId, contractId");
    }

    console.log("Generating RAG-based recommendations", {
      customerId,
      contractId,
    });

    const recommendations = await ragEngine.generateRAGRecommendations(
      customerId,
      contractId,
      productsData,
      customersData,
    );

    console.log("RAG recommendations generated", {
      count: recommendations.recommendations?.length || 0,
    });

    return formatResponse({
      success: true,
      customerId,
      contractId,
      customer: recommendations.customer,
      industry: recommendations.industry,
      segment: recommendations.segment,
      recommendations: recommendations.recommendations || [],
      reasoning: recommendations.reasoning,
      confidence: recommendations.confidence,
      nextSteps: recommendations.nextSteps || [],
      recommendationCount: recommendations.recommendations?.length || 0,
    });
  } catch (error) {
    console.error("Lambda handler error", { error: error.message });
    return formatResponse({ error: error.message }, 400);
  }
};

const formatResponse = (data, statusCode = 200) => {
  return {
    statusCode,
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  };
};
