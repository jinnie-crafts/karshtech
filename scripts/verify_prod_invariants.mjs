import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const { Pool } = pg;

async function checkProd() {
  const prodUrl = process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await pool.query(
      "SELECT id, download_count, apk_filename FROM releases WHERE apk_filename = 'arrow-puzzle-release-v1.0.0.apk';"
    );
    console.log('[PROD VERIFICATION] Live download_count:', res.rows[0].download_count);
  } finally {
    await pool.end();
  }

  const fileData = fs.readFileSync('server/data/db.json');
  const hash = crypto.createHash('sha256').update(fileData).digest('hex');
  console.log('[PROD VERIFICATION] db.json sha256:', hash);
}

checkProd().catch(err => {
  console.error('[PROD CHECK ERROR]', err);
  process.exit(1);
});
