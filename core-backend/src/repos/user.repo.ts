/**
 * Data access for users. Plain functions, Sequelize methods only.
 */
import { User, UserModel, UserRole } from '../models/user.model';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  role?: UserRole;
}

export const userRepo = {
  /** Insert a new user row. */
  async create(input: CreateUserInput): Promise<UserModel> {
    return User.create({
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      role: input.role ?? 'user',
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

  /** All users, newest first (admin listing). */
  async list(): Promise<UserModel[]> {
    return User.findAll({ order: [['createdAt', 'DESC']] });
  },

  /** Change a user's role. Returns the updated row, or null if missing. */
  async updateRole(id: string, role: UserRole): Promise<UserModel | null> {
    const user = await User.findByPk(id);
    if (!user) return null;
    user.role = role;
    await user.save();
    return user;
  },

  /** Number of admins — used to refuse demoting the last one. */
  async countAdmins(): Promise<number> {
    return User.count({ where: { role: 'admin' } });
  },
};
