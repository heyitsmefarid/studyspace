import { ProviderError, type AIProvider } from './types.ts';
import { httpError, networkError } from './http.ts';

export function createGroqProvider(opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch; baseUrl?: string }): AIProvider {
  const apiKey = opts.apiKey?.trim() ?? '';
  const model = opts.model?.trim() ?? '';
  const f = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = opts.baseUrl ?? 'https://api.groq.com';
  return {
    name: 'groq',
    model,
    available: Boolean(apiKey && model),
    async generate(req) {
      let res: Response;
      try {
        res = await f(`${base}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: req.temperature,
            max_completion_tokens: req.maxOutputTokens,
            messages: [{ role: 'system', content: req.system }, ...req.messages],
            ...(req.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: req.signal,
        });
      } catch (err) {
        throw networkError(err, req.signal);
      }
      if (res.status === 400) {
        const text = await res.clone().text();
        try {
          const failed = (JSON.parse(text) as { error?: { code?: string; failed_generation?: string } }).error;
          if (failed?.code === 'json_validate_failed' && failed.failed_generation) return failed.failed_generation;
        } catch { /* fall through */ }
      }
      if (!res.ok) throw await httpError('Groq', res);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new ProviderError('empty', 'Empty response');
      return text;
    },
  };
}
