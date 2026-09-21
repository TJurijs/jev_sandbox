import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequest,
  checkExpected,
  probabilityEntries,
  updateDraft,
} from "../src/lib.js";

const draft = {
  type: "choice",
  instructions: "Pick a team",
  input: "Refund please",
  inputMode: "text",
  criteria: [
    { label: "billing", description: "Payments and refunds" },
    { label: "support", description: "Technical help" },
  ],
};
test("text context and choice descriptions retain their meaning in wire format", () => {
  assert.deepEqual(buildRequest(draft), {
    state: { text: "Refund please" },
    questions: {
      decision: {
        type: "choice",
        instructions: "Pick a team",
        criteria: {
          billing: "Payments and refunds",
          support: "Technical help",
        },
      },
    },
  });
});
test("score indices follow ordered descriptions and allow structured JSON state", () => {
  const req = buildRequest({
    ...draft,
    type: "score",
    inputMode: "json",
    input: '{"review":"nice"}',
  });
  assert.deepEqual(req.state, { review: "nice" });
  assert.deepEqual(req.questions.decision.criteria, [
    "Payments and refunds",
    "Technical help",
  ]);
});
test("ambiguous choices and malformed context are rejected", () => {
  assert.throws(
    () =>
      buildRequest({
        ...draft,
        criteria: [draft.criteria[0], draft.criteria[0]],
      }),
    /unique/,
  );
  assert.throws(
    () => buildRequest({ ...draft, inputMode: "json", input: "{" }),
    /valid JSON/,
  );
  assert.throws(
    () => buildRequest({ ...draft, inputMode: "json", input: "null" }),
    /object, array, or string/,
  );
});
test("evaluations use boolean threshold, score tolerance, and unlabelled cases stay ungraded", () => {
  assert.equal(checkExpected({ noul: 0.2 }, "false", "noul"), true);
  assert.equal(checkExpected({ score: 1.4 }, "1", "score"), true);
  assert.equal(checkExpected({ score: 1.6 }, "1", "score"), false);
  assert.equal(checkExpected({ choice: "billing" }, "", "choice"), null);
  assert.deepEqual(probabilityEntries({ noul: 0.25 }), [
    ["true", 0.25],
    ["false", 0.75],
  ]);
});

test("successive draft edits preserve the latest input format and other fields", () => {
  const current = {
    ...draft,
    name: "My experiment",
    cases: [{ id: "one", input: "Please help", expected: "support" }],
  };
  const jsonDraft = updateDraft(current, { inputMode: "json" });
  const next = updateDraft(jsonDraft, { input: '{"message":"Please help"}' });

  assert.equal(next.inputMode, "json");
  assert.deepEqual(buildRequest(next).state, { message: "Please help" });
  assert.equal(next.instructions, current.instructions);
  assert.equal(next.name, current.name);
  assert.deepEqual(next.cases, current.cases);
  assert.equal(current.inputMode, "text");
  assert.equal(current.input, "Refund please");
});

test("renaming a choice clears obsolete expectations and compares trimmed labels", () => {
  const current = {
    ...draft,
    cases: [
      { id: "renamed", input: "Refund please", expected: "billing" },
      { id: "retained", input: "Please help", expected: " support " },
      { id: "ungraded", input: "Hello", expected: "" },
    ],
  };
  const original = structuredClone(current);
  const next = updateDraft(current, {
    criteria: [
      { ...current.criteria[0], label: "finance" },
      { ...current.criteria[1], label: " support  " },
    ],
  });

  assert.deepEqual(
    next.cases.map((testCase) => testCase.expected),
    ["", " support ", ""],
  );
  assert.deepEqual(current, original);
});

test("removing a choice clears only expectations absent from the new choices", () => {
  const current = {
    ...draft,
    criteria: [
      ...draft.criteria,
      { label: "sales", description: "Plans and pricing" },
    ],
    cases: [
      { id: "removed", input: "Which plan?", expected: "sales" },
      { id: "retained", input: "Refund please", expected: "billing" },
    ],
  };
  const next = updateDraft(current, { criteria: draft.criteria });

  assert.deepEqual(
    next.cases.map((testCase) => testCase.expected),
    ["", "billing"],
  );
});

test("adding or removing score levels clears all expectations because indices change", () => {
  const current = {
    ...draft,
    type: "score",
    cases: [
      { id: "low", input: "Bad", expected: "0" },
      { id: "high", input: "Good", expected: "1" },
    ],
  };
  const added = updateDraft(current, {
    criteria: [
      ...current.criteria,
      { label: "Excellent", description: "Delighted" },
    ],
  });
  const removed = updateDraft(
    { ...added, cases: current.cases },
    { criteria: current.criteria },
  );

  assert.deepEqual(
    added.cases.map((testCase) => testCase.expected),
    ["", ""],
  );
  assert.deepEqual(
    removed.cases.map((testCase) => testCase.expected),
    ["", ""],
  );
  assert.deepEqual(
    current.cases.map((testCase) => testCase.expected),
    ["0", "1"],
  );
});

test("editing score descriptions without changing levels preserves expectations", () => {
  const current = {
    ...draft,
    type: "score",
    cases: [{ id: "one", input: "Good", expected: "1" }],
  };
  const next = updateDraft(current, {
    criteria: current.criteria.map((criterion) => ({
      ...criterion,
      description: "Revised description",
    })),
  });

  assert.deepEqual(next.cases, current.cases);
});

test("explicit replacement cases take precedence over automatic invalidation", () => {
  const current = {
    ...draft,
    cases: [{ id: "old", input: "Refund please", expected: "billing" }],
  };
  const cases = [{ id: "new", input: "Good", expected: "2" }];
  const next = updateDraft(current, {
    type: "score",
    criteria: [...draft.criteria, { label: "High", description: "Positive" }],
    cases,
  });

  assert.deepEqual(next.cases, cases);
  assert.equal(next.type, "score");
  assert.equal(current.cases[0].expected, "billing");
});
