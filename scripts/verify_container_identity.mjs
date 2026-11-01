import pg from 'pg';
const { Client } = pg;

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch (err) {
    console.error('[FATAL] Failed to load .env.test:', err.message);
    process.exit(1);
  }
}

async function verifyIdentity() {
  console.log('=== VERIFYING TEST CONTAINER DATABASE IDENTITY ===');
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    console.error('[FATAL] TEST_DATABASE_URL not set in .env.test');
    process.exit(1);
  }

  // Safety check on connection target
  const parsed = new URL(testDbUrl);
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    console.error(`[SECURITY FATAL] Host must be 127.0.0.1 (got: ${parsed.hostname})`);
    process.exit(1);
  }
  if (parsed.port !== '5433') {
    console.error(`[SECURITY FATAL] Host port must be 5433 (got: ${parsed.port})`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: testDbUrl,
    ssl: false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log('[Connected] Successfully connected to 127.0.0.1:5433');

    // 1. Identity query
    const idRes = await client.query(`
      SELECT 
        current_database() AS current_database,
        current_user AS current_user,
        inet_server_port() AS inet_server_port,
        version() AS version;
    `);

    const row = idRes.rows[0];
    console.log('\n--- Database Identity Attributes ---');
    console.log(`current_database() : ${row.current_database}`);
    console.log(`current_user       : ${row.current_user}`);
    console.log(`inet_server_port() : ${row.inet_server_port}`);
    console.log(`version()          : ${row.version}`);

    // Assertions
    const dbMatch = row.current_database === 'karsh_tech_test';
    const userMatch = row.current_user === 'karsh_test_user';
    const portMatch = row.inet_server_port === 5432;
    const versionMatch = row.version.includes('PostgreSQL 16') && row.version.includes('Alpine');

    console.log('\n--- Expectation Validation ---');
    console.log(`Database is "karsh_tech_test" : ${dbMatch ? 'PASS' : 'FAIL'}`);
    console.log(`User is "karsh_test_user"     : ${userMatch ? 'PASS' : 'FAIL'}`);
    console.log(`Container Port is 5432        : ${portMatch ? 'PASS' : 'FAIL'}`);
    console.log(`Version is PostgreSQL 16 Alpine: ${versionMatch ? 'PASS' : 'FAIL'}`);

    if (!dbMatch || !userMatch || !portMatch || !versionMatch) {
      console.error('[FAIL] Identity attributes do not match expected container configuration.');
      process.exit(1);
    }

    // 2. Check for environment marker table (read-only)
    const markerCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = '_test_environment_marker';
    `);

    console.log('\n--- Environment Marker Status ---');
    if (markerCheck.rows.length > 0) {
      const markerData = await client.query('SELECT * FROM _test_environment_marker;');
      console.log(`Marker table "_test_environment_marker" is PRESENT:`, markerData.rows);
    } else {
      console.log('Marker table "_test_environment_marker" is NOT PRESENT (Expected: Schema migrations have not been applied yet).');
    }

    // 3. Check existing tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`Public tables count: ${tablesRes.rows.length}`);
    if (tablesRes.rows.length > 0) {
      console.log('Tables:', tablesRes.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('Schema is completely pristine/empty. Migrations are pending.');
    }

    console.log('\n[SUCCESS] Database identity successfully verified without any write operations.');
  } catch (err) {
    console.error('[FATAL] Failed to verify database identity:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyIdentity();
