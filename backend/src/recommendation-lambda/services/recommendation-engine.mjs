export class OllamaRAGEngine {
  constructor(embeddingService, databaseRepository) {
    this.embeddingService = embeddingService;
    this.databaseRepository = databaseRepository;
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = process.env.LLM_MODEL || "mistral";
  }

  async generateRAGRecommendations(
    customerId,
    contractId,
    productsData,
    customerData,
  ) {
    console.log("Generating Ollama RAG-based recommendations", {
      customerId,
      contractId,
      model: this.model,
    });

    const customer = customerData.find((c) => c.customerId === customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const retrievedContext = await this.retrieveRAGContext(
      customerId,
      contractId,
    );

    console.log("Retrieved RAG context", { chunks: retrievedContext.length });

    if (retrievedContext.length === 0) {
      console.warn("No context found for RAG, using customer profile only");
    }

    const prompt = this.buildRecommendationPrompt(
      customer,
      retrievedContext,
      productsData,
    );

    const recommendation = await this.generateWithOllama(prompt);

    const structured = this.parseRecommendation(recommendation);

    return {
      customerId,
      contractId,
      customer: customer.name,
      industry: customer.industry,
      segment: customer.segment,
      recommendations: structured.recommendations,
      reasoning: structured.reasoning,
      confidence: structured.confidence,
      nextSteps: structured.nextSteps,
    };
  }

  async retrieveRAGContext(customerId, contractId, limit = 8) {
    console.log("Retrieving RAG context from embeddings", {
      customerId,
      contractId,
    });

    const searchQueries = [
      "requirements and needs",
      "challenges and pain points",
      "compliance and regulations",
      "budget and financial",
      "technology and integration",
      "security and risk management",
      "growth and expansion plans",
      "competitive advantages",
    ];

    const contextMap = new Map();

    for (const query of searchQueries) {
      try {
        const chunks = await this.databaseRepository.searchByKeywords(
          customerId,
          contractId,
          query,
          3,
        );

        for (const chunk of chunks) {
          if (!contextMap.has(chunk.id)) {
            contextMap.set(chunk.id, chunk);
          }
        }
      } catch (error) {
        console.warn("Error searching by keywords", {
          query,
          error: error.message,
        });
      }
    }

    const context = Array.from(contextMap.values()).slice(0, limit);

    console.log("Retrieved context chunks", { count: context.length });
    return context;
  }

  buildRecommendationPrompt(customer, contextChunks, productsData) {
    const contextText =
      contextChunks.length > 0
        ? contextChunks
            .map(
              (chunk, i) =>
                `[Context ${i + 1}] From page ${chunk.page_number || "unknown"}\n${chunk.content}`,
            )
            .join("\n\n")
        : "[No contract context available - using customer profile only]";

    const productsJson = productsData
      .map(
        (p) =>
          `- ${p.productId}: ${p.name} (${p.category}, $${p.annualPrice}/year) - ${p.description}`,
      )
      .join("\n");

    return `You are an expert sales consultant for financial technology solutions.

CUSTOMER PROFILE:
- Company: ${customer.name}
- Industry: ${customer.industry}
- Segment: ${customer.segment}
- Annual Revenue: $${customer.annualRevenue?.toLocaleString() || "Unknown"}

CONTRACT ANALYSIS & CONTEXT:
${contextText}

AVAILABLE PRODUCTS:
${productsJson}

TASK: Based on the customer profile and contract context, recommend the top 3 upsell/cross-sell opportunities.

For each recommendation provide:
1. Product ID and name
2. Type: UPSELL (upgrade) or CROSS_SELL (new)
3. Fit score (0-1)
4. 3 specific drivers from context
5. Business impact
6. Complexity: LOW/MEDIUM/HIGH
7. Timeline in weeks

Respond in this JSON format:
{
  "recommendations": [
    {
      "productId": "PRODXXX",
      "productName": "Name",
      "type": "UPSELL",
      "fitScore": 0.85,
      "keyDrivers": ["driver1", "driver2", "driver3"],
      "businessImpact": "Expected benefits",
      "implementationComplexity": "LOW",
      "timelineWeeks": 4
    }
  ],
  "reasoning": "Strategic rationale",
  "confidence": 0.87,
  "nextSteps": ["step1", "step2"]
}`;
  }

  async generateWithOllama(prompt) {
    console.log("Calling Ollama LLM", {
      url: this.ollamaUrl,
      model: this.model,
    });

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 2048,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Ollama API error (${response.status}): ${error.substring(0, 200)}`,
        );
      }

      const result = await response.json();

      console.log("Ollama response received", {
        responseLength: result.response?.length || 0,
      });

      return result.response || "";
    } catch (error) {
      console.error("Error calling Ollama", { error: error.message });
      throw error;
    }
  }

  parseRecommendation(responseText) {
    console.log("Parsing recommendation response");

    const jsonMatch = responseText.match(/\{[\s\S]*?\n\}/);

    if (!jsonMatch) {
      console.warn("Could not extract JSON from Ollama response, attempting raw parse");

      try {
        const parsed = JSON.parse(responseText);
        return parsed;
      } catch {
        console.warn("Could not parse JSON, returning structured default");
        return {
          recommendations: [],
          reasoning: responseText,
          confidence: 0.3,
          nextSteps: ["Review contract manually for recommendations"],
        };
      }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error) {
      console.error("Error parsing JSON response", { error: error.message });

      return {
        recommendations: [],
        reasoning: responseText,
        confidence: 0.3,
        nextSteps: ["Review LLM output manually"],
      };
    }
  }
}
