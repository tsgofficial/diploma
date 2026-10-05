/**
 * Message templates: `{course.code}` reads a fact, `{params.max}` a rule param.
 * Lists are joined with ", "; non-integers are shown with two decimals (GPA).
 */
import { Facts, LocalizedText, RuleParams } from './types';
import { resolvePath } from './resolve';

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)\}/g;

function format(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.map(format).join(', ') : '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}

export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function interpolate(template: string, facts: Facts, params: RuleParams): string {
  return template.replace(PLACEHOLDER, (_whole, key: string) => {
    if (key.startsWith('params.')) return format(params[key.slice('params.'.length)]);
    return format(resolvePath(facts, key).value);
  });
}

export function interpolateText(text: LocalizedText, facts: Facts, params: RuleParams): LocalizedText {
  return { mn: interpolate(text.mn, facts, params), en: interpolate(text.en, facts, params) };
}
