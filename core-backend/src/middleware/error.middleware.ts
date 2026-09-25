/**
 * Central error handler. Maps thrown errors to JSON responses.
 * Express recognizes this as error middleware by its four arguments.
 */
import { Request, Response, NextFunction } from 'express';
import { isHttpError } from '../utils/httpError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const multerCode = (err as { code?: string } | null)?.code;
  const status = isHttpError(err)
    ? err.status
    : multerCode === 'LIMIT_FILE_SIZE'
      ? 413
      : multerCode?.startsWith('LIMIT_')
        ? 400
        : 500;
  const message =
    err instanceof Error && status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    // Log unexpected failures; keep client-facing detail generic.
    console.error('[error]', err);
  }

  res.status(status).json({ error: message });
}
