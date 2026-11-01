import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { getJwtSecret, JWT_ISSUER, JWT_AUDIENCE, COOKIE_NAME } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runAuthSessionsTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  async function run(category: string, name: string, fn: () => Promise<void>) {
    testNum++;
    try {
      await fn();
      reports.push({ num: testNum, name, category, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, name, category, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.4 AUTHENTICATION & SESSION WORKFLOWS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  const testAdminPassword = process.env.TEST_ADMIN_PASSWORD || 'KarshTestAdmin_b9dac07b314c6563!2026';
  let sessionCookie = '';
  let sessionToken = '';

  try {
    // --- 1. Login Workflow ---
    console.log('--- 1. Login & Token Issuance ---');

    await run('AuthLogin', 'POST /api/auth/login with valid credentials sets HTTP-only cookie & returns token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_FIXTURES.user.username,
          password: testAdminPassword,
        }),
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.user !== undefined, 'User object returned');
      assert(body.user.username === TEST_FIXTURES.user.username, 'Username matches');
      assert(!body.user.password_hash, 'Password hash is NOT leaked in response');
      assert(typeof body.token === 'string' && body.token.length > 20, 'JWT token returned');
      sessionToken = body.token;

      // Extract session cookie from Set-Cookie header
      const setCookie = res.headers.get('set-cookie') || '';
      assert(setCookie.includes(COOKIE_NAME), `Set-Cookie contains "${COOKIE_NAME}"`);
      assert(setCookie.toLowerCase().includes('httponly'), 'Cookie is HttpOnly');
      assert(setCookie.toLowerCase().includes('samesite=lax'), 'Cookie has SameSite=Lax');
      sessionCookie = setCookie.split(';')[0];
    });

    await run('AuthLogin', 'POST /api/auth/login with incorrect password returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_FIXTURES.user.username,
          password: 'IncorrectWrongPassword123!',
        }),
      });

      assert(res.status === 401, `Expected 401, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('Invalid') === true, 'Error indicates invalid credentials');
    });

    // --- 2. Authenticated Session Verification ---
    console.log('\n--- 2. Session & Identity Verification ---');

    await run('AuthSession', 'GET /api/auth/me authenticates via session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: sessionCookie },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.user.username === TEST_FIXTURES.user.username, 'Verified identity via cookie');
      assert(!body.user.password_hash, 'Password hash is NOT leaked');
    });

    await run('AuthSession', 'GET /api/auth/me authenticates via Authorization Bearer header', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.user.id === TEST_FIXTURES.user.id, 'Verified identity via Bearer');
    });

    // --- 3. Logout Workflow ---
    console.log('\n--- 3. Logout & Cookie Clearance ---');

    await run('AuthLogout', 'POST /api/auth/logout clears session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const setCookie = res.headers.get('set-cookie') || '';
      assert(setCookie.includes('Expires=') || setCookie.includes('Max-Age=0') || setCookie.includes(`${COOKIE_NAME}=;`), 'Cookie clearance header sent');
    });

    // --- 4. Token Rejection Security ---
    console.log('\n--- 4. Token Rejection Defense ---');

    await run('AuthSecurity', 'Expired JWT token returns HTTP 401', async () => {
      const secret = getJwtSecret();
      const expiredToken = jwt.sign(
        { sub: TEST_FIXTURES.user.id, userId: TEST_FIXTURES.user.id, username: TEST_FIXTURES.user.username, role: 'admin' },
        secret,
        { algorithm: 'HS256', expiresIn: '-1s', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert(res.status === 401, `Expected 401 for expired token, got ${res.status}`);
    });

    await run('AuthSecurity', 'Tampered JWT signature returns HTTP 401', async () => {
      const parts = sessionToken.split('.');
      // Tamper signature by changing last character
      const tamperedSig = parts[2].substring(0, parts[2].length - 1) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      assert(res.status === 401, `Expected 401 for tampered token, got ${res.status}`);
    });

    await run('AuthSecurity', 'Valid token for deleted user ID returns HTTP 401', async () => {
      const secret = getJwtSecret();
      const ghostToken = jwt.sign(
        { sub: 'usr_non_existent_ghost_id', userId: 'usr_non_existent_ghost_id', username: 'ghost_admin', role: 'admin' },
        secret,
        { algorithm: 'HS256', expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${ghostToken}` },
      });
      assert(res.status === 401, `Expected 401 for deleted user, got ${res.status}`);
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`AUTH SESSIONS SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Auth Sessions Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_auth_sessions.ts')) {
  runAuthSessionsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN AUTH SESSIONS SUITE]', err);
      process.exit(1);
    });
}
