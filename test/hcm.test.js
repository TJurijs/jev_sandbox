import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKFLOWS,
  makePayload,
  scoreAnswers,
  summarizeRuns,
} from "../src/hcm.js";

test("synthetic authored cases have unique identities and complete, valid expected labels", () => {
  const identities = new Set();
  for (const workflow of Object.values(WORKFLOWS)) {
    assert.equal(workflow.labelStatus, "author_expected_not_human_reviewed");
    assert.ok(workflow.cases.length >= 12);
    for (const entry of workflow.cases) {
      assert.ok(!identities.has(entry.id), `Duplicate case: ${entry.id}`);
      identities.add(entry.id);
      assert.equal(entry.labelStatus, "author_expected_not_human_reviewed");
      assert.ok(entry.message && entry.explanation && entry.label);
      assert.deepEqual(
        Object.keys(entry.expected).sort(),
        Object.keys(workflow.questions).sort(),
      );
      for (const [key, question] of Object.entries(workflow.questions)) {
        if (question.type === "noul")
          assert.equal(typeof entry.expected[key], "boolean");
        else assert.ok(Object.hasOwn(question.criteria, entry.expected[key]));
      }
    }
    for (const preset of workflow.presets)
      assert.equal(
        workflow.cases.find((entry) => entry.id === preset.id),
        preset,
      );
  }
  assert.ok(identities.size >= 24);
});

test("triage authored routes follow the explicit evidence hierarchy", () => {
  for (const entry of WORKFLOWS.triage.cases) {
    const { issue, owner, needs_clarification } = entry.expected;
    assert.equal(needs_clarification, owner === "clarification", entry.id);
    if (issue === "leave_balance") assert.equal(owner, "time_management");
    else if (issue === "employee_record") assert.equal(owner, "employee_data");
    else if (issue === "other") assert.equal(owner, "clarification");
    else {
      const facts = entry.facts;
      const expectedOwner = ["awaiting", "rejected"].includes(
        facts.approval_status,
      )
        ? "manager"
        : facts.approval_status === "approved" &&
            facts.payroll_input === "missing"
          ? "time_management"
          : facts.approval_status === "approved" &&
              facts.payroll_input === "confirmed" &&
              facts.payslip_overtime === "missing"
            ? "payroll"
            : "clarification";
      assert.equal(owner, expectedOwner, entry.id);
    }
  }
  assert.equal(
    WORKFLOWS.triage.presets[0].message,
    WORKFLOWS.triage.presets[1].message,
  );
  assert.equal(
    WORKFLOWS.triage.presets[1].message,
    WORKFLOWS.triage.presets[2].message,
  );
  assert.deepEqual(
    WORKFLOWS.triage.presets.map((entry) => entry.expected.owner),
    ["manager", "time_management", "payroll"],
  );
});

test("completeness routes require all four checks and verified approval evidence", () => {
  for (const entry of WORKFLOWS.completeness.cases) {
    const { exact_date, weekly_hours, work_pattern, approval_evidence, route } =
      entry.expected;
    assert.equal(
      route,
      exact_date && weekly_hours && work_pattern && approval_evidence
        ? "ready_for_hr"
        : "request_details",
      entry.id,
    );
    assert.equal(
      approval_evidence,
      entry.facts.approval_status === "approved" &&
        typeof entry.facts.approval_reference === "string" &&
        entry.facts.approval_reference.trim().length > 0,
      entry.id,
    );
  }
  const omittedTotal = WORKFLOWS.completeness.cases.find(
    (entry) => entry.id === "complete-04",
  );
  assert.equal(omittedTotal.expected.work_pattern, true);
  assert.equal(omittedTotal.expected.weekly_hours, false);
});

test("payloads exclude labels and presentation metadata and isolate mutable facts", () => {
  const entry = WORKFLOWS.completeness.cases.find(
    (item) => item.id === "complete-09",
  );
  const payload = makePayload("completeness", entry);
  assert.deepEqual(Object.keys(payload).sort(), ["questions", "state"]);
  assert.deepEqual(Object.keys(payload.state).sort(), [
    "employee_message",
    "facts",
    "policy",
  ]);
  assert.equal(payload.state.employee_message, entry.message);
  assert.equal(payload.state.policy, WORKFLOWS.completeness.policy);
  payload.state.facts.requested_work_pattern.Monday = 99;
  payload.questions.route.criteria.ready_for_hr = "changed";
  assert.equal(entry.facts.requested_work_pattern.Monday, 8);
  assert.notEqual(
    WORKFLOWS.completeness.questions.route.criteria.ready_for_hr,
    "changed",
  );
  assert.deepEqual(makePayload("triage", "Please help").state.facts, {});
  assert.throws(() => makePayload("missing", entry), /Unknown workflow/);
  assert.throws(
    () => makePayload("triage", { message: "Hi", facts: [] }),
    /JSON object/,
  );
});

test("grading gives missing or malformed answers zero credit without guessing a threshold", () => {
  const questions = WORKFLOWS.triage.questions;
  const expected = WORKFLOWS.triage.cases[0].expected;
  const grade = scoreAnswers(questions, expected, {
    issue: { value: "overtime_payment" },
    needs_clarification: { value: false },
  });
  assert.equal(grade.correct, 2);
  assert.equal(grade.total, 3);
  assert.equal(grade.caseCorrect, false);
  assert.deepEqual(
    grade.details.find((detail) => detail.key === "owner"),
    { key: "owner", expected: "manager", actual: null, correct: false },
  );
  assert.equal(
    scoreAnswers(
      { flag: { type: "noul" } },
      { flag: true },
      { flag: { value: 0.99 } },
    ).correct,
    0,
  );
  assert.equal(
    scoreAnswers(
      { flag: { type: "noul" } },
      { flag: false },
      { flag: { value: "false" } },
    ).correct,
    1,
  );
  assert.deepEqual(scoreAnswers(questions, {}, {}), {
    correct: 0,
    total: 0,
    caseCorrect: null,
    details: [],
  });
});

test("all provided decisions must match for a case to pass", () => {
  for (const workflow of Object.values(WORKFLOWS)) {
    for (const entry of workflow.cases) {
      const answers = Object.fromEntries(
        Object.entries(entry.expected).map(([key, value]) => [key, { value }]),
      );
      const grade = scoreAnswers(workflow.questions, entry.expected, answers);
      assert.equal(grade.caseCorrect, true);
      assert.equal(grade.correct, Object.keys(workflow.questions).length);
    }
  }
});

test("errors receive zero credit in labeled denominators while cancelled runs are excluded", () => {
  const result = summarizeRuns([
    {
      status: "success",
      elapsedMs: 100,
      usage: { cost: 0.001 },
      grade: { correct: 3, total: 3 },
    },
    {
      status: "error",
      elapsedMs: 1,
      usage: { cost: 0 },
      grade: { correct: 3, total: 3 },
    },
    {
      status: "cancelled",
      elapsedMs: 9000,
      usage: { cost: 5 },
      grade: { correct: 0, total: 100 },
    },
  ]);
  assert.equal(result.count, 3);
  assert.equal(result.completed, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.cancelled, 1);
  assert.equal(result.correct, 3);
  assert.equal(result.total, 6);
  assert.equal(result.caseCorrect, 1);
  assert.equal(result.accuracy, 0.5);
  assert.equal(result.caseAccuracy, 0.5);
  assert.equal(result.p50, 100);
  assert.equal(result.cost, 0.001);
  assert.equal(result.costPer1000, 0.5);
});

test("latency percentiles use nearest rank on successful, finite end-to-end samples", () => {
  const records = Array.from({ length: 20 }, (_, index) => ({
    status: "success",
    elapsedMs: (20 - index) * 10,
    usage: { cost: 0 },
  }));
  records.push({ status: "success", elapsedMs: null, usage: { cost: 0 } });
  records.push({ status: "error", elapsedMs: 100000, usage: { cost: 0 } });
  const summary = summarizeRuns(records);
  assert.equal(summary.p50, 100);
  assert.equal(summary.p95, 190);
  assert.equal(summary.accuracy, null);
  assert.equal(summary.caseAccuracy, null);
});

test("missing cost is not zero and a partial bill is not projected as complete cost", () => {
  const partial = summarizeRuns([
    { status: "success", usage: { cost: 0 }, grade: { correct: 1, total: 1 } },
    {
      status: "success",
      usage: { cost: 0.002 },
      grade: { correct: 1, total: 1 },
    },
    { status: "error", grade: { correct: 0, total: 1 } },
  ]);
  assert.equal(partial.knownCost, 0.002);
  assert.equal(partial.missingCost, 1);
  assert.equal(partial.cost, null);
  assert.equal(partial.costPer1000, null);
  const free = summarizeRuns([{ status: "success", usage: { cost: 0 } }]);
  assert.equal(free.cost, 0);
  assert.equal(free.costPer1000, 0);
  const empty = summarizeRuns([]);
  assert.equal(empty.cost, null);
  assert.equal(empty.p50, null);
  assert.equal(empty.p95, null);
  assert.equal(empty.accuracy, null);
});
