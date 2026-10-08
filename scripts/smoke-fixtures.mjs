import { randomUUID } from 'node:crypto';

export const me = '11111111-1111-4111-8111-111111111111';
export const partner = '22222222-2222-4222-8222-222222222222';
export const noteId = '33333333-3333-4333-8333-333333333333';
export const deckId = '44444444-4444-4444-8444-444444444444';
export const quizId = '55555555-5555-4555-8555-555555555555';
export const roomId = '66666666-6666-4666-8666-666666666666';
const at = new Date().toISOString();

// Browser-only fixtures: no test request is sent to the configured Supabase project.
export async function installFixtures(context, supabaseUrl) {
  const origin = new URL(supabaseUrl).origin;
  const profile = {
    id: me, display_name: 'Test Star', bio: '', avatar_url: null, star_color: '#a78bfa',
    timezone: 'Asia/Manila', xp: 0, current_streak: 0, longest_streak: 0, last_active_date: null,
    onboarded_at: at, created_at: at, preferences: { theme: 'night' },
  };
  const tables = {
    profiles: [profile, { ...profile, id: partner, display_name: 'Partner Star' }],
    study_rooms: [{ id: roomId, name: 'Our Room', created_at: at }],
    notes: [{ id: noteId, owner_id: me, title: 'Biology notes', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cells are the building blocks of life.' }] }] }, content_text: 'Cells are the building blocks of life.', subject_id: null, folder_id: null, is_shared: false, is_pinned: false, is_favorite: false, created_at: at, updated_at: at }],
    decks: [{ id: deckId, owner_id: me, title: 'Biology deck', description: '', subject_id: null, tags: [], is_shared: false, created_at: at, updated_at: at }],
    flashcards: Array.from({ length: 4 }, (_, i) => ({ id: `77777777-7777-4777-8777-77777777777${i}`, deck_id: deckId, type: 'basic', front: `Cell question ${i + 1}`, back: `Cell answer ${i + 1}`, options: null, correct_answer: null, topic: 'Cells', difficulty: 'easy', position: i, image_path: null, created_at: at })),
    quizzes: [{ id: quizId, owner_id: me, title: 'Biology quiz', description: '', subject_id: null, source: 'manual', is_shared: false, time_limit_seconds: null, created_at: at, updated_at: at }],
    quiz_questions: [{ id: '88888888-8888-4888-8888-888888888888', quiz_id: quizId, type: 'mcq', question: 'What is the basic unit of life?', options: ['Cell', 'Rock', 'Water', 'Air'], correct_answer: 'Cell', explanation: 'Living organisms are made of cells.', topic: 'Cells', difficulty: 'easy', position: 0 }],
  };
  const failures = new Set();
  const requests = [];
  const user = { id: me, aud: 'authenticated', role: 'authenticated', email: 'test@example.test', app_metadata: {}, user_metadata: {}, created_at: at };
  const tokenPart = Buffer.from(JSON.stringify({ sub: me, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url');
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${tokenPart}.test`, refresh_token: 'test-only', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, session });
  await context.routeWebSocket(/\/realtime\//, (socket) => socket.close());
  await context.route(`${origin}/**`, async (route) => {
    const req = route.request(), url = new URL(req.url());
    const table = url.pathname.split('/').at(-1);
    const method = req.method();
    requests.push({ table, method });
    const respond = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    if (failures.has(table)) return respond({ message: 'Unable to reach the server. Please try again.', code: 'TEST_FAILURE' }, 503);
    if (url.pathname.startsWith('/auth/')) return respond(table === 'user' ? user : session);
    if (url.pathname.includes('/rpc/')) return respond([]);
    if (url.pathname.includes('/functions/')) return respond({ error: 'AI is unavailable in browser smoke tests.' }, 503);
    if (!url.pathname.startsWith('/rest/v1/')) return respond({});
    tables[table] ??= [];
    let rows = tables[table];
    const matches = (row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4);
      if (value === 'is.null') return row[key] == null;
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
      return true;
    });
    if (method === 'POST') {
      const input = req.postDataJSON();
      rows = (Array.isArray(input) ? input : [input]).map((r) => ({ id: randomUUID(), created_at: at, updated_at: at, ...r }));
      tables[table].push(...rows);
    } else {
      rows = rows.filter(matches);
      if (method === 'PATCH') rows.forEach((row) => Object.assign(row, req.postDataJSON()));
      if (method === 'DELETE') tables[table] = tables[table].filter((row) => !matches(row));
    }
    const select = url.searchParams.get('select') ?? '';
    rows = rows.map((row) => ({ ...row,
      ...(select.includes('flashcards(count)') ? { flashcards: [{ count: tables.flashcards.filter((c) => c.deck_id === row.id).length }] } : {}),
      ...(select.includes('quiz_questions(count)') ? { quiz_questions: [{ count: tables.quiz_questions.filter((q) => q.quiz_id === row.id).length }] } : {}),
      ...(select.includes('task_completions(') ? { task_completions: [] } : {}),
      ...(select.includes('message_reactions(') ? { message_reactions: [] } : {}),
    }));
    const single = req.headers().accept?.includes('vnd.pgrst.object');
    if (single && rows.length !== 1) return respond({ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: `The result contains ${rows.length} rows` }, 406);
    return respond(single ? rows[0] : rows, method === 'POST' ? 201 : 200, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  });
  return { tables, failures, requests };
}
