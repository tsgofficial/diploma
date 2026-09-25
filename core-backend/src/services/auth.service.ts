/**
 * Auth service — registration, login, and JWT issuance/verification.
 *
 * Plain object of functions; bcryptjs and jsonwebtoken are libraries, so no
 * classes are introduced. Passwords are only ever stored as bcrypt hashes.
 */
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepo } from '../repos/user.repo';
import { UserModel, UserRole } from '../models/user.model';
import { createHttpError } from '../utils/httpError';

const SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export function toPublicUser(user: UserModel): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export const authService = {
  /** Create a new account and return the user + a signed JWT. */
  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      throw createHttpError(409, 'email already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepo.create({ email, passwordHash, name: name ?? null });

    const publicUser = toPublicUser(user);
    return { user: publicUser, token: signToken({ sub: user.id, email: user.email, role: user.role }) };
  },

  /** Verify credentials and return the user + a signed JWT. */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await userRepo.findByEmail(email);
    // Same error whether the email is unknown or the password is wrong —
    // don't leak which accounts exist.
    if (!user) throw createHttpError(401, 'invalid email or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createHttpError(401, 'invalid email or password');

    const publicUser = toPublicUser(user);
    return { user: publicUser, token: signToken({ sub: user.id, email: user.email, role: user.role }) };
  },

  /** Current user from a verified id (null if deleted since the token was issued). */
  async me(userId: string): Promise<PublicUser | null> {
    const user = await userRepo.findById(userId);
    return user ? toPublicUser(user) : null;
  },

  /** Verify a JWT and return its payload. Throws 401 if invalid/expired. */
  verifyToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as Partial<TokenPayload>;
      if (typeof payload.sub !== 'string') throw new Error('bad token');
      // Tokens issued before roles existed carry no role — treat as `user`.
      return { sub: payload.sub, email: payload.email ?? '', role: payload.role ?? 'user' };
    } catch {
      throw createHttpError(401, 'invalid or expired token');
    }
  },
};
