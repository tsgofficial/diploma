/**
 * Server bootstrap: connect to Postgres, sync models, then listen.
 */
import { createApp } from './app';
import { env } from './config/env';
import { assertDbConnection } from './config/database';
import { syncModels } from './models';
import { seedAdmin } from './config/seed';
import { ruleService } from './services/rule.service';

async function main(): Promise<void> {
  await assertDbConnection();
  await syncModels();
  await seedAdmin();
  const rules = await ruleService.ensureDefaults();
  if (rules) console.log(`[seed] added ${rules} default registration rules`);

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`core-backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('failed to start core-backend:', err);
  process.exit(1);
});
