import { ProviderError, type AIProvider, type ProviderRequest } from './types.ts';
import { httpError, networkError } from './http.ts';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function createGeminiProvider(opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch; baseUrl?: string }): AIProvider {
  const apiKey = opts.apiKey?.trim() ?? '';
  const model = opts.model?.trim() ?? '';
  const f = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = opts.baseUrl ?? 'https://generativelanguage.googleapis.com';

  const body = (req: ProviderRequest, withSchema: boolean) => JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: {
      temperature: req.temperature,
      maxOutputTokens: req.maxOutputTokens,
      ...(req.jsonSchema ? { responseMimeType: 'application/json', ...(withSchema ? { responseJsonSchema: req.jsonSchema } : {}) } : {}),
    },
  });

  async function send(req: ProviderRequest, withSchema: boolean): Promise<Response> {
    try {
      return await f(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: body(req, withSchema),
        signal: req.signal,
      });
    } catch (err) {
      throw networkError(err, req.signal);
    }
  }

  return {
    name: 'gemini',
    model,
    available: Boolean(apiKey && model),
    async generate(req) {
      let res = await send(req, true);
      if (res.status === 400 && req.jsonSchema) {
        const text = await res.clone().text();
        if (/responseJsonSchema|response_json_schema/i.test(text)) res = await send(req, false);
      }
      if (!res.ok) throw await httpError('Gemini', res);
      const data = (await res.json()) as GeminiResponse;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim();
      if (!text) throw new ProviderError('empty', data.promptFeedback?.blockReason ? `Blocked: ${data.promptFeedback.blockReason}` : 'Empty response');
      return text;
    },
  };
}
