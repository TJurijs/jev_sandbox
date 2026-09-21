# Jev Lab

A local playground for testing [Jev Latest on OpenRouter](https://openrouter.ai/~typesafe/jev-latest). Jev evaluates supplied context against explicit questions and returns structured decisions. This app uses OpenRouter's [Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request).

## Run locally

Requires Node.js 22.12 or newer.

1. Keep your OpenRouter key in `.env` in this project folder:

   ```dotenv
   OPENROUTER_API_KEY=your_key_here
   ```

2. Install dependencies and start the local app:

   ```sh
   npm install
   npm run dev
   ```

3. Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The existing `.env` is read only by the Node server. Restart the server after changing the key. `PORT` may be set in `.env` to change the default port.

## Test a decision

Start with an example or a blank experiment. The Playground defines one question at a time, with a state (the context to evaluate) and one of three decision types:

- **Choice:** name the possible outcomes and describe each one.
- **Boolean (noul):** ask a yes/no question. The result is a value between 0 and 1 indicating support for the true outcome; the displayed answer is true at 0.5 or above.
- **Score:** describe an ordered scale from low to high. Jev returns a score over the zero-based positions on that scale.

Enter context as text or JSON. Text is sent as `{ "text": "..." }`; JSON mode accepts an object, array, or string. Use **View request** to inspect the payload before running it.

Click **Run decision** (or press Ctrl/Cmd + Enter) to see the answer, probability distributions when supplied, timing, token usage, and raw JSON. Requests use your OpenRouter account and may consume credits.

## Repeatable tests and saved results

The **Test suite** applies the current question to up to 25 editable test cases. Cases run sequentially, with one API request per case, using the current text/JSON input format. Optional expected answers provide grading:

- Choice answers must match the expected label exactly.
- Boolean answers use a 0.5 threshold (0.5 or above means true).
- Scores pass when they are within ±0.5 of the expected value.

Cases without expected answers are ungraded. Example labels are starting points, not a benchmark. You can stop a suite and keep its completed results.

The current experiment and last 40 runs are saved in this browser's `localStorage`. This includes inputs and results; clearing site data removes them. The app reports when browser storage is unavailable. **Run history** lets you reopen a previous experiment. **Export JSON** previews the current experiment and saved runs, with controls to copy the JSON or download `jev-lab-results.json`. Use **Copy JSON** in embedded browsers that do not support file downloads.

## Production build and checks

```sh
npm run build
npm start
```

The production server serves only the compiled `dist` directory. It listens on the local machine at `127.0.0.1`.

```sh
npm test
```

Tests use a fake provider and consume no API credits. They exercise payload validation, the upstream contract, error handling, credential redaction, local-origin restrictions, timeouts, and cancellation.

## API and limits

- `GET /api/config` returns the selected model and whether a key is configured. It never returns the key.
- `POST /api/decide` accepts `{ "state": ..., "questions": { ... } }` and returns `{ "result": ..., "elapsedMs": ... }`.
- The server always sends `~typesafe/jev-latest` to `https://openrouter.ai/api/alpha/decisions`.
- State accepts text, a JSON object, or a JSON array, up to 128 KB and 32 nested levels. A complete request must be under 256 KB.
- The UI sends one question per request; the local API accepts 1–24 questions. Choice questions accept 2–20 criteria, and score questions accept 2–10 ordered levels. Question instructions are limited to 4,000 characters and each criteria description to 2,000 characters.
- Requests time out after 60 seconds. Cancelling a request stops the local wait and attempts to abort the upstream connection; it cannot guarantee provider processing or charges stop.

Jev's Decisions interface does not offer chat conversations, token streaming, temperature, or other chat-generation controls in this app. The `latest` model alias and the alpha endpoint may change. Answers and available usage fields come directly from OpenRouter. An answer's confidence is a model estimate, not a guarantee of correctness.

The API key stays on the local server. State and questions are sent to OpenRouter when you run a decision. Keep `.env` out of version control and do not place secrets in files under `public` or `src`. This app is intended for local, single-user testing.
