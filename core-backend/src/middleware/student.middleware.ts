/**
 * Resolves the signed-in user's student record and attaches `req.studentId`.
 * Accounts without one (admins, staff) get 404 `no_student`.
 */
import { Request, Response, NextFunction } from 'express';
import { studentRepo } from '../repos/student.repo';
import { createHttpError } from '../utils/httpError';

export async function requireStudent(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const student = await studentRepo.findByUserId(req.userId as string);
    if (!student) throw createHttpError(404, 'this account has no student record', { code: 'no_student' });
    req.studentId = student.id;
    next();
  } catch (err) {
    next(err);
  }
}
