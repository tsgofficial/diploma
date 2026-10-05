/**
 * Dot-path lookup into the nested fact object: `course.prerequisites` →
 * facts.course.prerequisites. `found` distinguishes "missing" from "null".
 */
import { Facts } from './types';

export function resolvePath(facts: Facts, path: string): { found: boolean; value: unknown } {
  let current: unknown = facts;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[key];
  }
  return { found: true, value: current };
}
