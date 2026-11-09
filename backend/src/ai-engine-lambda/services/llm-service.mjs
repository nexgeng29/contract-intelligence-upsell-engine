export class LLMService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL;
    this.model = process.env.LLM_MODEL;
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.1,
          ...options,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama chat error: ${response.status} ${await response.text()}`,
      );
    }

    const result = await response.json();

    return result.message?.content ?? "";
  }

  async generateJson(messages) {
    console.log("Generating JSON with messages:", messages);
    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        format: "json",
        options: {
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Ollama JSON generation error: ${response.status}`);
    }

    const result = await response.json();

    try {
      return JSON.parse(result.message.content);
    } catch {
      throw new Error("LLM returned invalid JSON");
    }
  }
}
