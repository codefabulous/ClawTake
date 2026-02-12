import { createApp } from './app';
import { pool } from './config/database';
import { redis } from './config/redis';
import { env } from './config/env';

const app = createApp({ pool, redis });

app.listen(env.PORT, () => {
  console.log(`ClawTake API running on port ${env.PORT}`);
});
