/**
 * Comparison operators — the only place where fact values are compared.
 * Type mismatches throw (the rule is reported as un-evaluable instead of
 * silently passing), so a misconfigured rule can never wave a request through.
 */
import { Operator, Scalar } from './types';

export const OPERATORS: readonly Operator[] = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'notIn',
  'contains',
  'notContains',
  'isEmpty',
  'notEmpty',
];

/** Operators that take no right-hand value. */
export const UNARY_OPERATORS: readonly Operator[] = ['isEmpty', 'notEmpty'];

function typeError(op: Operator, detail: string): Error {
  const err = new Error(`operator ${op}: ${detail}`);
  err.name = 'RuleTypeError';
  return err;
}

function asNumber(op: Operator, value: unknown, side: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) throw typeError(op, `${side} must be a number`);
  return value;
}

function asArray(op: Operator, value: unknown, side: string): unknown[] {
  if (!Array.isArray(value)) throw typeError(op, `${side} must be a list`);
  return value;
}

function sizeOf(op: Operator, value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value) || typeof value === 'string') return value.length;
  throw typeError(op, 'value must be a list or text');
}

export function applyOperator(op: Operator, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'lt':
      return asNumber(op, actual, 'fact') < asNumber(op, expected, 'value');
    case 'lte':
      return asNumber(op, actual, 'fact') <= asNumber(op, expected, 'value');
    case 'gt':
      return asNumber(op, actual, 'fact') > asNumber(op, expected, 'value');
    case 'gte':
      return asNumber(op, actual, 'fact') >= asNumber(op, expected, 'value');
    case 'in':
      return asArray(op, expected, 'value').includes(actual as Scalar);
    case 'notIn':
      return !asArray(op, expected, 'value').includes(actual as Scalar);
    case 'contains':
      return typeof actual === 'string'
        ? actual.includes(String(expected))
        : asArray(op, actual, 'fact').includes(expected as Scalar);
    case 'notContains':
      return typeof actual === 'string'
        ? !actual.includes(String(expected))
        : !asArray(op, actual, 'fact').includes(expected as Scalar);
    case 'isEmpty':
      return sizeOf(op, actual) === 0;
    case 'notEmpty':
      return sizeOf(op, actual) > 0;
    default: {
      const unknownOp: never = op;
      throw typeError(unknownOp, 'unknown operator');
    }
  }
}
