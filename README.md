# Jev Decision Lab

A local, seven-chapter interactive presentation for an SAP HCM developer and consultant audience. It introduces Jev, demonstrates bounded HCM decisions, and compares actual responses with two conventional LLMs. Performance charts contain measured runs only; no benchmark results are prefilled.

## Run locally

Requires Node.js **22.12 or newer**. Keep your OpenRouter key in the project-root `.env`:

```dotenv
OPENROUTER_API_KEY=your_key_here
# Optional: PORT=3000
```

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Restart the server after changing `.env`. The server listens on `127.0.0.1`.

The key stays on the Node server. Running a demo or comparison sends the supplied context and questions through OpenRouter to the selected provider and can consume your OpenRouter credits. Keep `.env` out of version control.

## Present the session

Use the sidebar, Previous/Next buttons, or **Left/Right arrows** and **Page Up/Page Down** outside form controls. The top bar opens **Sources**, **Presenter notes**, and fullscreen mode.

| Chapter                 | What to show                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Meet Jev             | Explore Choice, Boolean, and Score using clearly marked illustrative outputs.                                                          |
| 2. A different approach | Compare a decision specialist with general-purpose LLMs; speed, quality, and cost remain hypotheses to test.                           |
| 3. How it works         | Step through context, question definitions, shared evaluation, and application rules. Inspect the payload.                             |
| 4. Route an HCM case    | Keep an overtime complaint fixed and change the evidence: awaiting approval, missing payroll input, or missing payslip entry.          |
| 5. Check a request      | Check a working-hours request for an exact date, stated weekly total, work pattern, and approval evidence, then choose a review route. |
| 6. Put it to the test   | Run the same cases against all three configured models and inspect every attempt.                                                      |
| 7. What did we learn?   | Compare the measured agreement, latency, and cost, then discuss a possible application architecture.                                   |

The live HCM chapters provide editable messages and JSON evidence, preset scenarios, the fictional policy, **Run with Jev**, **Stop**, and request/response inspection. Edited scenarios are ungraded. **Reveal authored expectation** shows the author's rationale for the original preset; it is not a model-generated explanation.

This is a synthetic demonstration, with no SAP connection and no real employee records. It assigns review routes or checks information presence; it does not decide employment eligibility or authorize changes. Calendar validation and exact arithmetic belong in deterministic code, outside the model checks.

## Comparison setup

The model allowlist is defined in `server/evaluation.js`:

| Model                 | OpenRouter ID                  |
| --------------------- | ------------------------------ |
| Jev Latest            | `~typesafe/jev-latest`         |
| Gemini 2.5 Flash-Lite | `google/gemini-2.5-flash-lite` |
| Claude Sonnet 5.5     | `anthropic/claude-sonnet-5.5`  |

Select either workflow or both, a **six-case quick sample** or the full set (**12 per workflow; 24 combined**), and **one or three repeats**. The displayed request count includes every model and repeat. Six cases with one repeat make 18 requests; all 24 with three repeats make 216.

Every model receives identical state, policy, question definitions, and permitted answer meanings. All questions for a case travel in one request. Jev uses the Decisions API; the LLMs use chat completions with a strict JSON schema and no requested explanations or self-reported confidence. Expected answers and authored rationales are withheld from all requests.

The LLM wrapper and inference settings are visible in the inspected request. Gemini uses temperature 0; Claude uses low reasoning effort with reasoning excluded from the response. Both use a 2,048-token completion limit. These are documented operational settings, not a claim that the model architectures perform identical work.

Models run concurrently for each case, with one request in flight per model, rotating dispatch order, and no automatic retries. Provider load, network conditions, caching, routing, and alias updates can affect outcomes. Inspect the actual resolved model and provider for each attempt.

## Data and metric definitions

`src/hcm.js` contains **24 authored synthetic cases**, including negation, missing evidence, and conflicting employee assertions. The expected labels have **not received independent human review**. They support a demonstration of agreement with an answer key, not a validated HCM accuracy claim or a held-out production benchmark. Repeating the cases measures run variation; it does not add independent examples.

- **Answer agreement:** correctly matched fields divided by all labeled fields in noncancelled attempts. Choice labels match exactly; Jev Boolean probabilities use a fixed threshold of 0.5. Errors receive zero credit for every expected field.
- **All fields correct:** the fraction of labeled noncancelled attempts where every field matches. Errors count in the denominator.
- **Median/p95 response:** nearest-rank percentiles over successful, valid responses only. The normal timer covers the local server's provider round trip through response validation, including network overhead. Missing or invalid latency samples are excluded.
- **Reported cost:** actual returned `usage.cost`, including known costs for errors. Missing cost is unknown, never assumed zero; the UI shows a known subtotal plus an indication of missing costs.
- **Projected cost per 1,000:** total known billed cost divided by noncancelled attempts, multiplied by 1,000. It is unavailable if any included cost is missing and assumes the same workload mix.
- **Cancellation:** excluded from grading, latency, and cost summaries. Stopping or closing the page cannot guarantee provider processing or billing stops; an interrupted request may have additional unreported cost.

Small samples and incomplete runs do not establish a reliable ranking. Review disagreements, labels, errors, provider variability, and representative data before drawing deployment conclusions. Jev probabilities and confidence are model estimates, not correctness guarantees.

## Save, recover, and inspect

The comparison checkpoints every recorded attempt to this browser's `localStorage`, retaining the **last three actual sessions**. Reloading recovers an unfinished session as stopped, with completed responses preserved and an interruption notice. Unrecorded in-flight requests may still have incurred usage. Saved results are labeled recorded runs; they are not replayed as live responses.

Use **Load a recorded run**, inspect individual attempts, and **Export JSON** or **Copy JSON** to preserve evidence. A full JSON panel is available for manual copying. Exports include requested and resolved models, requests, responses, expected labels, grades, usage, and timings. Clearing browser site data removes local checkpoints; storage failures are reported in the UI.

**Import recording JSON** loads an exported session as a clearly marked imported recording. The importer checks the model IDs, cases, answer types, timing/cost values, and comparison coverage, then recalculates grades against the current authored labels. It cannot authenticate provider provenance. A local six-case rehearsal is available at `.test-artifacts/live-presentation-smoke.json` after the development verification; it contains actual responses and is excluded from Git.

## Build, checks, and local API

```sh
npm run build
npm start
npm test
```

The production server serves `dist`. The automated suite uses fake providers, without API charges. It covers request/response validation, grading, metrics, dataset consistency, timeouts, cancellation, credential redaction, and local-origin protections.

`GET /api/config` returns model configuration and whether a key is present, never the key. The existing `POST /api/decide` endpoint remains available for Jev payloads. `POST /api/evaluate` accepts `{ model, state, questions }` only for the configured allowlist, validates strict answer shapes, and returns normalized answers, raw response, request provenance, usage, and timing. Requests time out after 60 seconds. This is a local, single-user application.

## Sources

- [Jev Latest on OpenRouter](https://openrouter.ai/~typesafe/jev-latest)
- [TypeSafe System One](https://docs.typesafe.ai/concepts/system-one)
- [Multiple questions in one request](https://docs.typesafe.ai/patterns/fan-out)
- [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- [OpenRouter Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request)
