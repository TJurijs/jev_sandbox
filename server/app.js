import express from 'express';

export const MODEL = '~typesafe/jev-latest';
export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
const MAX_STATE_BYTES = 128 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const QUESTION_TYPES = new Set(['choice', 'noul', 'score']);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value, limit = 4000) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

function validatePayload(body) {
  if (!isRecord(body)) return 'Send a JSON object containing state and questions.';
  if (Object.keys(body).some((key) => !['state', 'questions'].includes(key))) {
    return 'Only state and questions are accepted. The model is configured by this app.';
  }
  if (!(typeof body.state === 'string' || isRecord(body.state) || Array.isArray(body.state))) {
    return 'State must be text, a JSON object, or a JSON array.';
  }
  if (typeof body.state === 'string' && !body.state.trim()) return 'State must not be empty.';
  if (Buffer.byteLength(JSON.stringify(body.state)) > MAX_STATE_BYTES) return 'State must be smaller than 128 KB.';

  const stack = [{ value: body.state, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (depth > 32) return 'State must not be nested more than 32 levels deep.';
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) stack.push({ value: child, depth: depth + 1 });
    }
  }

  if (!isRecord(body.questions)) return 'Questions must be a JSON object keyed by question name.';
  const questions = Object.entries(body.questions);
  if (questions.length < 1 || questions.length > 24) return 'Add between 1 and 24 questions.';
  for (const [name, question] of questions) {
    if (!isText(name, 100)) return 'Question names must contain 1 to 100 characters.';
    const label = `Question "${name}"`;
    if (!isRecord(question) || !QUESTION_TYPES.has(question.type)) return `${label} must have type choice, noul, or score.`;
    if (Object.keys(question).some((key) => !['type', 'instructions', 'criteria'].includes(key))) {
      return `${label} accepts only type, instructions, and criteria.`;
    }
    if (!isText(question.instructions)) return `${label} needs instructions of 1 to 4,000 characters.`;
    if (question.type === 'score') {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2 || question.criteria.length > 10 || !question.criteria.every((item) => isText(item, 2000))) {
        return `${label} needs an ordered criteria array with 2 to 10 nonempty descriptions (up to 2,000 characters each).`;
      }
    } else if (question.type === 'choice') {
      if (!isRecord(question.criteria)) return `${label} needs an object mapping choices to descriptions.`;
      const criteria = Object.entries(question.criteria);
      if (criteria.length < 2 || criteria.length > 20 || !criteria.every(([key, value]) => isText(key, 100) && isText(value, 2000))) {
        return `${label} needs 2 to 20 named choices with nonempty descriptions (up to 2,000 characters each).`;
      }
    } else if (question.criteria !== undefined) {
      if (!isRecord(question.criteria) || Object.keys(question.criteria).length !== 2 || !isText(question.criteria.true, 2000) || !isText(question.criteria.false, 2000)) {
        return `${label} criteria must contain true and false descriptions, or be omitted.`;
      }
    }
  }
  return null;
}

function redact(value, apiKey) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (apiKey) text = text.split(apiKey).join('[REDACTED]');
  return text.replace(/sk-or-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

function upstreamMessage(status, data, apiKey) {
  const hints = {
    400: 'OpenRouter rejected this decision request. Check the state and question criteria.',
    401: 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env and restart the server.',
    402: 'OpenRouter credits are insufficient. Check your account balance.',
    403: 'OpenRouter denied access to this model or endpoint.',
    404: 'The requested Jev model or Decisions endpoint is currently unavailable.',
    413: 'OpenRouter rejected the request because it is too large.',
    429: 'OpenRouter is rate limiting requests. Wait a moment before trying again.',
  };
  const hint = hints[status] || `OpenRouter could not complete the decision (HTTP ${status}). Try again shortly.`;
  const message = data?.error?.message;
  const detail = typeof message === 'string' ? redact(message, apiKey).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500) : '';
  return detail ? `${hint} ${detail}` : hint;
}

async function readJson(response) {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('RESPONSE_TOO_LARGE');
  if (!response.body) throw new Error('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('RESPONSE_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_RESPONSE');
  }
}

export function createApp({ apiKey = '', fetchImpl = globalThis.fetch, timeoutMs = 60_000 } = {}) {
  const app = express();
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) {
      return res.status(403).json({ error: { code: 'INVALID_HOST', message: 'This app is available only through localhost.' } });
    }
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}`) {
      return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Cross-origin requests are not allowed.' } });
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Cross-site requests are not allowed.' } });
    }
    // Apply before Vite as well as production static serving.
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    if (pathname.split(/[\\/]/).some((segment) => segment.startsWith('.'))) return res.sendStatus(404);
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/config', (_req, res) => res.json({ keyConfigured: Boolean(key), model: MODEL }));
  app.post('/api/decide', (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ error: { code: 'INVALID_CONTENT_TYPE', message: 'Send application/json.' } });
    next();
  }, express.json({ limit: '256kb', strict: true }), async (req, res) => {
    const invalid = validatePayload(req.body);
    if (invalid) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: invalid } });
    if (!key) return res.status(503).json({ error: { code: 'MISSING_API_KEY', message: 'Add OPENROUTER_API_KEY to .env in the project folder, then restart the server.' } });

    const startedAt = performance.now();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    timeout.unref?.();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const upstream = await fetchImpl(DECISIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'Jev Lab' },
        body: JSON.stringify({ model: MODEL, state: req.body.state, questions: req.body.questions }),
        signal: controller.signal,
        redirect: 'error',
      });
      let data;
      try {
        data = await readJson(upstream);
      } catch (error) {
        if (controller.signal.aborted || upstream.ok) throw error;
        // Preserve useful status-specific guidance for HTML/plain-text upstream errors.
        data = null;
      }
      if (res.destroyed) return;
      if (!upstream.ok || data?.error) {
        const status = upstream.ok ? 502 : upstream.status;
        return res.status(status >= 400 && status <= 599 ? status : 502).json({
          error: { code: 'UPSTREAM_ERROR', message: upstreamMessage(status, data, key), upstreamStatus: status },
        });
      }
      if (!isRecord(data) || !isRecord(data.answers)) throw new Error('INVALID_RESPONSE');
      const safeData = JSON.parse(redact(data, key));
      res.json({ result: safeData, elapsedMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      if (res.destroyed) return;
      if (timedOut) return res.status(504).json({ error: { code: 'TIMEOUT', message: 'Jev did not respond within 60 seconds. Try again.' } });
      const message = error.message === 'RESPONSE_TOO_LARGE'
        ? 'OpenRouter returned an unexpectedly large response.'
        : error.message === 'INVALID_RESPONSE'
          ? 'OpenRouter returned an invalid Decisions response. Try again.'
          : 'Could not reach OpenRouter. Check your network connection and try again.';
      res.status(502).json({ error: { code: 'UPSTREAM_UNAVAILABLE', message } });
    } finally {
      clearTimeout(timeout);
      res.off('close', cancel);
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } }));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request must be smaller than 256 KB.' } });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The local server could not complete this request.' } });
  });
  return app;
}
