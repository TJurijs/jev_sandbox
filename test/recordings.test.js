import test from "node:test";
import assert from "node:assert/strict";
import { WORKFLOWS, makePayload } from "../src/hcm.js";
import {
  MAX_RECORDING_BYTES,
  parseRecording,
  validateImportedSession,
} from "../src/recordings.js";

const MODELS = [
  { id: "fixture/decision", label: "Decision fixture", kind: "decision" },
  { id: "fixture/llm", label: "LLM fixture", kind: "llm" },
];

function fixture({ caseIndex = 0, modelId = MODELS[0].id } = {}) {
  const entry = WORKFLOWS.triage.cases[caseIndex];
  return {
    id: "synthetic-recording-fixture",
    createdAt: "2026-09-29T12:00:00Z",
    status: "complete",
    dataset: "triage",
    repetitions: 1,
    totalPlanned: 1,
    modelIds: [modelId],
    records: [
      {
        id: "synthetic-attempt-fixture",
        modelId,
        workflowId: "triage",
        caseId: entry.id,
        status: "success",
        elapsedMs: 123,
        usage: { input_tokens: 100, output_tokens: 5, cost: 0.00001 },
        expected: { owner: "forged_expected" },
        grade: { correct: 999, total: 999, caseCorrect: true },
        response: {
          model: "fixture/resolved",
          requestedModel: modelId,
          provider: "Fixture provider",
          request: { model: modelId, ...makePayload("triage", entry) },
          raw: { fixture: true },
          answers: Object.fromEntries(
            Object.entries(entry.expected).map(([key, value]) => [
              key,
              { value },
            ]),
          ),
        },
      },
    ],
  };
}

test("recording import recomputes grades and expected labels instead of trusting imported summaries", () => {
  const source = fixture();
  source.records[0].response.answers.owner.value = "payroll";
  source.summary = { accuracy: 1, cost: 0 };
  const result = parseRecording(JSON.stringify(source), MODELS);
  assert.equal(result.records[0].grade.correct, 2);
  assert.equal(result.records[0].grade.total, 3);
  assert.equal(result.records[0].grade.caseCorrect, false);
  assert.deepEqual(
    result.records[0].expected,
    WORKFLOWS.triage.cases[0].expected,
  );
  assert.equal(result.records[0].modelLabel, MODELS[0].label);
  assert.equal(result.summary, undefined);
  assert.equal(result.imported, true);
  assert.equal(result.sourceSessionId, source.id);
  assert.notEqual(result.id, source.id);
  assert.equal(
    source.records[0].grade.correct,
    999,
    "The source remains unchanged",
  );
});

test("recording import rejects unknown models and undeclared record models", () => {
  assert.throws(
    () =>
      validateImportedSession(fixture({ modelId: "unknown/model" }), MODELS),
    /model IDs/,
  );
  const source = fixture();
  source.records[0].modelId = MODELS[1].id;
  assert.throws(
    () => validateImportedSession(source, MODELS),
    /declared model/,
  );
});

test("recording import rejects malformed typed answers and missing successful provenance", () => {
  for (const [key, value] of [
    ["needs_clarification", "false"],
    ["owner", "unknown_owner"],
    ["owner", false],
  ]) {
    const source = fixture();
    source.records[0].response.answers[key].value = value;
    assert.throws(
      () => validateImportedSession(source, MODELS),
      /invalid .* answer/,
    );
  }
  const source = fixture();
  delete source.records[0].response.request;
  assert.throws(() => validateImportedSession(source, MODELS), /provenance/);
});

test("recording import rejects duplicate attempts and mismatched complete-run coverage", () => {
  const duplicate = fixture();
  duplicate.records.push(structuredClone(duplicate.records[0]));
  duplicate.totalPlanned = 2;
  assert.throws(
    () => validateImportedSession(duplicate, MODELS),
    /duplicate attempts/,
  );

  const mismatch = fixture();
  mismatch.modelIds.push(MODELS[1].id);
  mismatch.records.push(
    fixture({ caseIndex: 1, modelId: MODELS[1].id }).records[0],
  );
  mismatch.totalPlanned = 2;
  assert.throws(
    () => validateImportedSession(mismatch, MODELS),
    /same cases and repeats/,
  );

  const matched = fixture();
  matched.modelIds.push(MODELS[1].id);
  matched.records.push(fixture({ modelId: MODELS[1].id }).records[0]);
  matched.totalPlanned = 2;
  assert.equal(validateImportedSession(matched, MODELS).records.length, 2);
});

test("recording import rejects negative or nonfinite timing and usage values", () => {
  for (const value of [-1, NaN, Infinity, "100"]) {
    const source = fixture();
    source.records[0].elapsedMs = value;
    assert.throws(
      () => validateImportedSession(source, MODELS),
      /elapsed time/,
    );
  }
  for (const location of ["record", "response"]) {
    const source = fixture();
    const target =
      location === "record" ? source.records[0] : source.records[0].response;
    target.usage = { cost: -0.01 };
    assert.throws(
      () => validateImportedSession(source, MODELS),
      /cost usage value/,
    );
  }
  const source = fixture();
  source.records[0].usage = { cost: null };
  assert.equal(
    validateImportedSession(source, MODELS).records[0].usage.cost,
    null,
  );
});

test("recording import bounds file bytes, JSON depth, node count and record count", () => {
  assert.throws(
    () => parseRecording(" ".repeat(MAX_RECORDING_BYTES + 1), MODELS),
    /5 MB/,
  );
  assert.throws(
    () => parseRecording("é".repeat(MAX_RECORDING_BYTES / 2 + 1), MODELS),
    /5 MB/,
  );
  assert.throws(() => parseRecording("{invalid", MODELS), SyntaxError);

  const deep = fixture();
  let cursor = deep;
  for (let index = 0; index < 34; index++) cursor = cursor.nested = {};
  assert.throws(() => validateImportedSession(deep, MODELS), /deeply nested/);

  const manyNodes = fixture();
  manyNodes.extra = Array(100001).fill(0);
  assert.throws(() => validateImportedSession(manyNodes, MODELS), /too large/);

  const manyRecords = fixture();
  manyRecords.records = Array(217).fill(manyRecords.records[0]);
  assert.throws(
    () => validateImportedSession(manyRecords, MODELS),
    /216 attempt records/,
  );
});

test("recording import recovers running checkpoints as stopped and retains measured responses", () => {
  const source = fixture();
  source.status = "running";
  source.totalPlanned = 6;
  const result = validateImportedSession(source, MODELS);
  assert.equal(result.status, "stopped");
  assert.equal(result.records.length, 1);
  assert.equal(result.totalPlanned, 6);
  assert.equal(result.records[0].elapsedMs, 123);
  assert.ok(Number.isFinite(Date.parse(result.recoveredAt)));
  assert.match(result.interruptionNote, /unfinished run/);
});

test("failed attempts cannot gain credit from forged answers and incomplete runs cannot claim completion", () => {
  const source = fixture();
  source.records[0].status = "error";
  assert.equal(
    validateImportedSession(source, MODELS).records[0].grade.correct,
    0,
  );
  source.totalPlanned = 2;
  assert.throws(() => validateImportedSession(source, MODELS), /every planned/);
});

test("score answer validation uses the full declared criterion scale", () => {
  const questions = WORKFLOWS.triage.questions;
  try {
    questions.test_score = {
      type: "score",
      criteria: ["low", "medium", "high"],
    };
    const source = fixture();
    source.records[0].response.answers.test_score = { value: 2 };
    assert.equal(validateImportedSession(source, MODELS).records.length, 1);
    source.records[0].response.answers.test_score.value = 3;
    assert.throws(
      () => validateImportedSession(source, MODELS),
      /invalid score answer/,
    );
  } finally {
    delete questions.test_score;
  }
});
