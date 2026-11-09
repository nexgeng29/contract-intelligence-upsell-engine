import { ContractQueryEngine } from "./services/contract-query-engine.mjs";

const queryEngine = new ContractQueryEngine();

export const handler = async (event) => {
  console.log("Contract Query Lambda handler invoked", {
    customerId: event.customerId,
    question: event.question,
  });

  try {
    const { customerId, question } = event;

    if (!customerId) {
      throw new Error("Missing required field: customerId");
    }

    if (!question) {
      throw new Error("Missing required field: question");
    }

    const result = await queryEngine.query(customerId, question);

    console.log("Contract query processed", {
      intent: result.intent,
      type: result.type,
      evidenceCount: result.evidence?.length || 0,
    });

    return formatResponse({
      success: true,
      ...result,
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
