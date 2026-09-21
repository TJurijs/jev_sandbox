import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Square,
  ToggleLeft,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { PRESETS } from "./presets.js";
import {
  answerLabel,
  buildRequest,
  checkExpected,
  downloadJson,
  getAnswer,
  probabilityEntries,
  safeLoad,
  updateDraft,
} from "./lib.js";

const clone = (value) => structuredClone(value);
const newId = () => crypto.randomUUID();
const TYPES = [
  { value: "choice", label: "Choice", icon: GitBranch },
  { value: "noul", label: "Boolean", icon: ToggleLeft },
  { value: "score", label: "Score", icon: Scale },
];
const dateLabel = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
const costLabel = (value) =>
  typeof value === "number"
    ? `$${value.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`
    : "—";
const percent = (value) =>
  `${(Math.min(1, Math.max(0, value)) * 100).toFixed(1)}%`;

function Logo({ small = false }) {
  return (
    <div className={`logo ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path d="M26 9v15a8 8 0 0 1-16 0" />
        <circle cx="14" cy="11" r="2.7" />
      </svg>
    </div>
  );
}

function Result({ run, busy, elapsed, onRun, canRun }) {
  const [view, setView] = useState("result");
  const [copied, setCopied] = useState(false);
  const answer = getAnswer(run?.result);
  const probabilities = probabilityEntries(answer);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(run.result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="panel result-panel">
      <div className="panel-heading">
        <div className="heading-label">
          <span className="step">03</span>
          <h2>The decision</h2>
        </div>
        <span
          className={`small-status ${busy ? "working" : run ? "complete" : ""}`}
        >
          <i />
          {busy
            ? "Evaluating"
            : run?.error
              ? "Failed"
              : run
                ? "Complete"
                : "Ready when you are"}
        </span>
      </div>
      <div className="result-tabs">
        <button
          className={view === "result" ? "active" : ""}
          onClick={() => setView("result")}
        >
          Result
        </button>
        <button
          className={view === "json" ? "active" : ""}
          onClick={() => setView("json")}
        >
          <Braces size={14} /> Raw JSON
        </button>
        {run?.result && (
          <button className="copy-btn" onClick={copy} title="Copy response">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
      {busy ? (
        <div className="empty-result">
          <div className="result-glyph pulse">
            <Logo />
          </div>
          <h3>Making the call.</h3>
          <p>
            Jev is evaluating your input against
            <br />
            the answers you defined.
          </p>
          <span className="mono waiting-time">
            {(elapsed / 1000).toFixed(1)}s elapsed
          </span>
        </div>
      ) : run?.error ? (
        <div className="error-result" role="alert">
          <span className="error-icon">
            <X size={24} />
          </span>
          <h3>This run didn’t finish</h3>
          <p>{run.error}</p>
          <button
            className="button secondary"
            onClick={onRun}
            disabled={!canRun}
          >
            <RotateCcw size={14} />
            Try again
          </button>
        </div>
      ) : !run ? (
        <div className="empty-result">
          <div className="decision-graphic" aria-hidden="true">
            <span className="graphic-input">
              <Layers3 size={21} />
            </span>
            <span className="graphic-path" />
            <Logo />
            <span className="graphic-path" />
            <span className="graphic-answer">
              <Check size={20} />
            </span>
          </div>
          <h3>A question. A clear answer.</h3>
          <p>
            Run your experiment to see the decision,
            <br />
            its probabilities, and request metrics.
          </p>
          <span className="keyboard-hint">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run
          </span>
        </div>
      ) : view === "json" ? (
        <pre className="json-output">{JSON.stringify(run.result, null, 2)}</pre>
      ) : (
        <div className="decision-content">
          <div className="answer-eyebrow">
            {answer?.type === "score"
              ? "PREDICTED SCORE"
              : answer?.type === "noul"
                ? "BOOLEAN DECISION"
                : "SELECTED ANSWER"}
          </div>
          <div className="answer-value">
            <span>{answerLabel(answer)}</span>
            <span className="answer-check">
              <Check size={20} />
            </span>
          </div>
          {typeof answer?.noul === "number" && (
            <p className="answer-note">
              P(true) = {percent(answer.noul)} · threshold 50%
            </p>
          )}
          {answer?.type === "score" && (
            <p className="answer-note">
              On a scale of 0–{run.draft.criteria.length - 1} ·
              probability-weighted score
            </p>
          )}
          {typeof answer?.confidence === "number" && (
            <div className="confidence-line">
              <span>
                Model confidence{" "}
                <span title="A measure of the probability distribution, not the probability of the selected answer.">
                  <CircleHelp size={12} />
                </span>
              </span>
              <strong>{percent(answer.confidence)}</strong>
            </div>
          )}
          <div className="probability-title">ANSWER PROBABILITIES</div>
          <div className="probabilities">
            {probabilities.map(([label, probability], i) => (
              <div className="probability" key={label}>
                <div>
                  <span>
                    {answer?.type === "score"
                      ? `${label} · ${run.draft.criteria[Number(label)]?.label || answer.legend?.[label] || "Level"}`
                      : label}
                  </span>
                  <span className="mono">{percent(probability)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className={
                      (i === 0 && answer?.type !== "noul") ||
                      label === answerLabel(answer)
                        ? "highlight"
                        : ""
                    }
                    style={{
                      width: `${Math.min(1, Math.max(0, probability)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!answer && (
            <p className="notice">
              The provider returned no decision. Inspect Raw JSON for the
              response.
            </p>
          )}
        </div>
      )}
      {run?.result && !busy && (
        <>
          <div className="metrics">
            <div>
              <Clock3 size={14} />
              <span>Latency</span>
              <strong>
                {Math.round(run.elapsedMs)}
                <small> ms</small>
              </strong>
            </div>
            <div>
              <Layers3 size={14} />
              <span>Input tokens</span>
              <strong>
                {run.result.usage?.input_tokens?.toLocaleString() ?? "—"}
              </strong>
            </div>
            <div>
              <Zap size={14} />
              <span>Cost</span>
              <strong>{costLabel(run.result.usage?.cost)}</strong>
            </div>
          </div>
          <div className="model-footnote">
            <span className="status-dot" />
            <span className="mono">
              {run.result.model || "Model not reported"}
            </span>
            <span>{run.result.provider}</span>
          </div>
        </>
      )}
      {!run && !busy && (
        <div className="result-tip">
          <ShieldCheck size={16} />
          <span>
            Structured answers, directly from Jev.
            <br />
            <span>No generated explanations or reasoning.</span>
          </span>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [draft, setDraft] = useState(() => {
    const value = safeLoad("jev-draft-v1", null);
    return value &&
      Array.isArray(value.criteria) &&
      Array.isArray(value.cases) &&
      typeof value.input === "string"
      ? value
      : clone(PRESETS[0]);
  });
  const [runs, setRuns] = useState(() => {
    const value = safeLoad("jev-runs-v1", []);
    return Array.isArray(value)
      ? value
          .filter((r) => r?.id && r?.draft && Array.isArray(r.draft.criteria))
          .slice(0, 40)
      : [];
  });
  const [tab, setTab] = useState("playground");
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");
  const [caseResults, setCaseResults] = useState({});
  const [showRequest, setShowRequest] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportCopyStatus, setExportCopyStatus] = useState("");
  const [saved, setSaved] = useState(true);
  const controller = useRef(null);
  const active = busy || batchBusy;
  const canRun = !!config?.keyConfigured && !active;

  useEffect(() => {
    fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error("Could not connect to the local server.");
        return r.json();
      })
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("jev-draft-v1", JSON.stringify(draft));
      localStorage.setItem("jev-runs-v1", JSON.stringify(runs));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [draft, runs]);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const interval = setInterval(
      () => setElapsed(performance.now() - start),
      100,
    );
    return () => clearInterval(interval);
  }, [active]);
  useEffect(() => {
    const listener = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (canRun && tab === "playground") runSingle();
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!showRequest && !exportData) return;
    const close = (event) => {
      if (event.key === "Escape") {
        setShowRequest(false);
        setExportData(null);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [showRequest, exportData]);

  const edit = (changes) => {
    setDraft((current) => updateDraft(current, changes));
    setResult(null);
    setNotice("");
    setCaseResults({});
  };
  const addRun = (run) => setRuns((current) => [run, ...current].slice(0, 40));
  const selectPreset = (preset) => {
    setDraft(clone(preset));
    setResult(null);
    setNotice("");
    setCaseResults({});
    setTab("playground");
  };
  const setType = (type) => {
    if (type === draft.type) return;
    const preset = PRESETS.find((p) => p.type === type);
    edit({
      type,
      criteria: clone(preset.criteria),
      cases: draft.cases.map((c) => ({ ...c, expected: "" })),
    });
  };
  const request = async (snapshot, input, signal) => {
    const body = buildRequest(snapshot, input);
    const response = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The local server returned an unreadable response. Check that it is still running.",
      );
    }
    if (!response.ok)
      throw new Error(data.error?.message || "The request failed. Try again.");
    return {
      id: newId(),
      createdAt: new Date().toISOString(),
      draft: { ...clone(snapshot), input },
      request: body,
      ...data,
    };
  };
  async function runSingle() {
    if (!canRun) return;
    const snapshot = clone(draft);
    try {
      buildRequest(snapshot);
    } catch (e) {
      setNotice(e.message);
      return;
    }
    setNotice("");
    setBusy(true);
    setElapsed(0);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const run = await request(snapshot, snapshot.input, abort.signal);
      setResult(run);
      addRun(run);
    } catch (e) {
      if (abort.signal.aborted) setNotice("Run stopped.");
      else {
        const run = {
          id: newId(),
          createdAt: new Date().toISOString(),
          draft: snapshot,
          error: e.message,
        };
        setResult(run);
        addRun(run);
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  async function runSuite() {
    if (!canRun || !draft.cases.length) return;
    const snapshot = clone(draft);
    try {
      snapshot.cases.forEach((c) => {
        buildRequest(snapshot, c.input);
        if (
          snapshot.type !== "score" &&
          c.expected.trim() &&
          !snapshot.criteria.some(
            (criterion) => criterion.label.trim() === c.expected.trim(),
          )
        )
          throw new Error(
            "A test case has an expected answer that is no longer in your possible answers. Update it first.",
          );
        if (
          snapshot.type === "score" &&
          c.expected.trim() &&
          (!Number.isFinite(Number(c.expected)) ||
            Number(c.expected) < 0 ||
            Number(c.expected) > snapshot.criteria.length - 1)
        )
          throw new Error(
            `Expected scores must be between 0 and ${snapshot.criteria.length - 1}.`,
          );
      });
    } catch (e) {
      setNotice(e.message);
      return;
    }
    setNotice("");
    setCaseResults({});
    setBatchBusy(true);
    setElapsed(0);
    const abort = new AbortController();
    controller.current = abort;
    for (const testCase of snapshot.cases) {
      if (abort.signal.aborted) break;
      setCaseResults((previous) => ({
        ...previous,
        [testCase.id]: { pending: true },
      }));
      try {
        const run = await request(snapshot, testCase.input, abort.signal);
        run.expected = testCase.expected;
        run.passed = checkExpected(
          getAnswer(run.result),
          testCase.expected,
          snapshot.type,
        );
        run.caseId = testCase.id;
        addRun(run);
        setCaseResults((previous) => ({ ...previous, [testCase.id]: run }));
      } catch (e) {
        if (abort.signal.aborted) {
          setCaseResults((previous) => ({
            ...previous,
            [testCase.id]: { error: "Stopped" },
          }));
          break;
        }
        const failed = {
          id: newId(),
          createdAt: new Date().toISOString(),
          draft: { ...snapshot, input: testCase.input },
          error: e.message,
          caseId: testCase.id,
          expected: testCase.expected,
        };
        addRun(failed);
        setCaseResults((previous) => ({ ...previous, [testCase.id]: failed }));
      }
    }
    if (abort.signal.aborted)
      setNotice("Suite stopped. Completed results are saved.");
    controller.current = null;
    setBatchBusy(false);
  }
  const stop = () => controller.current?.abort();
  const exportAll = () => {
    setExportCopyStatus("");
    setExportData({
      exportedAt: new Date().toISOString(),
      model: config?.model,
      experiment: draft,
      runs,
    });
  };
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setExportCopyStatus("Copied to clipboard");
    } catch {
      setExportCopyStatus("Select the JSON below and copy it manually.");
    }
  };
  const completedCases = Object.values(caseResults).filter((r) => !r.pending);
  const graded = completedCases.filter((r) => typeof r.passed === "boolean");
  const passed = graded.filter((r) => r.passed).length;
  let preview;
  try {
    preview = {
      model: config?.model || "~typesafe/jev-latest",
      ...buildRequest(draft),
    };
  } catch (e) {
    preview = { validation: e.message };
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("playground");
          }}
        >
          <Logo />
          <span>
            jev<span className="brand-lab">lab</span>
          </span>
          <span className="local-tag">LOCAL</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {[
            { id: "playground", label: "Playground", icon: FlaskConical },
            { id: "suite", label: "Test suite", icon: CheckCheck },
            { id: "history", label: "Run history", icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => {
                setTab(id);
                setNotice("");
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "history" && runs.length > 0 && (
                <span className="nav-count">{runs.length}</span>
              )}
              {tab === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-rule" />
        <div className="workspace-label">START WITH AN EXAMPLE</div>
        <div className="preset-list">
          {PRESETS.map((preset, i) => {
            const Icon = TYPES.find((t) => t.value === preset.type).icon;
            return (
              <button
                disabled={active}
                className={`preset-item ${draft.id === preset.id ? "selected" : ""}`}
                onClick={() => selectPreset(preset)}
                key={preset.id}
              >
                <span className={`preset-icon preset-${i}`}>
                  <Icon size={15} />
                </span>
                <span>
                  <strong>{preset.name}</strong>
                  <small>
                    {TYPES.find((t) => t.value === preset.type).label} decision
                  </small>
                </span>
                <ChevronRight size={13} />
              </button>
            );
          })}
        </div>
        <button
          className="blank-button"
          disabled={active}
          onClick={() =>
            selectPreset({
              id: "custom",
              name: "Custom experiment",
              type: "choice",
              instructions: "",
              input: "",
              inputMode: "text",
              criteria: [
                { label: "yes", description: "" },
                { label: "no", description: "" },
              ],
              cases: [],
            })
          }
        >
          <Plus size={14} />
          Blank experiment
        </button>
        <div className="sidebar-bottom">
          <div className="model-note">
            <div className="model-note-icon">
              <Zap size={17} />
            </div>
            <h3>Built for the decision.</h3>
            <p>
              Jev turns context into choices,
              <br />
              probabilities, and scores.
            </p>
            <a
              href="https://docs.typesafe.ai/concepts/system-one"
              target="_blank"
              rel="noreferrer"
            >
              Meet the model <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="local-footer">
            <span className="local-icon">
              <ShieldCheck size={16} />
            </span>
            <span>
              Local workspace
              <small>
                {saved
                  ? "Experiments saved in this browser"
                  : "Browser storage unavailable"}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {tab === "playground"
                ? "Playground"
                : tab === "suite"
                  ? "Test suite"
                  : "Run history"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`connection ${config?.keyConfigured ? "connected" : ""}`}
            >
              <i />
              {configError
                ? "Server unavailable"
                : !config
                  ? "Connecting"
                  : config.keyConfigured
                    ? "Key loaded"
                    : "API key missing"}
            </span>
            <span className="topbar-divider" />
            <a
              href="https://openrouter.ai/~typesafe/jev-latest"
              target="_blank"
              rel="noreferrer"
            >
              OpenRouter <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                THE JEV WORKBENCH
              </div>
              <h1>
                {tab === "playground"
                  ? "Put Jev to the test."
                  : tab === "suite"
                    ? "One question. Many test cases."
                    : "Every experiment, in one place."}
              </h1>
              <p>
                {tab === "playground"
                  ? "Define a decision, give it context, and see what comes back."
                  : tab === "suite"
                    ? "Check your decision against a small, repeatable set of labeled inputs."
                    : "Revisit decisions and export the details for a closer look."}
              </p>
            </div>
            <button
              className="button secondary export-button"
              onClick={exportAll}
            >
              <ArrowDownToLine size={15} />
              Export JSON
            </button>
          </div>
          <div className="model-strip">
            <div className="model-symbol">
              <Zap size={17} />
            </div>
            <div>
              <strong>Jev Latest</strong>
              <span>by TypeSafe</span>
            </div>
            <span className="latest-badge">ALWAYS LATEST</span>
            <div className="model-strip-spacer" />
            <span className="model-id">~typesafe/jev-latest</span>
            <span className="model-strip-divider" />
            <span className="model-trait">
              <GitBranch size={14} />
              Structured decisions
            </span>
          </div>
          {(notice || configError || (config && !config.keyConfigured)) && (
            <div className="notice" role="alert">
              <CircleHelp size={17} />
              <span>
                {notice ||
                  configError ||
                  "Add OPENROUTER_API_KEY to .env and restart the server to run experiments."}
              </span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X size={14} />
              </button>
            </div>
          )}
          {tab === "playground" && (
            <div className="playground-grid">
              <div className="editor-column">
                <section className="panel">
                  <div className="panel-heading">
                    <div className="heading-label">
                      <span className="step">01</span>
                      <h2>Define the decision</h2>
                    </div>
                    <span className="subtle-label">{draft.name}</span>
                  </div>
                  <div className="panel-body">
                    <label className="field-label">Decision type</label>
                    <div className="type-picker">
                      {TYPES.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          disabled={active}
                          className={draft.type === value ? "active" : ""}
                          onClick={() => setType(value)}
                        >
                          <Icon size={15} />
                          {label}
                          {draft.type === value && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                    <label className="field-label" htmlFor="question">
                      The question <span>What should Jev decide?</span>
                    </label>
                    <textarea
                      id="question"
                      className="question-input"
                      disabled={active}
                      value={draft.instructions}
                      onChange={(e) => edit({ instructions: e.target.value })}
                      placeholder="Which team should handle this customer message?"
                      rows={2}
                    />
                    <div className="field-label criteria-label">
                      <span>
                        {draft.type === "score"
                          ? "Score levels"
                          : "Possible answers"}
                        <span className="count-badge">
                          {draft.criteria.length}
                        </span>
                      </span>
                      <span>
                        {draft.type === "score"
                          ? "Ordered from low to high"
                          : draft.type === "noul"
                            ? "Returns P(true)"
                            : "Label + description"}
                      </span>
                    </div>
                    <div className="criteria-list">
                      {draft.criteria.map((criterion, i) => (
                        <div className="criterion" key={i}>
                          <span className="criterion-dot">
                            {draft.type === "score" ? i : <span />}
                          </span>
                          <input
                            aria-label={`Answer ${i + 1} label`}
                            disabled={active || draft.type === "noul"}
                            className="criterion-name"
                            value={criterion.label}
                            onChange={(e) =>
                              edit({
                                criteria: draft.criteria.map((c, index) =>
                                  index === i
                                    ? { ...c, label: e.target.value }
                                    : c,
                                ),
                              })
                            }
                            placeholder="label"
                          />
                          <input
                            aria-label={`Answer ${i + 1} description`}
                            disabled={active}
                            className="criterion-description"
                            title={criterion.description}
                            value={criterion.description}
                            onChange={(e) =>
                              edit({
                                criteria: draft.criteria.map((c, index) =>
                                  index === i
                                    ? { ...c, description: e.target.value }
                                    : c,
                                ),
                              })
                            }
                            placeholder="Describe when this answer applies"
                          />
                          {draft.type !== "noul" && (
                            <button
                              className="icon-button remove-answer"
                              disabled={active || draft.criteria.length <= 2}
                              aria-label={`Remove answer ${i + 1}`}
                              onClick={() =>
                                edit({
                                  criteria: draft.criteria.filter(
                                    (_, index) => index !== i,
                                  ),
                                })
                              }
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {draft.type !== "noul" && (
                      <button
                        className="text-button add-answer"
                        disabled={
                          active ||
                          draft.criteria.length >=
                            (draft.type === "score" ? 10 : 20)
                        }
                        onClick={() =>
                          edit({
                            criteria: [
                              ...draft.criteria,
                              { label: "", description: "" },
                            ],
                          })
                        }
                      >
                        <Plus size={13} />
                        {draft.type === "score"
                          ? "Add score level"
                          : "Add possible answer"}
                      </button>
                    )}
                  </div>
                </section>
                <section className="panel input-panel">
                  <div className="panel-heading">
                    <div className="heading-label">
                      <span className="step">02</span>
                      <h2>Give it context</h2>
                    </div>
                    <div className="small-segment">
                      <button
                        disabled={active}
                        className={draft.inputMode === "text" ? "active" : ""}
                        onClick={() => edit({ inputMode: "text" })}
                      >
                        Text
                      </button>
                      <button
                        disabled={active}
                        className={draft.inputMode === "json" ? "active" : ""}
                        onClick={() => edit({ inputMode: "json" })}
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                  <textarea
                    aria-label="Input to evaluate"
                    className={`context-input ${draft.inputMode === "json" ? "mono" : ""}`}
                    disabled={active}
                    value={draft.input}
                    onChange={(e) => edit({ input: e.target.value })}
                    placeholder={
                      draft.inputMode === "json"
                        ? '{ "message": "Your input goes here" }'
                        : "Paste a message, a document, or any text you want Jev to evaluate…"
                    }
                    rows={5}
                  />
                  <div className="context-footer">
                    <span>
                      {draft.input.length.toLocaleString()} characters
                    </span>
                    <span>
                      {draft.inputMode === "json"
                        ? "Structured state"
                        : "Text is sent as { text: … }"}
                    </span>
                  </div>
                </section>
                <div className="run-toolbar">
                  <button
                    className="text-button request-button"
                    onClick={() => setShowRequest(true)}
                  >
                    <Code2 size={15} />
                    View request
                  </button>
                  <button
                    className={`button primary ${busy ? "running-button" : ""}`}
                    onClick={busy ? stop : runSingle}
                    disabled={!busy && !canRun}
                  >
                    {busy ? (
                      <>
                        <Square size={14} />
                        Stop run
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        Run decision<span className="shortcut">⌃ ↵</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="send-note">
                  <ShieldCheck size={12} />
                  Your key stays on the server. Inputs are sent to OpenRouter.
                </p>
              </div>
              <div className="result-column">
                <Result
                  run={result}
                  busy={busy}
                  elapsed={elapsed}
                  onRun={runSingle}
                  canRun={canRun}
                />
                <div className="experiment-hint">
                  <FlaskConical size={18} />
                  <div>
                    <strong>Try the edge cases.</strong>
                    <p>
                      Change a few words. Mix signals. Remove context.
                      <br />
                      Find out where your decision gets uncertain.
                    </p>
                    <button onClick={() => setTab("suite")}>
                      Explore the test suite <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "suite" && (
            <section className="panel suite-panel">
              <div className="panel-heading">
                <div className="heading-label">
                  <CheckCheck size={18} />
                  <h2>{draft.name}</h2>
                  <span className="count-badge">
                    {draft.cases.length} cases
                  </span>
                </div>
                <button
                  className="button primary"
                  onClick={batchBusy ? stop : runSuite}
                  disabled={!batchBusy && (!canRun || !draft.cases.length)}
                >
                  {batchBusy ? (
                    <>
                      <Square size={14} />
                      Stop suite
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" />
                      Run {draft.cases.length} cases
                    </>
                  )}
                </button>
              </div>
              <div className="suite-summary">
                <div>
                  <span className="eyebrow">CURRENT QUESTION</span>
                  <p>
                    {draft.instructions ||
                      "Set your question in the playground first."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setTab("playground")}
                  >
                    <ArrowLeft size={13} />
                    Edit decision
                  </button>
                </div>
                <div className="suite-stat">
                  <strong>
                    {graded.length ? `${passed}/${graded.length}` : "—"}
                  </strong>
                  <span>labeled cases passed</span>
                </div>
                <div className="suite-stat">
                  <strong>
                    {completedCases.length}/{draft.cases.length}
                  </strong>
                  <span>cases completed</span>
                </div>
              </div>
              <div className="suite-table">
                <div className="case-table-header">
                  <span>TEST INPUT</span>
                  <span>EXPECTED</span>
                  <span>RESULT</span>
                  <span />
                </div>
                {draft.cases.map((c, i) => {
                  const outcome = caseResults[c.id];
                  return (
                    <div className="case-row" key={c.id}>
                      <div className="case-input">
                        <span className="mono case-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <textarea
                          aria-label={`Case ${i + 1} input`}
                          disabled={active}
                          value={c.input}
                          rows={3}
                          onChange={(e) =>
                            edit({
                              cases: draft.cases.map((item) =>
                                item.id === c.id
                                  ? { ...item, input: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </div>
                      <div>
                        {draft.type === "score" ? (
                          <input
                            aria-label={`Case ${i + 1} expected`}
                            type="number"
                            min="0"
                            max={draft.criteria.length - 1}
                            step="0.1"
                            placeholder="Ungraded"
                            disabled={active}
                            value={c.expected}
                            onChange={(e) =>
                              edit({
                                cases: draft.cases.map((item) =>
                                  item.id === c.id
                                    ? { ...item, expected: e.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                        ) : (
                          <select
                            aria-label={`Case ${i + 1} expected`}
                            disabled={active}
                            value={c.expected}
                            onChange={(e) =>
                              edit({
                                cases: draft.cases.map((item) =>
                                  item.id === c.id
                                    ? { ...item, expected: e.target.value }
                                    : item,
                                ),
                              })
                            }
                          >
                            <option value="">Ungraded</option>
                            {draft.criteria.map((criterion, index) => (
                              <option key={index} value={criterion.label}>
                                {criterion.label || "(unnamed)"}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="case-outcome">
                        {outcome?.pending ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : outcome?.error ? (
                          <span className="failed-text" title={outcome.error}>
                            Error<small>{outcome.error}</small>
                          </span>
                        ) : outcome?.result ? (
                          <button
                            className={`outcome-pill ${outcome.passed === true ? "passed" : outcome.passed === false ? "failed" : ""}`}
                            disabled={active}
                            onClick={() => {
                              setDraft(clone(outcome.draft));
                              setResult(outcome);
                              setTab("playground");
                            }}
                          >
                            {outcome.passed === true ? (
                              <Check size={13} />
                            ) : outcome.passed === false ? (
                              <X size={13} />
                            ) : null}
                            {answerLabel(getAnswer(outcome.result))}
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <span className="muted">Not run</span>
                        )}
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Remove case ${i + 1}`}
                        disabled={active}
                        onClick={() =>
                          edit({
                            cases: draft.cases.filter(
                              (item) => item.id !== c.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="suite-bottom">
                <button
                  className="text-button"
                  disabled={active || draft.cases.length >= 25}
                  onClick={() =>
                    edit({
                      cases: [
                        ...draft.cases,
                        { id: newId(), input: "", expected: "" },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  Add test case
                </button>
                <span>
                  {draft.type === "score"
                    ? "A score passes within ±0.5 of the expected value."
                    : draft.type === "noul"
                      ? "Boolean results use a 50% probability threshold."
                      : "A case passes when the returned label matches exactly."}
                </span>
              </div>
              <div className="suite-disclaimer">
                Cases run sequentially using the current decision and input
                format. Sample labels are editable examples, not a benchmark.
                Each case makes one API request.
              </div>
            </section>
          )}
          {tab === "history" && (
            <section className="panel history-panel">
              <div className="panel-heading">
                <div className="heading-label">
                  <History size={18} />
                  <h2>Recent runs</h2>
                  <span className="count-badge">{runs.length}</span>
                </div>
                <span className="subtle-label">
                  Last 40 runs · stored in this browser
                </span>
              </div>
              {!runs.length ? (
                <div className="history-empty">
                  <History size={32} />
                  <h3>Your first experiment starts here.</h3>
                  <p>
                    Run a decision and its result will appear in your history.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setTab("playground")}
                  >
                    Go to playground
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="history-list">
                  {runs.map((run) => (
                    <button
                      className="history-item"
                      key={run.id}
                      disabled={active}
                      onClick={() => {
                        setDraft(clone(run.draft));
                        setResult(run);
                        setCaseResults({});
                        setTab("playground");
                      }}
                    >
                      <span
                        className={`history-run-icon ${run.error ? "failed" : ""}`}
                      >
                        {run.error ? <X size={16} /> : <GitBranch size={16} />}
                      </span>
                      <span className="history-run-description">
                        <strong>
                          {run.draft.instructions || run.draft.name}
                        </strong>
                        <small>{run.draft.input}</small>
                      </span>
                      <span
                        className={`history-answer ${run.error ? "failed-text" : ""}`}
                      >
                        {run.error
                          ? "Failed"
                          : answerLabel(getAnswer(run.result))}
                      </span>
                      <span className="history-time">
                        <strong>
                          {run.elapsedMs != null
                            ? `${Math.round(run.elapsedMs)} ms`
                            : "—"}
                        </strong>
                        <small>
                          {new Date(run.createdAt).toLocaleDateString()} ·{" "}
                          {dateLabel(run.createdAt)}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>Made for a little more certainty.</span>
            <span>
              Jev Lab <span> / </span> OpenRouter Decisions API
            </span>
          </footer>
        </main>
      </div>
      {showRequest && (
        <div className="modal-overlay" onClick={() => setShowRequest(false)}>
          <section
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <h2>Request preview</h2>
              <button
                className="icon-button"
                onClick={() => setShowRequest(false)}
                aria-label="Close request preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="request-url">
              <span>POST</span> https://openrouter.ai/api/alpha/decisions
            </div>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
            <div className="modal-footer">
              <ShieldCheck size={14} />
              Authorization is added by your local server.
            </div>
          </section>
        </div>
      )}
      {exportData && (
        <div className="modal-overlay" onClick={() => setExportData(null)}>
          <section
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Export experiment"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <h2>Export experiment</h2>
              <button
                autoFocus
                className="icon-button"
                onClick={() => setExportData(null)}
                aria-label="Close export"
              >
                <X size={18} />
              </button>
            </div>
            <div className="export-actions">
              <span>Current setup + {exportData.runs.length} saved runs</span>
              <button className="button secondary" onClick={copyExport}>
                <Copy size={14} />
                Copy JSON
              </button>
              <button
                className="button primary"
                onClick={() => downloadJson(exportData, "jev-lab-results.json")}
              >
                <ArrowDownToLine size={14} />
                Download
              </button>
            </div>
            <textarea
              className="export-json"
              aria-label="Export JSON contents"
              readOnly
              value={JSON.stringify(exportData, null, 2)}
            />
            <div className="modal-footer" role="status">
              {exportCopyStatus ||
                "Use Copy JSON if your browser does not support file downloads."}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
