/**
 * Data access for users. Plain functions, Sequelize methods only.
 */
import { User, UserModel } from '../models/user.model';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
}

export const userRepo = {
  /** Insert a new user row. */
  async create(input: CreateUserInput): Promise<UserModel> {
    return User.create({
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
    });
  },

  /** Look up a user by email (null if not found). */
  async findByEmail(email: string): Promise<UserModel | null> {
    return User.findOne({ where: { email } });
  },

  /** Look up a user by id (null if not found). */
  async findById(id: string): Promise<UserModel | null> {
    return User.findByPk(id);
  },
};
