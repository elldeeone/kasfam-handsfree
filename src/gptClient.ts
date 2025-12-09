import OpenAI from "openai";
import { prompt as basePrompt, buildPromptWithExamples, type FewShotExample } from "./prompt.js";

const openAiClient = new OpenAI({ apiKey: assertApiKey() });

// Store the previous response ID for conversation memory across tweets
let previousResponseId: string | null = null;

export function resetConversationMemory(): void {
  previousResponseId = null;
}

function assertApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  return key;
}

export type AskTweetDecisionResult = {
  quote: string;
  approved: boolean;
  score: number;  // Percentile 0-100
  responseId: string;  // For debugging conversation chain
};

export type AskTweetDecisionOptions = {
  examples?: FewShotExample[];
  useConversationMemory?: boolean;  // Default true for CLI, false for server one-offs
};

export async function askTweetDecision(
  tweetText: string,
  options: AskTweetDecisionOptions = {}
): Promise<AskTweetDecisionResult> {
  const { examples, useConversationMemory = true } = options;

  const systemPrompt = examples?.length
    ? buildPromptWithExamples(examples)
    : basePrompt;

  const response = await openAiClient.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: tweetText },
    ],
    reasoning: {
      effort: "high",
    },
    ...(useConversationMemory && previousResponseId ? { previous_response_id: previousResponseId } : {}),
  });

  // Store response ID for next tweet (if using conversation memory)
  if (useConversationMemory) {
    previousResponseId = response.id;
  }

  const quote = response.output_text?.trim() ?? "";
  const approved = !quote.startsWith("Rejected");

  // Parse percentile (0-100) instead of old score (1-10)
  const percentileMatch = quote.match(/Percentile:\s*(\d+)/i);
  const score = percentileMatch ? parseInt(percentileMatch[1], 10) : 0;

  return { quote, approved, score, responseId: response.id };
}

export { type FewShotExample } from "./prompt.js";
