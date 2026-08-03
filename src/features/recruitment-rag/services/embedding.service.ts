import { createHash } from "crypto";

import type OpenAI from "openai";

import { getOpenAIClient } from "@/lib/ai/client";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export class EmbeddingService {
  constructor(private readonly client: OpenAI = getOpenAIClient()) {}

  async embedText(text: string): Promise<number[]> {
    const normalized = text.trim().slice(0, 8000);
    if (!normalized) return new Array(EMBEDDING_DIMENSIONS).fill(0);

    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalized,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0]?.embedding ?? new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const filtered = texts.map((text) => text.trim().slice(0, 8000)).filter(Boolean);
    if (filtered.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: filtered,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
  }
}

export function hashKnowledgeContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}
