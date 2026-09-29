import { WORKFLOWS, scoreAnswers } from "./hcm.js";

export const MAX_RECORDING_BYTES = 5 * 1024 * 1024;

export function parseRecording(text, models) {
  if (typeof text !== "string")
    throw new Error("The recording must contain JSON text.");
  if (new TextEncoder().encode(text).byteLength > MAX_RECORDING_BYTES)
    throw new Error("Choose a recording smaller than 5 MB.");
  return validateImportedSession(JSON.parse(text), models);
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finiteNonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function validateImportedSession(input, models) {
  const invalid = (message) => {
    throw new Error(`Cannot import this recording: ${message}`);
  };
  if (!isObject(input)) invalid("the file must contain a session object.");
  const queue = [{ value: input, depth: 0 }];
  let visited = 0;
  while (queue.length) {
    const { value, depth } = queue.pop();
    if (++visited > 100000 || depth > 32)
      invalid("the JSON structure is too large or deeply nested.");
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        queue.push({ value: child, depth: depth + 1 });
  }
  const knownModels = new Map(models.map((model) => [model.id, model]));
  if (
    !Array.isArray(input.modelIds) ||
    input.modelIds.length < 1 ||
    input.modelIds.length > 3 ||
    new Set(input.modelIds).size !== input.modelIds.length ||
    input.modelIds.some((id) => !knownModels.has(id))
  )
    invalid("model IDs must match the models configured in this app.");
  if (!["mixed", "triage", "completeness"].includes(input.dataset))
    invalid("the workflow selection is not supported.");
  if (!["complete", "stopped", "running"].includes(input.status))
    invalid("the session status is not supported.");
  if (!Array.isArray(input.records) || input.records.length > 216)
    invalid("at most 216 attempt records are supported.");
  if (
    !Number.isInteger(input.totalPlanned) ||
    input.totalPlanned < 1 ||
    input.totalPlanned > 216 ||
    input.totalPlanned < input.records.length
  )
    invalid("the planned attempt count is invalid.");
  if (![1, 3].includes(input.repetitions))
    invalid("the repeat count must be 1 or 3.");
  if (
    typeof input.createdAt !== "string" ||
    !Number.isFinite(Date.parse(input.createdAt))
  )
    invalid("the run timestamp is invalid.");
  const attempts = new Set();
  const normalizeUsage = (usage) => {
    if (usage == null)
      return { input_tokens: null, output_tokens: null, cost: null };
    if (!isObject(usage)) invalid("usage must be an object.");
    const result = {};
    for (const key of ["input_tokens", "output_tokens", "cost"]) {
      if (usage[key] != null && !finiteNonnegative(usage[key]))
        invalid(`a ${key} usage value is invalid.`);
      result[key] = usage[key] ?? null;
    }
    return result;
  };
  const records = input.records.map((record, index) => {
    if (!isObject(record) || !input.modelIds.includes(record.modelId))
      invalid(`attempt ${index + 1} does not match a declared model.`);
    const workflow = WORKFLOWS[record.workflowId];
    const authoredCase = workflow?.cases.find(
      (item) => item.id === record.caseId,
    );
    if (
      !authoredCase ||
      (input.dataset !== "mixed" && record.workflowId !== input.dataset)
    )
      invalid(`attempt ${index + 1} does not match an authored case.`);
    if (!["success", "error", "cancelled"].includes(record.status))
      invalid(`attempt ${index + 1} has an invalid status.`);
    const repetition = record.repetition ?? 1;
    if (
      !Number.isInteger(repetition) ||
      repetition < 1 ||
      repetition > input.repetitions
    )
      invalid(`attempt ${index + 1} has an invalid repeat number.`);
    const attemptKey = `${record.modelId}|${record.workflowId}|${record.caseId}|${repetition}`;
    if (attempts.has(attemptKey))
      invalid("duplicate attempts cannot be counted twice.");
    attempts.add(attemptKey);
    if (!finiteNonnegative(record.elapsedMs))
      invalid(`attempt ${index + 1} has an invalid elapsed time.`);
    const response = record.response ?? null;
    if (response !== null && !isObject(response))
      invalid(`attempt ${index + 1} has an invalid response.`);
    if (
      response?.model != null &&
      (typeof response.model !== "string" || response.model.length > 200)
    )
      invalid("a resolved model name is invalid.");
    if (
      response?.provider != null &&
      (typeof response.provider !== "string" || response.provider.length > 200)
    )
      invalid("a provider name is invalid.");
    if (
      response?.requestedModel != null &&
      response.requestedModel !== record.modelId
    )
      invalid("a response does not match its requested model.");
    if (response?.elapsedMs != null && !finiteNonnegative(response.elapsedMs))
      invalid("a response elapsed time is invalid.");
    normalizeUsage(response?.usage);
    if (record.status === "success") {
      if (
        !response ||
        !isObject(response.answers) ||
        !isObject(response.request) ||
        !isObject(response.raw) ||
        !response.model
      )
        invalid(
          `successful attempt ${index + 1} is missing its recorded request or response provenance.`,
        );
      for (const [key, question] of Object.entries(workflow.questions)) {
        const value = response.answers[key]?.value;
        if (
          question.type === "choice" &&
          (typeof value !== "string" ||
            !Object.hasOwn(question.criteria, value))
        )
          invalid(`attempt ${index + 1} has an invalid choice answer.`);
        if (question.type === "noul" && typeof value !== "boolean")
          invalid(`attempt ${index + 1} has an invalid yes/no answer.`);
        if (
          question.type === "score" &&
          (typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > question.criteria.length - 1)
        )
          invalid(`attempt ${index + 1} has an invalid score answer.`);
      }
    }
    if (
      record.error != null &&
      (typeof record.error !== "string" || record.error.length > 4000)
    )
      invalid("an error message is invalid.");
    return {
      id: uid(),
      workflowId: record.workflowId,
      caseId: authoredCase.id,
      caseLabel: authoredCase.label,
      repetition,
      expected: authoredCase.expected,
      modelId: record.modelId,
      modelLabel: knownModels.get(record.modelId).label,
      status: record.status,
      grade: scoreAnswers(
        workflow.questions,
        authoredCase.expected,
        record.status === "success" ? response.answers : {},
      ),
      elapsedMs: record.elapsedMs,
      usage: normalizeUsage(record.usage),
      response,
      error: record.error ?? null,
    };
  });
  if (input.status === "complete") {
    if (
      records.length !== input.totalPlanned ||
      records.some((record) => record.status === "cancelled")
    )
      invalid(
        "a complete run must contain every planned, non-cancelled attempt.",
      );
    const caseSets = input.modelIds.map((id) =>
      records
        .filter((record) => record.modelId === id)
        .map(
          (record) =>
            `${record.workflowId}|${record.caseId}|${record.repetition}`,
        )
        .sort()
        .join(","),
    );
    if (!caseSets[0] || caseSets.some((value) => value !== caseSets[0]))
      invalid(
        "a complete comparison must use the same cases and repeats for each model.",
      );
  }
  const recoveredAt =
    input.status === "running" ? new Date().toISOString() : null;
  return {
    id: `import-${uid()}`,
    sourceSessionId:
      typeof input.id === "string" ? input.id.slice(0, 200) : null,
    imported: true,
    importedAt: new Date().toISOString(),
    createdAt: new Date(input.createdAt).toISOString(),
    status: input.status === "running" ? "stopped" : input.status,
    dataset: input.dataset,
    size: ["sample", "all"].includes(input.size) ? input.size : "imported",
    repetitions: input.repetitions,
    modelIds: [...input.modelIds],
    models: input.modelIds.map((id) => knownModels.get(id)),
    totalPlanned: input.totalPlanned,
    labelStatus: "author_expected_not_human_reviewed",
    records,
    ...(recoveredAt
      ? {
          recoveredAt,
          interruptionNote:
            "The imported file contains an unfinished run. Unrecorded requests may have incurred additional provider usage.",
        }
      : {}),
  };
}
