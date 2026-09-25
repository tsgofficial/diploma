/**
 * Startup seed — guarantees one admin account exists so the knowledge base
 * can be managed from day one. Controlled by ADMIN_EMAIL / ADMIN_PASSWORD;
 * skipped when either is empty. Idempotent: an existing account with that
 * email is promoted, never recreated or re-passworded.
 */
import bcrypt from 'bcryptjs';
import { env } from './env';
import { userRepo } from '../repos/user.repo';

export async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const email = env.ADMIN_EMAIL.toLowerCase().trim();

  const existing = await userRepo.findByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      await userRepo.updateRole(existing.id, 'admin');
      console.log(`[seed] promoted ${email} to admin`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  await userRepo.create({ email, passwordHash, name: 'Administrator', role: 'admin' });
  console.log(`[seed] created admin account ${email}`);
}
