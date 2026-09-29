import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  Database,
  Clock3,
} from "lucide-react";
import { WORKFLOWS, makePayload, scoreAnswers, summarizeRuns } from "./hcm.js";
import { MAX_RECORDING_BYTES, parseRecording } from "./recordings.js";
export { validateImportedSession } from "./recordings.js";

const STORAGE_KEY = "jev-hcm-presentation-runs-v1";
const DATASETS = [
  { id: "mixed", label: "Both HCM workflows" },
  { id: "triage", label: "Payroll case routing" },
  { id: "completeness", label: "Working-hours requests" },
];

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const percentage = (value) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
const latency = (value) =>
  Number.isFinite(value)
    ? value < 1000
      ? `${Math.round(value)} ms`
      : `${(value / 1000).toFixed(2)} s`
    : "—";
const money = (value) =>
  Number.isFinite(value)
    ? value > 0 && value < 0.000001
      ? "<$0.000001"
      : `$${value.toLocaleString("en-US", { minimumFractionDigits: value === 0 || value >= 1 ? 2 : 6, maximumFractionDigits: value >= 1 ? 4 : 6 })}`
    : "—";
const pretty = (value) => JSON.stringify(value, null, 2);
const label = (value) => String(value ?? "No answer").replaceAll("_", " ");
function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (item) =>
              item &&
              Array.isArray(item.records) &&
              Array.isArray(item.modelIds) &&
              ["complete", "stopped", "running"].includes(item.status),
          )
          .slice(0, 3)
          .map((item) =>
            item.status === "running"
              ? {
                  ...item,
                  status: "stopped",
                  recoveredAt: new Date().toISOString(),
                  interruptionNote:
                    "An unfinished run was recovered from this browser. Completed responses are preserved; unrecorded requests may have incurred additional provider usage.",
                }
              : item,
          )
      : [];
  } catch {
    return [];
  }
}

function allCases(dataset) {
  const ids = dataset === "mixed" ? ["triage", "completeness"] : [dataset];
  return ids.flatMap((workflowId) =>
    (WORKFLOWS[workflowId]?.cases || []).map((item) => ({ workflowId, item })),
  );
}

function selectedCases(dataset, size) {
  const cases = allCases(dataset);
  if (size === "all") return cases;
  if (dataset !== "mixed") return cases.slice(0, 6);
  const triage = cases
    .filter((item) => item.workflowId === "triage")
    .slice(0, 3);
  const completeness = cases
    .filter((item) => item.workflowId === "completeness")
    .slice(0, 3);
  return triage.flatMap((item, index) =>
    [item, completeness[index]].filter(Boolean),
  );
}

function modelSummaries(session) {
  return (session?.modelIds || []).map((modelId) => {
    const records = session.records.filter(
      (record) => record.modelId === modelId,
    );
    return {
      id: modelId,
      label: records[0]?.modelLabel || modelId,
      records,
      stats: summarizeRuns(records),
    };
  });
}

function Metric({ title, children, note }) {
  return (
    <div className="metric">
      <span className="metric-label">{title}</span>
      <strong className="metric-value">{children}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function RecordDetail({ record }) {
  return (
    <div className="run-detail">
      <div className="detail-columns">
        <div>
          <span className="eyebrow">Answer check</span>
          <table className="results-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Expected</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {(record.grade?.details || []).map((detail) => (
                <tr key={detail.key}>
                  <td>{label(detail.key)}</td>
                  <td>{label(detail.expected)}</td>
                  <td
                    className={detail.correct ? "text-success" : "text-danger"}
                  >
                    {label(detail.actual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <span className="eyebrow">Request provenance</span>
          <dl className="provenance-list">
            <dt>Requested model</dt>
            <dd>{record.modelId}</dd>
            <dt>Resolved model</dt>
            <dd>{record.response?.model || "Not reported"}</dd>
            <dt>Provider</dt>
            <dd>{record.response?.provider || "Not reported"}</dd>
            <dt>Attempt</dt>
            <dd>{record.repetition || 1}</dd>
          </dl>
          {record.error && (
            <p className="notice notice-error">{record.error}</p>
          )}
        </div>
      </div>
      <details>
        <summary>Exact request sent to provider</summary>
        <pre>
          {record.response?.request
            ? pretty(record.response.request)
            : "The server did not return an upstream request for this attempt."}
        </pre>
      </details>
      <details>
        <summary>Raw response and usage</summary>
        <pre>
          {pretty(
            record.response || { error: record.error, usage: record.usage },
          )}
        </pre>
      </details>
    </div>
  );
}

export default function Benchmark({
  models = [],
  onSessionChange,
  enabled = true,
  externallyBusy = false,
}) {
  const [dataset, setDataset] = useState("mixed");
  const [size, setSize] = useState("sample");
  const [repetitions, setRepetitions] = useState(1);
  const [saved, setSaved] = useState(readSaved);
  const [session, setSession] = useState(() =>
    saved[0]?.recoveredAt ? saved[0] : null,
  );
  const [recorded, setRecorded] = useState(() =>
    Boolean(saved[0]?.recoveredAt),
  );
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeModels, setActiveModels] = useState([]);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [showAll, setShowAll] = useState(false);
  const stopRef = useRef(false);
  const controllers = useRef(new Set());
  const mounted = useRef(true);
  const callback = useRef(onSessionChange);
  const historyRef = useRef(saved);
  const initialRecovery = useRef(session?.recoveredAt ? session : null);
  callback.current = onSessionChange;

  useEffect(() => {
    mounted.current = true;
    if (initialRecovery.current) {
      saveSession(initialRecovery.current);
      callback.current?.(initialRecovery.current);
      initialRecovery.current = null;
    }
    return () => {
      mounted.current = false;
      stopRef.current = true;
      for (const controller of controllers.current) controller.abort();
    };
  }, []);

  const cases = useMemo(() => selectedCases(dataset, size), [dataset, size]);
  const laneModels = models.filter((model) => model?.id).slice(0, 3);
  const summaries = useMemo(() => modelSummaries(session), [session]);
  const planned = cases.length * repetitions * laneModels.length;

  function publish(next, checkpoint = false) {
    if (!mounted.current) return;
    setSession(next);
    callback.current?.(next);
    if (checkpoint) saveSession(next);
  }

  function saveSession(next) {
    const history = [
      next,
      ...historyRef.current.filter((item) => item.id !== next.id),
    ].slice(0, 3);
    historyRef.current = history;
    if (mounted.current) setSaved(history);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      if (mounted.current)
        setMessage(
          "This browser could not save the latest checkpoint. Earlier saved data was retained. Export JSON to preserve the current run.",
        );
    }
  }

  async function run() {
    if (busy || importing || !planned || !enabled || externallyBusy) return;
    setBusy(true);
    setRecorded(false);
    setExpandedRecord(null);
    setMessage("");
    stopRef.current = false;
    const startedAt = new Date().toISOString();
    const base = {
      id: uid(),
      createdAt: startedAt,
      status: "running",
      dataset,
      size,
      repetitions,
      modelIds: laneModels.map((model) => model.id),
      models: laneModels,
      totalPlanned: planned,
      labelStatus: "author_expected_not_human_reviewed",
      methodology:
        "Identical state and question definitions; one request containing every question; one in-flight request per model; models run concurrently for each case. No retries. Noul decisions use a fixed 0.5 threshold. Errors receive zero credit; cancelled attempts are excluded. p50/p95 use successful responses only. Labels are synthetic author expectations, not human-reviewed ground truth.",
    };
    let records = [];
    publish({ ...base, records: [] }, true);
    try {
      for (
        let repetition = 1;
        repetition <= repetitions && !stopRef.current;
        repetition++
      ) {
        for (
          let caseIndex = 0;
          caseIndex < cases.length && !stopRef.current;
          caseIndex++
        ) {
          const { workflowId, item } = cases[caseIndex];
          const offset = (caseIndex + repetition - 1) % laneModels.length;
          const orderedModels = [
            ...laneModels.slice(offset),
            ...laneModels.slice(0, offset),
          ];
          if (mounted.current)
            setActiveModels(orderedModels.map((model) => model.id));
          await Promise.all(
            orderedModels.map(async (model) => {
              const controller = new AbortController();
              controllers.current.add(controller);
              const start = performance.now();
              const payload = makePayload(workflowId, item);
              let response = null;
              let status = "success";
              let error = null;
              try {
                const result = await fetch("/api/evaluate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ model: model.id, ...payload }),
                  signal: controller.signal,
                });
                response = await result.json();
                if (!result.ok || response.error) {
                  status = "error";
                  error =
                    typeof response.error === "string"
                      ? response.error
                      : response.error?.message ||
                        `Request failed (${result.status}).`;
                }
              } catch (caught) {
                status = controller.signal.aborted ? "cancelled" : "error";
                error =
                  status === "cancelled"
                    ? "Stopped by presenter. Usage may not be available for an interrupted request."
                    : caught.message || "The request could not be completed.";
              } finally {
                controllers.current.delete(controller);
              }
              const record = {
                id: uid(),
                workflowId,
                caseId: item.id,
                caseLabel: item.label,
                repetition,
                expected: item.expected,
                modelId: model.id,
                modelLabel: model.label,
                status,
                grade: scoreAnswers(
                  payload.questions,
                  item.expected,
                  status === "success" ? response?.answers || {} : {},
                ),
                elapsedMs: Number.isFinite(response?.elapsedMs)
                  ? response.elapsedMs
                  : performance.now() - start,
                usage: response?.usage || { cost: null },
                response,
                error,
              };
              records = [...records, record];
              publish({ ...base, records }, true);
              if (mounted.current)
                setActiveModels((current) =>
                  current.filter((id) => id !== model.id),
                );
            }),
          );
        }
      }
    } finally {
      const finalSession = {
        ...base,
        records,
        status: stopRef.current ? "stopped" : "complete",
        finishedAt: new Date().toISOString(),
      };
      publish(finalSession, true);
      if (mounted.current) {
        setBusy(false);
        setActiveModels([]);
      }
    }
  }

  function stop() {
    stopRef.current = true;
    for (const controller of controllers.current) controller.abort();
  }

  function loadRecorded(id) {
    const item = saved.find((item) => item.id === id);
    if (!item) return;
    setRecorded(true);
    setExpandedRecord(null);
    setMessage("");
    publish(item);
  }

  async function importRecording(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || busy || importing) return;
    setImporting(true);
    setMessage("");
    try {
      if (file.size > MAX_RECORDING_BYTES)
        throw new Error("Choose a recording smaller than 5 MB.");
      const imported = parseRecording(await file.text(), models);
      setRecorded(true);
      setExpandedRecord(null);
      setMessage(
        "Recording imported. Grades were recalculated against the current authored answer key. The file’s provenance and measurements cannot be authenticated.",
      );
      publish(imported, true);
    } catch (error) {
      setMessage(
        error instanceof SyntaxError
          ? "The selected file is not valid JSON."
          : error.message || "The recording could not be imported.",
      );
    } finally {
      input.value = "";
      setImporting(false);
    }
  }

  function download() {
    if (!session) return;
    const url = URL.createObjectURL(
      new Blob([pretty(session)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jev-hcm-${session.createdAt.slice(0, 10)}-${session.id.slice(0, 8)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Export requested. If your browser blocks downloads, use Copy JSON.",
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty(session));
      setMessage("Run JSON copied to clipboard.");
    } catch {
      setMessage(
        "Clipboard access is unavailable. Open the full JSON below to select and copy it.",
      );
    }
  }

  const completed =
    session?.records.filter((record) => record.status !== "cancelled").length ||
    0;
  const visibleRecords = showAll
    ? session?.records || []
    : (session?.records || []).slice(-12);

  return (
    <div className="benchmark">
      <div className="notice">
        <AlertCircle size={17} />
        <span>
          These are synthetic examples with{" "}
          <strong>author-defined expected answers</strong>. Agreement is a
          useful demo measure; it is not a validated HCM accuracy benchmark.
        </span>
      </div>
      {!enabled && (
        <p className="notice" role="status">
          Add your OpenRouter key to the server’s .env file and restart the app
          to run the comparison.
        </p>
      )}
      {enabled && externallyBusy && (
        <p className="notice" role="status">
          A live HCM example is running. Start the comparison after it finishes
          so the measurements do not overlap.
        </p>
      )}
      <div className="panel benchmark-controls">
        <label className="field">
          <span>Workflow</span>
          <select
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
            disabled={busy}
          >
            {DATASETS.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cases</span>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
            disabled={busy}
          >
            <option value="sample">Quick sample · 6 cases</option>
            <option value="all">
              Full set · {allCases(dataset).length} cases
            </option>
          </select>
        </label>
        <label className="field">
          <span>Repeats per case</span>
          <select
            value={repetitions}
            onChange={(event) => setRepetitions(Number(event.target.value))}
            disabled={busy}
          >
            <option value={1}>1 run</option>
            <option value={3}>3 runs</option>
          </select>
        </label>
        <div className="benchmark-actions">
          {busy ? (
            <button className="button button-secondary" onClick={stop}>
              <Square size={15} /> Stop run
            </button>
          ) : (
            <button
              className="button button-primary"
              onClick={run}
              disabled={!planned || !enabled || externallyBusy || importing}
            >
              <Play size={16} /> Run {planned} requests
            </button>
          )}
          <small className="muted">Uses your OpenRouter credits.</small>
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="benchmark-toolbar">
        <div className="benchmark-status" role="status">
          <span className={`pill ${busy ? "pill-active" : ""}`}>
            {busy
              ? "Live · running"
              : session?.imported
                ? `Imported recording · ${session.status}`
                : recorded
                  ? `Recorded run · ${session.status}`
                  : session
                    ? `Live run · ${session.status}`
                    : "Ready to measure"}
          </span>
          {session ? (
            <small className="muted">
              {new Date(session.createdAt).toLocaleString()} · {completed}/
              {session.totalPlanned} attempts completed
            </small>
          ) : (
            <span className="pill">
              <Database size={14} /> {allCases("mixed").length} authored cases ·{" "}
              {laneModels.length} models
            </span>
          )}
        </div>
        <label className="field saved-run-field">
          <span className="sr-only">Load a recorded run</span>
          <select
            aria-label="Load a recorded run"
            value={recorded ? session?.id || "" : ""}
            disabled={busy || importing || !saved.length}
            onChange={(event) => loadRecorded(event.target.value)}
          >
            <option value="">
              {saved.length ? "Load a recorded run…" : "No recorded runs yet"}
            </option>
            {saved.map((item) => (
              <option value={item.id} key={item.id}>
                {item.imported ? "Imported · " : ""}
                {new Date(item.createdAt).toLocaleString()} ·{" "}
                {item.records.length} attempts
              </option>
            ))}
          </select>
        </label>
        <label className="field import-run-field">
          <span>{importing ? "Importing…" : "Import recording"}</span>
          <input
            className="import-run-input"
            type="file"
            accept="application/json,.json"
            disabled={busy || importing || !models.length}
            onChange={importRecording}
          />
        </label>
      </div>
      {session?.imported && (
        <p className="notice">
          Imported recording: grades are recalculated from the current authored
          labels. File provenance, timings and reported costs cannot be
          authenticated.
        </p>
      )}
      {session?.interruptionNote && (
        <p className="notice" role="status">
          {session.interruptionNote} Interruption detected{" "}
          {new Date(session.recoveredAt).toLocaleString()}.
        </p>
      )}
      {session && (
        <div
          className="progress-track"
          aria-label="Benchmark progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={session.totalPlanned}
          aria-valuenow={session.records.length}
        >
          <div
            className="progress-fill"
            style={{
              width: `${session.totalPlanned ? (session.records.length / session.totalPlanned) * 100 : 0}%`,
            }}
          />
        </div>
      )}
      <div className="benchmark-lanes">
        {(session
          ? summaries
          : laneModels.map((model) => ({
              ...model,
              records: [],
              stats: summarizeRuns([]),
            }))
        ).map((model) => (
          <section
            className={`panel model-lane ${model.kind === "decision" || model.id.includes("jev") ? "model-lane-specialist" : ""}`}
            key={model.id}
          >
            <div className="lane-header">
              <div>
                <span className="eyebrow">
                  {model.id.includes("jev")
                    ? "Decision model"
                    : models.find((item) => item.id === model.id)?.tier ===
                        "economical"
                      ? "Economical LLM"
                      : "General-purpose LLM"}
                </span>
                <h3>{model.label}</h3>
              </div>
              {activeModels.includes(model.id) && (
                <span
                  className="loading-dot"
                  aria-label="Request in progress"
                />
              )}
            </div>
            <div className="metric-grid">
              <Metric
                title="Answer agreement"
                note={`${model.stats.correct || 0} / ${model.stats.total || 0} fields`}
              >
                {percentage(model.stats.accuracy)}
              </Metric>
              <Metric
                title="All fields correct"
                note={`${model.stats.caseCorrect || 0} complete cases`}
              >
                {percentage(model.stats.caseAccuracy)}
              </Metric>
              <Metric
                title="Median response"
                note={`p95 ${latency(model.stats.p95)}`}
              >
                {latency(model.stats.p50)}
              </Metric>
              <Metric
                title="Reported cost"
                note={
                  model.stats.missingCost
                    ? `${model.stats.missingCost} costs unavailable`
                    : "All measured requests"
                }
              >
                {model.stats.missingCost
                  ? `${money(model.stats.knownCost)}+`
                  : money(model.stats.cost)}
              </Metric>
            </div>
            <div className="lane-footer">
              <span>
                {model.stats.completed || 0} successful ·{" "}
                {model.stats.errors || 0} errors
              </span>
              <span>
                {model.stats.cancelled
                  ? `${model.stats.cancelled} cancelled`
                  : `${money(model.stats.costPer1000)} / 1k requests`}
              </span>
            </div>
          </section>
        ))}
      </div>
      <p className="benchmark-method muted">
        Every model receives the same context and question definitions in one
        request. LLMs return a strict JSON schema. Models run concurrently, one
        request at a time per model; dispatch order rotates. Latency includes
        the local server and provider round trip. Errors count as incorrect;
        cancelled attempts are excluded. Cost uses provider-reported usage.
      </p>
      {session?.records.length > 0 && (
        <section className="panel benchmark-records">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Inspect the evidence</span>
              <h3>Every attempt is visible.</h3>
            </div>
            <div className="inline-actions">
              <button
                className="button button-secondary button-small"
                onClick={download}
              >
                <Download size={14} /> Export JSON
              </button>
              <button
                className="button button-secondary button-small"
                onClick={copy}
              >
                <Copy size={14} /> Copy JSON
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Model</th>
                  <th>Result</th>
                  <th>Time</th>
                  <th>Cost</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <RecordRows
                    record={record}
                    expanded={expandedRecord === record.id}
                    onToggle={() =>
                      setExpandedRecord(
                        expandedRecord === record.id ? null : record.id,
                      )
                    }
                    key={record.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {session.records.length > 12 && (
            <button
              className="button button-text"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Show latest 12 attempts"
                : `Show all ${session.records.length} attempts`}
            </button>
          )}
          <details className="export-json">
            <summary>Full run JSON / manual copy</summary>
            <pre tabIndex={0}>{pretty(session)}</pre>
          </details>
        </section>
      )}
      <details className="panel dataset-review">
        <summary>
          Review the authored cases and answer key{" "}
          <span className="muted">· {cases.length} selected cases</span>
        </summary>
        <p className="muted">
          Expected answers are held out of every model request. Review the
          fictional policies, supplied evidence and labels with an HCM
          specialist before presenting agreement as accuracy.
        </p>
        {[...new Set(cases.map((item) => item.workflowId))].map(
          (workflowId) => (
            <details className="policy-review" key={workflowId}>
              <summary>
                {WORKFLOWS[workflowId].title} · exact policy supplied to every
                model
              </summary>
              <pre>{WORKFLOWS[workflowId].policy}</pre>
            </details>
          ),
        )}
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Case and evidence</th>
                <th>Expected answers</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(({ workflowId, item }) => (
                <tr key={`${workflowId}-${item.id}`}>
                  <td>
                    <strong>{item.label}</strong>
                    <p>{item.message}</p>
                    <details>
                      <summary>Supporting facts</summary>
                      <pre>{pretty(item.facts)}</pre>
                    </details>
                  </td>
                  <td>
                    {Object.entries(item.expected).map(([key, value]) => (
                      <div key={key}>
                        {label(key)}: <strong>{label(value)}</strong>
                      </div>
                    ))}
                  </td>
                  <td>{item.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function RecordRows({ record, expanded, onToggle }) {
  return (
    <>
      <tr>
        <td>
          <strong>{record.caseLabel}</strong>
          <small className="muted">
            {record.workflowId === "triage"
              ? "Case routing"
              : "Request completeness"}{" "}
            · repeat {record.repetition || 1}
          </small>
        </td>
        <td>{record.modelLabel}</td>
        <td>
          <span
            className={`result-status ${record.status === "success" && record.grade?.caseCorrect ? "text-success" : record.status === "error" ? "text-danger" : ""}`}
          >
            {record.status === "success"
              ? `${record.grade.correct}/${record.grade.total} fields`
              : record.status}
          </span>
        </td>
        <td>{latency(record.elapsedMs)}</td>
        <td>{money(record.usage?.cost)}</td>
        <td>
          <button
            className="button button-icon"
            onClick={onToggle}
            aria-label={`${expanded ? "Hide" : "Inspect"} ${record.caseLabel}, ${record.modelLabel}`}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6}>
            <RecordDetail record={record} />
          </td>
        </tr>
      )}
    </>
  );
}

function ComparisonBars({ title, items, getValue, format, description }) {
  const values = items.map((item) => getValue(item.stats));
  const maximum = Math.max(0, ...values.filter(Number.isFinite));
  return (
    <section className="panel finding-card">
      <span className="eyebrow">{title}</span>
      <p className="muted">{description}</p>
      <div className="comparison-bars">
        {items.map((item, index) => (
          <div className="bar-row" key={item.id}>
            <div>
              <span>{item.label}</span>
              <strong>{format(values[index])}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${item.id.includes("jev") ? "bar-fill-specialist" : ""}`}
                style={{
                  width: `${Number.isFinite(values[index]) && maximum > 0 ? (values[index] / maximum) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Findings({ session, onNavigate }) {
  const summaries = useMemo(() => modelSummaries(session), [session]);
  const hasResults = Boolean(
    session?.records?.some((record) => record.status !== "cancelled"),
  );
  const fullyComplete =
    session?.status === "complete" &&
    session.records.length === session.totalPlanned &&
    summaries.every((item) =>
      item.records.every((record) => record.status !== "cancelled"),
    );
  return (
    <div className="findings">
      {!hasResults ? (
        <div className="panel findings-empty">
          <Clock3 size={28} />
          <h3>Your results will tell the story.</h3>
          <p className="muted">
            Run the comparison to see answer agreement, latency and cost here.
            This screen contains no illustrative benchmark numbers.
          </p>
          <button
            className="button button-primary"
            onClick={() => onNavigate?.(5)}
          >
            Run the comparison <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="notice">
            <AlertCircle size={17} />
            <span>
              {session.imported ? "Imported recording · " : ""}
              {fullyComplete ? "Completed run" : "Partial run"} from{" "}
              {new Date(session.createdAt).toLocaleString()}.{" "}
              {
                session.records.filter(
                  (record) => record.status !== "cancelled",
                ).length
              }{" "}
              {session.imported ? "recorded" : "measured"} attempts. Labels are
              author-defined and await HCM review; these results are specific to
              this synthetic set.{" "}
              {session.imported &&
                "Imported provenance, timings and costs cannot be authenticated."}
            </span>
          </div>
          <div className="finding-grid">
            <ComparisonBars
              title="Answer agreement"
              items={summaries}
              getValue={(stats) => stats.accuracy}
              format={percentage}
              description="Against the same authored answer key. Higher is better."
            />
            <ComparisonBars
              title="Median response time"
              items={summaries}
              getValue={(stats) => stats.p50}
              format={latency}
              description="Successful requests only. Lower is better."
            />
            <ComparisonBars
              title="Projected cost / 1,000"
              items={summaries}
              getValue={(stats) => stats.costPer1000}
              format={money}
              description="Same workload mix; no volume discounts assumed."
            />
          </div>
          <p className="muted benchmark-method">
            A low latency or cost does not compensate for incorrect routing.
            Compare per-case disagreements and errors before choosing a model.
            Cost projections are unavailable when costs are missing, and a
            partial run is not a final comparison.
          </p>
        </>
      )}
    </div>
  );
}
