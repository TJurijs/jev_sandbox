import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { createApp, DECISIONS_URL, MODEL } from '../server/app.js';

const key = 'sk-or-v1-this-is-a-test-secret';
const payload = {
  state: { ticket: 'Checkout is broken.', customer_tier: 'enterprise' },
  questions: {
    team: { type: 'choice', instructions: 'Which team owns the issue?', criteria: { payments: 'Payment issues.', account: 'Login issues.' } },
    bug: { type: 'noul', instructions: 'Is this a defect?', criteria: { true: 'Something is broken.', false: 'Nothing is broken.' } },
    urgency: { type: 'score', instructions: 'How urgent is this?', criteria: ['Can wait.', 'Needs attention.', 'Blocking customers.'] },
  },
};
const result = { id: 'test-decision', model: MODEL, answers: { bug: { type: 'noul', noul: 0.9 } }, usage: { input_tokens: 40, output_tokens: 4, cost: 0.00001 } };
const servers = [];

async function start(options = {}) {
  const app = createApp({ apiKey: key, fetchImpl: async () => Response.json(result), ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

const post = (base, body = payload, extra = {}) => fetch(`${base}/api/decide`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
});

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  })));
});

test('forwards the documented Decisions payload with server-only credentials', async () => {
  let call;
  const base = await start({ fetchImpl: async (url, options) => { call = { url, options }; return Response.json(result); } });
  const response = await post(base, payload, { Origin: base, 'Sec-Fetch-Site': 'same-origin' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result, result);
  assert.ok(Number.isInteger(body.elapsedMs) && body.elapsedMs >= 0);
  assert.equal(call.url, DECISIONS_URL);
  assert.equal(call.options.headers.Authorization, `Bearer ${key}`);
  assert.deepEqual(JSON.parse(call.options.body), { model: MODEL, ...payload });
  assert.equal(call.options.redirect, 'error');
  assert.ok(call.options.signal instanceof AbortSignal);
  assert.equal(JSON.stringify(body).includes(key), false);
});

test('config reports key presence without revealing it', async () => {
  for (const apiKey of ['', key]) {
    const base = await start({ apiKey });
    const response = await fetch(`${base}/api/config`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { keyConfigured: Boolean(apiKey), model: MODEL });
  }
});

test('accepts documented text/array state and omitted noul criteria', async () => {
  const base = await start();
  for (const state of ['A support ticket.', [{ ticket: 'Broken checkout.' }]]) {
    const response = await post(base, { state, questions: { bug: { type: 'noul', instructions: 'Is this a bug?' } } });
    assert.equal(response.status, 200);
  }
});

test('invalid requests and missing credentials never reach OpenRouter', async () => {
  let called = false;
  const base = await start({ fetchImpl: () => { called = true; throw new Error('should not run'); } });
  const cases = [
    null,
    { ...payload, model: 'another-model' },
    { ...payload, state: false },
    { ...payload, state: ' ' },
    { ...payload, state: 'x'.repeat(128 * 1024 + 1) },
    { ...payload, questions: {} },
    { ...payload, questions: { q: { type: 'chat', instructions: 'Say hello' } } },
    { ...payload, questions: { q: { type: 'choice', instructions: 'Choose', criteria: { one: 'Only one.' } } } },
    { ...payload, questions: { q: { type: 'score', instructions: 'Rate', criteria: ['Only one.'] } } },
    { ...payload, questions: { q: { type: 'noul', instructions: 'Decide', criteria: { yes: 'Yes', no: 'No' } } } },
  ];
  for (const body of cases) assert.equal((await post(base, body)).status, 400);
  const noKey = await start({ apiKey: '', fetchImpl: () => { called = true; } });
  const response = await post(noKey);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'MISSING_API_KEY');
  assert.equal(called, false);
});

test('rejects malformed or oversized JSON and unexpected content types', async () => {
  const base = await start();
  const malformed = await fetch(`${base}/api/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_JSON');
  const large = await post(base, { ...payload, state: 'x'.repeat(300 * 1024) });
  assert.equal(large.status, 413);
  assert.equal((await large.json()).error.code, 'PAYLOAD_TOO_LARGE');
  const wrongType = await fetch(`${base}/api/decide`, { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(wrongType.status, 415);
});

test('allows ten score levels and rejects eleven before reaching the provider', async () => {
  let calls = 0;
  const base = await start({ fetchImpl: async () => { calls++; return Response.json(result); } });
  const scorePayload = (length) => ({
    state: 'Rate this input.',
    questions: { score: { type: 'score', instructions: 'Which level applies?', criteria: Array.from({ length }, (_, index) => `Level ${index}.`) } },
  });
  assert.equal((await post(base, scorePayload(10))).status, 200);
  const invalid = await post(base, scorePayload(11));
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error.message, /2 to 10/);
  assert.equal(calls, 1);
});

test('blocks cross-origin, cross-site, and DNS-rebinding requests before the API', async () => {
  let called = false;
  const base = await start({ fetchImpl: () => { called = true; } });
  for (const headers of [
    { Origin: 'https://untrusted.example' },
    { Origin: 'null' },
    { Origin: `${base}0` },
    { 'Sec-Fetch-Site': 'cross-site' },
  ]) assert.equal((await post(base, payload, headers)).status, 403, JSON.stringify(headers));
  // Node fetch replaces Host, so use the HTTP client to exercise rebinding protection.
  for (const host of ['untrusted.example', '127.0.0.1.untrusted.example']) {
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(`${base}/api/decide`, { method: 'POST', headers: { Host: host, 'Content-Type': 'application/json' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      request.on('error', reject);
      request.end(JSON.stringify(payload));
    });
    assert.equal(status, 403);
  }
  assert.equal(called, false);
});

test('never serves dotenv files even if a later dev/static handler would serve them', async () => {
  const app = createApp();
  app.use((_req, res) => res.send('unsafe static fallback'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const pathname of ['/.env', '/%2eenv', '/@fs/project/.env', '/.env.local', '/.git/config']) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 404);
    assert.equal((await response.text()).includes('unsafe static'), false);
  }
});

test('preserves useful upstream status, redacts secrets, and omits private metadata', async () => {
  const base = await start({ fetchImpl: async () => Response.json({ error: { message: `Rejected ${key}`, metadata: { Authorization: `Bearer ${key}` } } }, { status: 401 }) });
  const response = await post(base);
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.upstreamStatus, 401);
  assert.match(body.error.message, /Check OPENROUTER_API_KEY/);
  assert.match(body.error.message, /\[REDACTED\]/);
  assert.equal(JSON.stringify(body).includes(key), false);
  assert.equal(JSON.stringify(body).includes('Authorization'), false);
});

test('handles upstream non-JSON failures and malformed success responses safely', async () => {
  const htmlError = await start({ fetchImpl: async () => new Response(`<html>${key}</html>`, { status: 429 }) });
  const rateLimit = await post(htmlError);
  assert.equal(rateLimit.status, 429);
  assert.match((await rateLimit.json()).error.message, /rate limiting/);
  for (const data of [{ message: key }, null]) {
    const base = await start({ fetchImpl: async () => Response.json(data) });
    const response = await post(base);
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes(key), false);
  }
  const networkError = await start({ fetchImpl: async () => { throw new Error(`Network error ${key}`); } });
  const response = await post(networkError);
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(key), false);
});

test('redacts a credential even if an upstream success response unexpectedly echoes it', async () => {
  const base = await start({ fetchImpl: async () => Response.json({ ...result, provider: key }) });
  const response = await post(base);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.provider, '[REDACTED]');
});

test('aborts timed-out provider calls and returns an actionable error', async () => {
  let aborted = false;
  const base = await start({ timeoutMs: 20, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }) });
  const response = await post(base);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'TIMEOUT');
  assert.equal(aborted, true);
});

test('cancels upstream work when the browser disconnects', async () => {
  let resolveStarted;
  let resolveAborted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const aborted = new Promise((resolve) => { resolveAborted = resolve; });
  const base = await start({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { resolveAborted(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    resolveStarted();
  }) });
  const controller = new AbortController();
  const request = fetch(`${base}/api/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  await Promise.race([aborted, new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upstream was not cancelled')), 1000);
    timer.unref();
  })]);
});
