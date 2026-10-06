import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'supabase/.bundle/ai';
const SHARED = ['types.ts', 'schemas.ts', 'prompts.ts', 'postprocess.ts', 'tasks.ts', 'router.ts', 'http.ts', 'geminiProvider.ts', 'groqProvider.ts', 'guards.ts'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/shared`, { recursive: true });
cpSync('supabase/functions/ai/index.ts', `${OUT}/index.ts`);
for (const f of SHARED) {
  const src = readFileSync(`src/services/ai/${f}`, 'utf8');
  if (/from '@\//.test(src)) throw new Error(`${f} uses an @/ alias — shared AI files must use relative .ts imports`);
  if (/from '\.\/[^']+(?<!\.ts)'/.test(src)) throw new Error(`${f} has a relative import without .ts`);
  writeFileSync(`${OUT}/shared/${f}`, src);
}
writeFileSync(`${OUT}/deno.json`, JSON.stringify({ imports: { '@ai/': './shared/', zod: 'npm:zod@4.6.5' } }, null, 2));
console.log(`Edge bundle ready in ${OUT}: index.ts, deno.json, shared/{${SHARED.join(',')}}`);
