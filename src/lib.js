export function updateDraft(current, changes) {
  const next = { ...current, ...changes };
  if (
    !Object.hasOwn(changes, "criteria") ||
    Object.hasOwn(changes, "cases") ||
    !Array.isArray(next.cases)
  )
    return next;

  if (next.type === "choice") {
    const labels = new Set(
      next.criteria.map((criterion) => criterion.label.trim()),
    );
    next.cases = next.cases.map((testCase) =>
      labels.has(String(testCase.expected).trim())
        ? testCase
        : { ...testCase, expected: "" },
    );
  } else if (
    next.type === "score" &&
    next.criteria.length !== current.criteria.length
  ) {
    next.cases = next.cases.map((testCase) => ({ ...testCase, expected: "" }));
  }
  return next;
}

export function buildRequest(draft, input = draft.input) {
  if (!draft.instructions.trim())
    throw new Error("Add a question for Jev to answer.");
  if (!input.trim()) throw new Error("Add some input to evaluate.");
  let state = { text: input };
  if (draft.inputMode === "json") {
    try {
      state = JSON.parse(input);
    } catch {
      throw new Error(
        "Input is not valid JSON. Check the syntax and try again.",
      );
    }
    if (state === null || !["object", "string"].includes(typeof state))
      throw new Error("JSON input must be an object, array, or string.");
  }
  const criteria = draft.criteria;
  if (criteria.some((c) => !c.description.trim()))
    throw new Error("Give every possible answer a description.");
  let wireCriteria;
  if (draft.type === "score") {
    if (criteria.length < 2 || criteria.length > 10)
      throw new Error("Scores need between 2 and 10 ordered levels.");
    wireCriteria = criteria.map((c) => c.description.trim());
  } else {
    const labels = criteria.map((c) => c.label.trim());
    if (labels.some((l) => !l))
      throw new Error("Give every possible answer a label.");
    if (new Set(labels).size !== labels.length)
      throw new Error("Each answer needs a unique label.");
    if (labels.length < 2)
      throw new Error("Add at least two possible answers.");
    wireCriteria = Object.fromEntries(
      criteria.map((c) => [c.label.trim(), c.description.trim()]),
    );
  }
  return {
    state,
    questions: {
      decision: {
        type: draft.type,
        instructions: draft.instructions.trim(),
        criteria: wireCriteria,
      },
    },
  };
}

export function getAnswer(result) {
  return result?.answers?.decision;
}

export function answerLabel(answer) {
  if (!answer) return "—";
  if (typeof answer.choice === "string") return answer.choice;
  if (typeof answer.noul === "number")
    return answer.noul >= 0.5 ? "true" : "false";
  if (typeof answer.score === "number")
    return Number(answer.score.toFixed(3)).toString();
  return "—";
}

export function checkExpected(answer, expected, type, tolerance = 0.5) {
  if (!String(expected).trim() || !answer) return null;
  if (type === "score")
    return (
      Number.isFinite(Number(expected)) &&
      typeof answer.score === "number" &&
      Math.abs(answer.score - Number(expected)) <= tolerance
    );
  return answerLabel(answer) === String(expected).trim();
}

export function probabilityEntries(answer) {
  if (typeof answer?.noul === "number")
    return [
      ["true", answer.noul],
      ["false", 1 - answer.noul],
    ];
  return Object.entries(answer?.probabilities || {})
    .filter(([, value]) => typeof value === "number")
    .sort((a, b) => b[1] - a[1]);
}

export function safeLoad(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function downloadJson(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
