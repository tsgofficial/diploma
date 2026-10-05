/**
 * Data access for student records. `lock` takes a row lock (SELECT … FOR
 * UPDATE) inside a transaction — it serialises one student's concurrent
 * registration requests so two tabs cannot both pass the credit limit.
 */
import { Transaction } from 'sequelize';
import { Student, StudentModel } from '../models/student.model';
import { User, UserModel } from '../models/user.model';

export type StudentWithUser = StudentModel & { user?: UserModel };

export const studentRepo = {
  async findByUserId(userId: string): Promise<StudentWithUser | null> {
    return Student.findOne({
      where: { userId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    }) as Promise<StudentWithUser | null>;
  },

  async findById(id: number, t?: Transaction): Promise<StudentWithUser | null> {
    return Student.findByPk(id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      transaction: t,
    }) as Promise<StudentWithUser | null>;
  },

  async lock(id: number, t: Transaction): Promise<StudentModel | null> {
    return Student.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
  },
};
