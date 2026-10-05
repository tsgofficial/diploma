/**
 * Functional HTTP error helper — no `class extends Error`.
 *
 * `createHttpError` returns a plain Error augmented with a `status` field.
 * `isHttpError` is a type guard the error middleware uses to pick a status code.
 */
export interface HttpError extends Error {
  status: number;
  /** Extra JSON merged into the response body, e.g. `{ code, evaluation }`. */
  details?: Record<string, unknown>;
}

export function createHttpError(status: number, message: string, details?: Record<string, unknown>): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  err.name = 'HttpError';
  if (details) err.details = details;
  return err;
}

export function isHttpError(value: unknown): value is HttpError {
  return (
    value instanceof Error &&
    typeof (value as Partial<HttpError>).status === 'number'
  );
}
