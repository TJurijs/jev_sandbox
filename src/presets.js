// Score labels are for the editor. The wire format is an ordered array of
// descriptions, so a score ranges from 0 to criteria.length - 1.
// Expected values are hand-written sample labels, not guaranteed model outputs.
export const PRESETS = [
  {
    id: "support-routing",
    name: "Support routing",
    description: "Route a customer message to the right team.",
    type: "choice",
    instructions:
      "Which team should handle the main request in this customer message?",
    criteria: [
      {
        label: "billing",
        description: "An existing charge, invoice, payment, or refund.",
      },
      {
        label: "technical",
        description:
          "A broken feature, software error, outage, or integration problem, excluding sign-in and account access.",
      },
      {
        label: "account",
        description:
          "Sign-in, password reset, account access, user permissions, or profile changes.",
      },
      {
        label: "sales",
        description:
          "Product pricing, plans, trials, or buying a subscription.",
      },
      {
        label: "other",
        description: "A request that does not fit any of the teams above.",
      },
    ],
    input:
      "I was billed twice for our September subscription. Can you check the duplicate charge and refund it?",
    inputMode: "text",
    cases: [
      {
        id: "routing-billing",
        input:
          "There are two identical charges on my card for this month. Please reverse the duplicate payment.",
        expected: "billing",
      },
      {
        id: "routing-technical",
        input:
          "The CSV export button gives a 500 error every time. I can use the rest of the dashboard normally.",
        expected: "technical",
      },
      {
        id: "routing-account",
        input:
          "I forgot my password and the reset email never arrives. I need help getting back into my account.",
        expected: "account",
      },
      {
        id: "routing-sales",
        input:
          "We have 40 employees. Which subscription plan would you recommend, and do you offer a trial?",
        expected: "sales",
      },
    ],
  },
  {
    id: "refund-request",
    name: "Refund detection",
    description: "Measure whether a customer is asking for money back.",
    type: "noul",
    instructions:
      "Is the customer asking to receive money back for a payment they already made?",
    criteria: [
      {
        label: "true",
        description:
          "The customer explicitly requests a refund, reversal, reimbursement, or return of a previous payment.",
      },
      {
        label: "false",
        description:
          "The customer does not request money back. Asking about the refund policy, canceling future renewal, or reporting a problem alone does not count.",
      },
    ],
    input:
      "I canceled last week but was charged again today. Please return this payment to my card.",
    inputMode: "text",
    cases: [
      {
        id: "refund-explicit",
        input: "The order never arrived. Please refund the full amount I paid.",
        expected: "true",
      },
      {
        id: "refund-paraphrase",
        input:
          "I paid for this twice by mistake. Could you reverse one of those payments?",
        expected: "true",
      },
      {
        id: "refund-policy",
        input: "Before I buy, how many days do I have to request a refund?",
        expected: "false",
      },
      {
        id: "refund-cancellation",
        input:
          "Please turn off automatic renewal. I want to keep using my current subscription until it ends.",
        expected: "false",
      },
    ],
  },
  {
    id: "sentiment-score",
    name: "Sentiment score",
    description: "Place feedback on a negative-to-positive scale.",
    type: "score",
    instructions:
      "How does the customer feel about the product or service, based on the opinion expressed in this message?",
    criteria: [
      {
        label: "Negative",
        description:
          "Expresses dissatisfaction, disappointment, frustration, or a negative opinion of the product or service.",
      },
      {
        label: "Neutral",
        description:
          "Communicates a fact or a request without expressing approval or dissatisfaction, or clearly balances positive and negative opinions.",
      },
      {
        label: "Positive",
        description:
          "Expresses satisfaction, appreciation, enthusiasm, or a positive opinion of the product or service.",
      },
    ],
    input:
      "The new dashboard is so much easier to use. It saves me time every morning. Thank you!",
    inputMode: "text",
    cases: [
      {
        id: "sentiment-negative",
        input:
          "This app is incredibly frustrating. It keeps losing my work and I regret buying it.",
        expected: "0",
      },
      {
        id: "sentiment-neutral",
        input:
          "My account is on the monthly plan. Where can I download the invoice?",
        expected: "1",
      },
      {
        id: "sentiment-positive",
        input:
          "I love the new update! Everything is easier to find, and the support team was wonderful.",
        expected: "2",
      },
      {
        id: "sentiment-disappointed",
        input:
          "I am disappointed with this service. The reports are unreliable and support has been unhelpful.",
        expected: "0",
      },
    ],
  },
];
