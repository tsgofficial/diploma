/**
 * Rule-engine vocabulary.
 *
 * A rule is pure data (stored as JSONB in `registration_rules`): a condition
 * tree over named *facts*, a severity, and a message template. The engine
 * knows nothing about courses or students — the registration services build
 * the facts, the engine only evaluates them. That split is what lets an admin
 * change a limit (21 → 18 credits) or add a rule without a code change.
 */

export type Severity = 'error' | 'warning';

/** Хичээл сонголт 1 (choose courses) vs Хичээл сонголт 2 (choose times/teachers). */
export type RulePhase = 'selection' | 'schedule';

/**
 * What one evaluation looks at. `plan` rules run once per request; `course`
 * rules once per course in the plan; `section` rules once per class section
 * being picked.
 */
export type RuleScope = 'plan' | 'course' | 'section';

export type Operator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'notEmpty';

export type Scalar = string | number | boolean | null;

/** A literal, another fact (`{ fact: 'plan.totalCredits' }`), or a rule param (`{ param: 'max' }`). */
export type Operand = Scalar | Scalar[] | { fact: string } | { param: string };

export interface LeafCondition {
  fact: string;
  op: Operator;
  value?: Operand;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | LeafCondition;

export interface LocalizedText {
  mn: string;
  en: string;
}

/** Where the rule comes from — lets the UI open the exact page of the regulation. */
export interface RuleSource {
  docTitle: string;
  clause: string | null;
  page: number | null;
}

export type RuleParams = Record<string, Scalar | Scalar[]>;

export interface RuleDefinition {
  code: string;
  phase: RulePhase;
  scope: RuleScope;
  severity: Severity;
  enabled: boolean;
  /** Lower runs first; also the display order. */
  priority: number;
  title: LocalizedText;
  /** Precondition: when present and false, the rule does not apply (skipped). */
  when?: Condition | null;
  /** What must hold. A false condition is a violation. */
  condition: Condition;
  params: RuleParams;
  /** `{course.code}` → fact, `{params.max}` → param. Arrays are joined with ", ". */
  message: LocalizedText;
  source: RuleSource | null;
}

/** Nested fact object, e.g. `{ student: {...}, plan: {...}, course: {...} }`. */
export type Facts = Record<string, unknown>;

export interface Subject {
  kind: RuleScope;
  /** Course id / section id; absent for the plan. */
  id?: number | string;
  /** Human label for the UI, e.g. "CS204 Алгоритмын шинжилгээ". */
  label?: string;
  facts: Facts;
}

export type OutcomeStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface TraceNode {
  kind: 'all' | 'any' | 'not' | 'leaf';
  result: boolean;
  fact?: string;
  op?: Operator;
  expected?: unknown;
  actual?: unknown;
  /** Set when a referenced fact or param does not exist. */
  missing?: string;
  children?: TraceNode[];
}

export interface RuleOutcome {
  rule: string;
  severity: Severity;
  status: OutcomeStatus;
  title: LocalizedText;
  subject: { kind: RuleScope; id?: number | string; label?: string };
  /** Interpolated message — only for failed/error outcomes. */
  message: LocalizedText | null;
  source: RuleSource | null;
  trace?: { when?: TraceNode; condition?: TraceNode };
}

export interface Evaluation {
  /** False when any error-severity rule failed (or could not be evaluated). */
  allowed: boolean;
  errors: RuleOutcome[];
  warnings: RuleOutcome[];
  /** Number of (rule, subject) pairs that were actually checked. */
  checked: number;
  /** Every outcome including passed/skipped — only when `explain` is on. */
  outcomes?: RuleOutcome[];
}
