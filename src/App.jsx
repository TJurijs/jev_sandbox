import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  Copy,
  Database,
  FileCheck2,
  GitBranch,
  Layers,
  Maximize,
  Minimize,
  Network,
  Play,
  ShieldCheck,
  Square,
  Target,
  Workflow,
  X,
} from "lucide-react";
import { WORKFLOWS, makePayload, scoreAnswers } from "./hcm.js";
import Benchmark, { Findings } from "./Benchmark.jsx";

const CHAPTERS = [
  { id: "intro", label: "Meet Jev", kicker: "A different shape of AI" },
  {
    id: "compare",
    label: "A different approach",
    kicker: "Specialist meets generalist",
  },
  { id: "how", label: "How it works", kicker: "From context to a decision" },
  { id: "triage", label: "Route an HCM case", kicker: "Live example · 01" },
  { id: "completeness", label: "Check a request", kicker: "Live example · 02" },
  {
    id: "benchmark",
    label: "Put it to the test",
    kicker: "Same cases. Measured outcomes.",
  },
  {
    id: "findings",
    label: "What did we learn?",
    kicker: "Evidence into architecture",
  },
];
const NOTES = [
  "Start with the interface: Jev evaluates supplied context against defined questions. Introduce the three answer types. A structured result is useful because an application can immediately consume it. Do not claim a new architecture beyond the published documentation.",
  "General-purpose LLMs can also produce schema-constrained outputs. Our question is whether a decision specialist is a better fit for these bounded tasks. Quality, speed, and cost are separate measurements; none is assumed in advance.",
  "Show what the application supplies: policy, message, and verified facts. The question defines the meaning of every answer. Several independent questions travel in one request. Business rules still belong in code when they require exact arithmetic or eligibility calculations.",
  "Use the same overtime complaint three times. Change only the evidence: awaiting approval, approved but missing input, then confirmed input but missing payslip payment. Let the audience predict the owner before each run. The displayed explanation belongs to the authored case, not the model.",
  "Start with the vague request. Switch to the complete request, then try the claimed-approval case. All five checks run together. Presence of evidence is a suitable bounded task; judging a person or deciding employment terms is outside this demo.",
  "Run the six-case preview first. Explain that labels are authored and have not had independent human review. All models receive the same semantic input and questions. Latency is measured at our server, including network/provider overhead. Small live batches are demonstrations, not statistically reliable rankings.",
  "Read the results even when they challenge the premise. Check disagreements before choosing a model. Agree on a reviewed test set and acceptance criteria for the next experiment. Suggest a bounded decision layer only where measured quality and operational needs justify it.",
];
const SOURCES = [
  ["Jev on OpenRouter", "https://openrouter.ai/~typesafe/jev-latest"],
  ["TypeSafe · System One", "https://docs.typesafe.ai/concepts/system-one"],
  [
    "TypeSafe · Multiple questions",
    "https://docs.typesafe.ai/patterns/fan-out",
  ],
  [
    "Jev 1.13 · Known limitations",
    "https://docs.typesafe.ai/model-jaggedness/jev-1.13",
  ],
  [
    "OpenRouter · Decisions API",
    "https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request",
  ],
];
const human = (value) =>
  typeof value === "boolean"
    ? value
      ? "Yes"
      : "No"
    : String(value ?? "—").replaceAll("_", " ");
const money = (value) =>
  typeof value === "number"
    ? "$" + value.toFixed(value < 0.01 ? 7 : 4)
    : "Not reported";
const FIELD_NAMES = {
  issue: "Issue category",
  owner: "Next owner",
  needs_clarification: "Needs clarification",
  exact_date: "Exact effective date",
  weekly_hours: "Weekly hours stated",
  work_pattern: "Working pattern stated",
  approval_evidence: "Verified approval",
  route: "Processing route",
};

function PageHeading({ eyebrow, title, children, badge }) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {badge && <span className="pill">{badge}</span>}
    </header>
  );
}

function Intro({ onNext }) {
  const [type, setType] = useState("choice");
  const types = {
    choice: {
      label: "Choice",
      icon: GitBranch,
      description: "Select from a defined set of outcomes.",
      question: "Who should handle this payroll case?",
      output: "payroll",
      note: "A named outcome your workflow can use.",
    },
    noul: {
      label: "Yes / no",
      icon: CheckCircle2,
      description: "Evaluate support for a true / false question.",
      question: "Is verified manager approval present?",
      output: "0.97",
      note: "A probability-like value, mapped to a boolean at a chosen threshold.",
    },
    score: {
      label: "Score",
      icon: Layers,
      description: "Evaluate against an ordered, described scale.",
      question: "How complete is this request?",
      output: "2.4 / 3",
      note: "Example rubric: 0 none · 1 partial · 2 mostly complete · 3 complete.",
    },
  };
  const selected = types[type];
  return (
    <div className="intro-page">
      <div className="intro-copy">
        <div className="eyebrow">
          <span className="blue-dot" /> An AI stream field session
        </div>
        <h1>
          Meet Jev.
          <br />
          AI for{" "}
          <span>
            structured
            <br className="desktop-break" /> decisions.
          </span>
        </h1>
        <p className="hero-description">
          Give it context. Define the question.
          <br />
          Get a result your application can act on.
        </p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={onNext}>
            Explore the approach <ArrowRight size={17} />
          </button>
          <span className="session-length">7 chapters · live HCM examples</span>
        </div>
        <div className="intro-footnote">
          A decision model from TypeSafe, available through OpenRouter.
          <br />
          This session tests where it fits alongside general-purpose LLMs.
        </div>
      </div>
      <div className="intro-visual">
        <div className="visual-header">
          <span className="eyebrow">The decision interface</span>
          <span className="pill small">Illustrative example</span>
        </div>
        <div className="context-card">
          <div className="small-label">
            <Database size={14} /> Context
          </div>
          <p>
            “My overtime is missing
            <br />
            from this month’s payslip.”
          </p>
          <div className="context-facts">
            <span>Approval verified</span>
            <span>Payroll input confirmed</span>
          </div>
        </div>
        <div className="diagram-connector">
          <span />
        </div>
        <div className="jev-node">
          <div className="brand-glyph small-glyph">
            <span />
            <span />
            <span />
          </div>
          <strong>jev</strong>
          <span>Defined question → typed answer</span>
        </div>
        <div className="diagram-connector">
          <span />
        </div>
        <div
          className="primitive-tabs"
          role="tablist"
          aria-label="Decision types"
        >
          {Object.entries(types).map(([key, item]) => (
            <button
              key={key}
              role="tab"
              aria-selected={type === key}
              onClick={() => setType(key)}
              className={type === key ? "active" : ""}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="primitive-result" role="tabpanel">
          <div>
            <span className="small-label">{selected.description}</span>
            <p>{selected.question}</p>
          </div>
          <code>{selected.output}</code>
          <span className="primitive-note">{selected.note}</span>
        </div>
      </div>
      <div className="intro-bottom">
        <span>01 / UNDERSTAND THE MODEL</span>
        <span>02 / TRY REAL WORKFLOWS</span>
        <span>03 / MEASURE THE TRADE-OFFS</span>
      </div>
    </div>
  );
}

function Comparison() {
  return (
    <>
      <PageHeading
        eyebrow="02 · The mental model"
        title="Two tools. An overlapping job."
      >
        Both can make structured decisions. The useful question is where each
        fits.
      </PageHeading>
      <div className="comparison-table panel">
        <div className="comparison-row table-head">
          <div>What changes?</div>
          <div>
            <span className="table-model">Jev</span>
            <span>Specialized decision interface</span>
          </div>
          <div>
            <span className="table-model">General-purpose LLM</span>
            <span>A broad generation interface</span>
          </div>
        </div>
        {[
          [
            "Your input",
            "Context + questions + described outcomes",
            "Messages + instructions + output schema",
          ],
          [
            "Your output",
            "Choice, yes/no value, or rubric score",
            "Text, code, tool calls, or structured JSON",
          ],
          [
            "Typical role",
            "Classify, route, check, and score",
            "Explain, draft, reason, and orchestrate",
          ],
          [
            "Structured decisions",
            "The central interface",
            "Supported through constrained outputs",
          ],
          [
            "What to verify",
            "Task quality, probabilities, latency, and cost",
            "Task quality, schema validity, latency, and cost",
          ],
        ].map(([label, jev, llm]) => (
          <div className="comparison-row" key={label}>
            <strong>{label}</strong>
            <span>{jev}</span>
            <span>{llm}</span>
          </div>
        ))}
      </div>
      <div className="hypothesis-grid">
        {[
          [Clock3, "Speed", "How quickly can it return a usable decision?"],
          [
            Target,
            "Accuracy",
            "Does it match the expected decision on these cases?",
          ],
          [
            CircleDollarSign,
            "Cost",
            "What does each completed workflow actually cost?",
          ],
        ].map(([Icon, title, text]) => (
          <div className="hypothesis" key={title}>
            <Icon size={21} />
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            <span className="small-label">To be measured</span>
          </div>
        ))}
      </div>
      <div className="callout">
        <InfoMark />
        The premise is a specialist for a bounded task. The outcome is something
        we measure.
      </div>
    </>
  );
}
function InfoMark() {
  return <span className="info-mark">i</span>;
}

function HowItWorks() {
  const [step, setStep] = useState(0);
  const [raw, setRaw] = useState(false);
  const sample = WORKFLOWS.triage.presets[2] || WORKFLOWS.triage.presets[0];
  const steps = [
    {
      icon: Database,
      title: "Supply context",
      caption: "Message + facts + policy",
      content: (
        <>
          <span className="small-label">Synthetic HCM case</span>
          <blockquote>“My overtime is missing from my payslip.”</blockquote>
          <div className="fact-row">
            <Check size={16} />
            Manager approval verified
          </div>
          <div className="fact-row">
            <Check size={16} />
            Payroll input confirmed
          </div>
          <div className="fact-row">
            <X size={16} />
            Payment missing from payslip
          </div>
        </>
      ),
    },
    {
      icon: FileCheck2,
      title: "Define questions",
      caption: "Make every outcome explicit",
      content: (
        <>
          <span className="small-label">
            One request · independent questions
          </span>
          <div className="question-preview">
            <span>01</span>
            <div>
              <strong>What kind of issue is this?</strong>
              <p>Overtime · Leave balance · Employee record · Other</p>
            </div>
          </div>
          <div className="question-preview">
            <span>02</span>
            <div>
              <strong>Who should handle it next?</strong>
              <p>
                Manager · Time management · Payroll · Employee data ·
                Clarification
              </p>
            </div>
          </div>
          <div className="question-preview">
            <span>03</span>
            <div>
              <strong>Do we need more evidence?</strong>
              <p>Yes / no, based on the supplied policy</p>
            </div>
          </div>
        </>
      ),
    },
    {
      icon: Network,
      title: "Evaluate together",
      caption: "Typed answers from Jev",
      content: (
        <>
          <span className="small-label">
            Illustrative expected output · not a live result
          </span>
          <pre className="large-code">
            {
              '{\n  "issue": "overtime_payment",\n  "owner": "payroll",\n  "needs_clarification": false\n}'
            }
          </pre>
          <p className="muted">
            The API also returns available probabilities and usage. A high
            probability is a model estimate, not a correctness guarantee.
          </p>
        </>
      ),
    },
    {
      icon: Workflow,
      title: "Use in a workflow",
      caption: "Your application stays in control",
      content: (
        <>
          <span className="small-label">Illustrative application logic</span>
          <div className="workflow-route">
            <div>
              <FileCheck2 size={22} />
              <strong>Structured result</strong>
            </div>
            <ArrowRight />
            <div>
              <GitBranch size={22} />
              <strong>Validation & rules</strong>
            </div>
            <ArrowRight />
            <div>
              <Layers size={22} />
              <strong>Payroll queue</strong>
            </div>
          </div>
          <p className="muted">
            Validate the schema. Apply your process rules. Send ambiguous cases
            for review. Keep exact calculations in deterministic code.
          </p>
        </>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="03 · The request lifecycle"
        title="Context in. A usable decision out."
      >
        The application supplies the meaning. The model evaluates the evidence.
      </PageHeading>
      <div className="process-steps">
        {steps.map((item, i) => (
          <button
            onClick={() => setStep(i)}
            key={item.title}
            className={"process-step " + (step === i ? "active" : "")}
          >
            <span className="step-icon">
              <item.icon size={22} />
            </span>
            <span className="small-label">0{i + 1}</span>
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </button>
        ))}
      </div>
      <div className="process-detail panel">
        <div className="process-detail-head">
          <h2>{steps[step].title}</h2>
          <button
            className="text-button"
            onClick={() => setStep((step + 1) % 4)}
          >
            Next step <ArrowRight size={16} />
          </button>
        </div>
        {steps[step].content}
      </div>
      <div className="how-bottom">
        <div className="callout">
          <Layers size={18} />
          Multiple questions can share a single request. We measure the whole
          request, not just one answer.
        </div>
        <button
          className="button button-secondary"
          onClick={() => setRaw(!raw)}
        >
          <Code2 size={16} />
          {raw ? "Hide" : "Inspect"} the payload
        </button>
      </div>
      {raw && <JsonBlock value={makePayload("triage", sample)} />}
    </>
  );
}

function JsonBlock({ value }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard unavailable. Select and copy the JSON below.");
    }
  }
  return (
    <div className="json-block">
      <button className="json-copy" onClick={copy}>
        <Copy size={13} />
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{JSON.stringify(value, null, 2)}</pre>
      {error && <p>{error}</p>}
    </div>
  );
}

function LiveDemo({ workflowId, config, inferenceBusy, onBusyChange }) {
  const workflow = WORKFLOWS[workflowId];
  const [selected, setSelected] = useState(workflow.presets[0]);
  const [message, setMessage] = useState(selected.message);
  const [facts, setFacts] = useState(JSON.stringify(selected.facts, null, 2));
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [expected, setExpected] = useState(false);
  const controller = useRef(null);
  const isTriage = workflowId === "triage";
  const edited =
    message !== selected.message ||
    facts !== JSON.stringify(selected.facts, null, 2);
  const grade =
    response && !edited
      ? scoreAnswers(workflow.questions, selected.expected, response.answers)
      : null;
  useEffect(() => () => controller.current?.abort(), []);
  function choose(item) {
    setSelected(item);
    setMessage(item.message);
    setFacts(JSON.stringify(item.facts, null, 2));
    setResponse(null);
    setError("");
    setExpected(false);
  }
  function edit(setter, value) {
    setter(value);
    setResponse(null);
    setError("");
  }
  async function run() {
    if (busy || inferenceBusy) return;
    setError("");
    setResponse(null);
    let parsed;
    try {
      parsed = JSON.parse(facts);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error();
    } catch {
      setError("Evidence must be a valid JSON object.");
      return;
    }
    if (!message.trim()) {
      setError("Enter an employee message.");
      return;
    }
    const payload = makePayload(workflowId, { message, facts: parsed });
    setBusy(true);
    onBusyChange(true);
    controller.current = new AbortController();
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config?.model || "~typesafe/jev-latest",
          ...payload,
        }),
        signal: controller.current.signal,
      });
      const body = await res.json();
      if (!res.ok) {
        setResponse(body);
        throw new Error(body.error?.message || "The request failed.");
      }
      setResponse(body);
    } catch (err) {
      setError(
        err.name === "AbortError"
          ? "Request stopped. Provider processing or charges may still occur."
          : err.message,
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
      controller.current = null;
    }
  }
  let preview;
  try {
    preview = makePayload(workflowId, { message, facts: JSON.parse(facts) });
  } catch {
    preview = { error: "Correct the evidence JSON to preview the request." };
  }
  return (
    <>
      <PageHeading
        eyebrow={
          isTriage ? "04 · Live HCM triage" : "05 · Live request completeness"
        }
        title={
          isTriage
            ? "Same complaint. Different next step."
            : "One request. Five useful checks."
        }
        badge="Synthetic HCM data"
      >
        {isTriage
          ? "Change the evidence and see how the routing decision changes."
          : "Turn an informal working-hours request into explicit completeness checks."}
      </PageHeading>
      <div className="demo-presets">
        {workflow.presets.map((item, i) => (
          <button
            key={item.id}
            onClick={() => choose(item)}
            disabled={busy}
            className={
              "preset-button " + (selected.id === item.id ? "active" : "")
            }
          >
            <span>0{i + 1}</span>
            {item.label}
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <div className="demo-grid">
        <div className="panel demo-input">
          <div className="panel-heading">
            <span className="eyebrow">The case</span>
            {edited && <span className="pill small">Edited · ungraded</span>}
          </div>
          <label className="field">
            Employee message
            <textarea
              aria-label={`${isTriage ? "Triage" : "Completeness"} employee message`}
              value={message}
              onChange={(e) => edit(setMessage, e.target.value)}
              disabled={busy}
              rows={3}
            />
          </label>
          <label className="field">
            Verified evidence{" "}
            <span className="field-hint">
              Editable JSON from a fictional system
            </span>
            <textarea
              className="code-input"
              aria-label={`${isTriage ? "Triage" : "Completeness"} evidence`}
              value={facts}
              onChange={(e) => edit(setFacts, e.target.value)}
              disabled={busy}
              rows={6}
              spellCheck={false}
            />
          </label>
          <details className="policy-details">
            <summary>Read the decision policy</summary>
            <p>{workflow.policy}</p>
          </details>
          <div className="demo-run-row">
            <button
              className="button button-primary"
              onClick={run}
              disabled={busy || inferenceBusy || !config?.keyConfigured}
            >
              {busy ? <span className="spinner" /> : <Play size={15} />}{" "}
              {busy ? "Evaluating…" : "Run with Jev"}
            </button>
            {busy && (
              <button
                className="button button-secondary"
                onClick={() => controller.current?.abort()}
              >
                <Square size={13} />
                Stop
              </button>
            )}
            <span className="small-label">
              {Object.keys(workflow.questions).length} questions · 1 API request
            </span>
          </div>
          {!config?.keyConfigured && (
            <p className="form-error">
              {config
                ? "Add OPENROUTER_API_KEY to .env and restart the local server."
                : "Connecting to the local server…"}
            </p>
          )}
          <p className="input-footnote">
            {inferenceBusy && !busy
              ? "Another run is active. Wait for it to finish before starting this demo."
              : "Runs use OpenRouter credits. Context and questions are sent to the provider."}
          </p>
        </div>
        <div className="panel demo-output">
          <div className="panel-heading">
            <span className="eyebrow">The decision</span>
            <span
              className={
                "pill small " +
                (busy ? "pill-blue" : response?.answers ? "pill-green" : "")
              }
            >
              {busy
                ? "Live request"
                : response?.answers
                  ? "Measured result"
                  : "Ready to evaluate"}
            </span>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {response?.answers ? (
            <>
              <div className="answer-list">
                {Object.keys(workflow.questions).map((key) => {
                  const answer = response.answers[key];
                  return (
                    <div className="answer-row" key={key}>
                      <span>{FIELD_NAMES[key] || human(key)}</span>
                      <strong
                        className={
                          typeof answer?.value === "boolean"
                            ? answer.value
                              ? "bool-yes"
                              : "bool-no"
                            : ""
                        }
                      >
                        {human(answer?.value)}
                      </strong>
                      {answer?.probabilities && (
                        <div className="probability-list">
                          {Object.entries(answer.probabilities)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([label, p]) => (
                              <div className="probability-row" key={label}>
                                <span>{human(label)}</span>
                                <div>
                                  <i
                                    style={{
                                      width: `${Math.max(0, Math.min(1, p)) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span>{(p * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="demo-metrics">
                <div>
                  <span>End-to-end</span>
                  <strong>
                    {(response.elapsedMs / 1000).toFixed(2)}
                    <small> s</small>
                  </strong>
                </div>
                <div>
                  <span>Reported cost</span>
                  <strong>{money(response.usage?.cost)}</strong>
                </div>
                <div>
                  <span>Input tokens</span>
                  <strong>{response.usage?.input_tokens ?? "—"}</strong>
                </div>
              </div>
              <p className="resolved-model">
                {response.model} ·{" "}
                {response.provider || "Provider not reported"}
              </p>
              {grade && (
                <div className="label-match">
                  <CheckCircle2 size={15} />
                  {grade.correct}/{grade.total} authored labels matched
                  <span>Not independently reviewed</span>
                </div>
              )}
              <p className="input-footnote">
                Yes/no values use a 0.5 threshold. Probabilities are estimates,
                not guarantees.
              </p>
            </>
          ) : (
            <div className={"empty-result " + (busy ? "is-running" : "")}>
              <div className="empty-result-icon">
                <Network size={29} />
              </div>
              <h3>
                {busy ? "Evaluating the evidence" : "What should happen next?"}
              </h3>
              <p>
                {busy
                  ? "Waiting for a complete structured response from Jev."
                  : "Predict the result, then run the case to reveal the model’s decision."}
              </p>
              <div className="empty-questions">
                {Object.keys(workflow.questions).map((key) => (
                  <span key={key}>{FIELD_NAMES[key] || human(key)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="demo-bottom">
        <button className="text-button" onClick={() => setExpected(!expected)}>
          {expected ? "Hide" : "Reveal"} authored expectation{" "}
          <ChevronRight size={15} />
        </button>
        <button className="text-button" onClick={() => setInspect(!inspect)}>
          <Code2 size={16} />
          {inspect ? "Hide" : "Inspect"} request & response
        </button>
      </div>
      {expected && (
        <div className="notice">
          <strong>
            Authored expectation{edited ? " for the original preset" : ""}
          </strong>
          <p>{selected.explanation}</p>
          <p className="small-label">
            {Object.entries(selected.expected)
              .map(
                ([key, value]) =>
                  `${FIELD_NAMES[key] || human(key)}: ${human(value)}`,
              )
              .join(" · ")}
          </p>
        </div>
      )}
      {inspect && (
        <div className="inspect-grid">
          <div>
            <h3>Sent context and questions</h3>
            <JsonBlock value={response?.request || preview} />
          </div>
          <div>
            <h3>Provider response</h3>
            <JsonBlock value={response?.raw || { status: "No response yet" }} />
          </div>
        </div>
      )}
    </>
  );
}

function Takeaways({ session, onNavigate }) {
  return (
    <>
      <PageHeading
        eyebrow="07 · Evidence into architecture"
        title="Give each model a job it can prove."
      >
        Start with the measured results. Then decide where a decision layer
        belongs.
      </PageHeading>
      <Findings session={session} onNavigate={() => onNavigate(5)} />
      <div className="architecture panel">
        <div className="panel-heading">
          <span className="eyebrow">A possible HCM pattern</span>
          <span className="pill small">Design proposal</span>
        </div>
        <div className="architecture-flow">
          <div>
            <Database size={24} />
            <strong>Trusted context</strong>
            <span>Message + verified facts</span>
          </div>
          <ArrowRight />
          <div className="architecture-highlight">
            <Network size={24} />
            <strong>Decision layer</strong>
            <span>Classify · check · route</span>
          </div>
          <ArrowRight />
          <div>
            <ShieldCheck size={24} />
            <strong>Application rules</strong>
            <span>Validate + apply policy</span>
          </div>
          <ArrowRight />
          <div>
            <Workflow size={24} />
            <strong>Next action</strong>
            <span>Queue, LLM, or review</span>
          </div>
        </div>
      </div>
      <div className="takeaway-grid">
        <div>
          <span className="small-label">Use a bounded decision</span>
          <p>
            When outcomes are defined and you have evidence that quality, speed,
            and cost fit.
          </p>
        </div>
        <div>
          <span className="small-label">Use a general-purpose LLM</span>
          <p>
            When the workflow needs an explanation, a draft, a conversation, or
            broader tool use.
          </p>
        </div>
        <div>
          <span className="small-label">Validate before rollout</span>
          <p>
            Review labels, add representative cases, set acceptance criteria,
            and test failure handling.
          </p>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [chapter, setChapter] = useState(() =>
    Math.max(
      0,
      CHAPTERS.findIndex((x) => x.id === location.hash.slice(1)),
    ),
  );
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [notes, setNotes] = useState(false);
  const [sources, setSources] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [session, setSession] = useState(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const content = useRef(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error("Cannot reach the local API.");
        return r.json();
      })
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, []);
  function go(index) {
    const next = Math.min(6, Math.max(0, index));
    setChapter(next);
    history.replaceState(null, "", "#" + CHAPTERS[next].id);
    content.current?.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    function keyboard(event) {
      if (
        event.target.closest(
          'input,textarea,select,[role="tab"],[contenteditable="true"]',
        ) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(chapter + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(chapter - 1);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [chapter]);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setConfigError(
        "Fullscreen is unavailable in this browser. You can still use all presentation controls.",
      );
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#intro"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go(0);
          }}
          aria-label="Jev decision lab home"
        >
          <div className="brand-glyph">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>
              jev<span> /</span>
            </strong>
            <span>DECISION LAB</span>
          </div>
        </a>
        <div className="sidebar-label">THE PRESENTATION</div>
        <nav aria-label="Presentation chapters">
          {CHAPTERS.map((item, i) => (
            <button
              key={item.id}
              className={"chapter-link " + (chapter === i ? "active" : "")}
              onClick={() => go(i)}
              aria-current={chapter === i ? "step" : undefined}
            >
              <span className="chapter-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{item.label}</span>
              {chapter === i && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-session">
          <span className="small-label">TODAY’S LENS</span>
          <h3>Decisions in HCM</h3>
          <p>
            From an employee request
            <br />
            to a useful next step.
          </p>
          <div className="sidebar-tags">
            <span>Speed</span>
            <span>Accuracy</span>
            <span>Cost</span>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div>
            <span
              className={
                "status-dot " + (config?.keyConfigured ? "connected" : "")
              }
            />
            {config?.keyConfigured
              ? "OpenRouter connected"
              : config
                ? "API key not configured"
                : "Connecting…"}
          </div>
          <span>Local session · synthetic data</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            AI STREAM <span>/</span> <strong>{CHAPTERS[chapter].kicker}</strong>
          </div>
          <div className="topbar-actions">
            <button
              onClick={() => setSources(!sources)}
              className={sources ? "active" : ""}
            >
              <BookOpen size={15} />
              <span>Sources</span>
            </button>
            <button
              onClick={() => setNotes(!notes)}
              className={notes ? "active" : ""}
            >
              <FileCheck2 size={15} />
              <span>Presenter notes</span>
            </button>
            <button
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </header>
        <main ref={content} className="content" id="main-content">
          {configError && (
            <div className="notice error" role="alert">
              {configError}
              <button
                className="text-button"
                onClick={() => setConfigError("")}
              >
                Dismiss
              </button>
            </div>
          )}
          {sources && (
            <aside className="sources-panel panel">
              <div className="panel-heading">
                <strong>Source material</strong>
                <button
                  className="icon-button"
                  onClick={() => setSources(false)}
                  aria-label="Close sources"
                >
                  <X size={17} />
                </button>
              </div>
              <p>
                Product facts come from these sources. Performance claims come
                from the runs in this app.
              </p>
              {SOURCES.map(([label, url]) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {label}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </aside>
          )}
          {notes && (
            <aside className="presenter-notes">
              <span className="eyebrow">Presenter notes · {chapter + 1}/7</span>
              <p>{NOTES[chapter]}</p>
            </aside>
          )}
          <section hidden={chapter !== 0} aria-label="Meet Jev">
            <Intro onNext={() => go(1)} />
          </section>
          <section hidden={chapter !== 1} aria-label="A different approach">
            <Comparison />
          </section>
          <section hidden={chapter !== 2} aria-label="How it works">
            <HowItWorks />
          </section>
          <section hidden={chapter !== 3} aria-label="Route an HCM case">
            <LiveDemo
              workflowId="triage"
              config={config}
              inferenceBusy={liveBusy || session?.status === "running"}
              onBusyChange={setLiveBusy}
            />
          </section>
          <section hidden={chapter !== 4} aria-label="Check a request">
            <LiveDemo
              workflowId="completeness"
              config={config}
              inferenceBusy={liveBusy || session?.status === "running"}
              onBusyChange={setLiveBusy}
            />
          </section>
          <section hidden={chapter !== 5} aria-label="Model comparison">
            <PageHeading
              eyebrow="06 · A controlled comparison"
              title="Let the results do the talking."
            >
              Same context. Same questions. Three models. Real measurements.
            </PageHeading>
            <Benchmark
              models={config?.models || []}
              onSessionChange={setSession}
              enabled={Boolean(config?.keyConfigured)}
              externallyBusy={liveBusy}
            />
          </section>
          <section hidden={chapter !== 6} aria-label="Findings">
            <Takeaways session={session} onNavigate={go} />
          </section>
        </main>
        <footer className="presentation-footer">
          <button
            className="text-button"
            onClick={() => go(chapter - 1)}
            disabled={chapter === 0}
          >
            <ChevronLeft size={17} />
            Previous
          </button>
          <div className="footer-progress">
            <span>
              {String(chapter + 1).padStart(2, "0")} <em>/ 07</em>
            </span>
            <div>
              {CHAPTERS.map((item, i) => (
                <button
                  key={item.id}
                  aria-label={`Go to ${item.label}`}
                  onClick={() => go(i)}
                  className={i <= chapter ? "complete" : ""}
                />
              ))}
            </div>
            <span className="keyboard-hint">← → to navigate</span>
          </div>
          <button
            className="text-button next-button"
            onClick={() => go(chapter + 1)}
            disabled={chapter === 6}
          >
            {chapter === 0
              ? "Start exploring"
              : chapter === 6
                ? "End of session"
                : "Next chapter"}
            <ChevronRight size={17} />
          </button>
        </footer>
      </div>
    </div>
  );
}
