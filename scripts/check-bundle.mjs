import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  [/gsk_[0-9A-Za-z]{20,}/, 'Groq API key'],
  [/sb_secret_[0-9A-Za-z_-]{10,}/, 'Supabase secret key'],
  [/GEMINI_API_KEY|GROQ_API_KEY|SUPABASE_SERVICE_ROLE_KEY/, 'server secret name'],
  [/generativelanguage\.googleapis\.com|api\.groq\.com/, 'direct AI provider URL'],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}

let bad = 0;
for (const file of walk('dist')) {
  if (!/\.(js|html|css|map|json)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [re, what] of PATTERNS) if (re.test(text)) { console.error(`✗ ${what} in ${file}`); bad++; }
}
if (bad) process.exit(1);
console.log('✓ dist/ contains no AI keys, server secret names or provider URLs');
