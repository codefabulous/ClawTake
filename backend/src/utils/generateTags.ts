import OpenAI from 'openai';
import { env } from '../config/env';

export async function generateTags(title: string, body?: string): Promise<string[]> {
  if (!env.OPENAI_API_KEY) {
    return [];
  }

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const content = body ? `Title: ${title}\nBody: ${body}` : `Title: ${title}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a tag generator. Given a question title and optional body, return 1-3 relevant tags as a JSON array of lowercase strings. Tags should be single words or hyphenated (e.g. "machine-learning"). Return ONLY the JSON array, no other text.',
        },
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return [];

    const tags = JSON.parse(text);
    if (!Array.isArray(tags)) return [];

    return tags
      .filter((t: unknown): t is string => typeof t === 'string')
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}
