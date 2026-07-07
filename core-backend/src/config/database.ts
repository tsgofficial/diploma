/**
 * Shared Sequelize instance.
 *
 * `new Sequelize(...)` is the library's connection constructor — the app's own
 * code stays classless. All models attach to this single instance.
 */
import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // flip to console.log to inspect generated queries
  define: {
    underscored: true, // snake_case columns (created_at, session_id, ...)
    freezeTableName: false,
  },
});

/** Verify connectivity at startup. Throws if the DB is unreachable. */
export async function assertDbConnection(): Promise<void> {
  await sequelize.authenticate();
}
