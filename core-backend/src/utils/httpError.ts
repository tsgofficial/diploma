/**
 * Functional HTTP error helper — no `class extends Error`.
 *
 * `createHttpError` returns a plain Error augmented with a `status` field.
 * `isHttpError` is a type guard the error middleware uses to pick a status code.
 */
export interface HttpError extends Error {
  status: number;
}

export function createHttpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  err.name = 'HttpError';
  return err;
}

export function isHttpError(value: unknown): value is HttpError {
  return (
    value instanceof Error &&
    typeof (value as Partial<HttpError>).status === 'number'
  );
}
