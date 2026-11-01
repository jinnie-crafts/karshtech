import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import {
  generateToken,
  verifyToken,
  requireAdmin,
  COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  getJwtSecret,
} from '../server/auth.js';
import { setDatabaseProvider } from '../server/db.js';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function run(num: number, category: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [PASS] [${category}] ${name}`);
    reports.push({ num, name, category, passed: true });
  } catch (err: any) {
    console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    reports.push({ num, name, category, passed: false, error: err.message });
  }
}

export async function runAuthIntegrationTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 AUTHENTICATION & SESSION INTEGRATION TESTS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // 1. Guard check
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const provider = new SupabasePostgresProvider(testDbUrl);
  await provider.init();
  setDatabaseProvider(provider);

  const testAdminPassword = process.env.TEST_ADMIN_PASSWORD || '';
  assert(testAdminPassword.length > 0, 'TEST_ADMIN_PASSWORD must be configured in .env.test');

  try {
    // ------------------------------------------------------------------------
    // DATABASE USER CREDENTIAL VERIFICATION
    // ------------------------------------------------------------------------
    console.log('--- 1. Database User Lookup & Password Verification ---');

    await run(1, 'Credentials', 'Lookup synthetic admin from PostgreSQL test database', async () => {
      const user = await provider.getUserByUsername(TEST_FIXTURES.user.username);
      assert(user !== undefined, 'Synthetic admin user not found');
      assert(user!.role === 'superadmin', 'User role is superadmin');
    });

    await run(2, 'Credentials', 'Bcrypt verification of rotated synthetic administrator password', async () => {
      const user = await provider.getUserByUsername(TEST_FIXTURES.user.username);
      const isMatch = await bcrypt.compare(testAdminPassword, user!.password_hash);
      assert(isMatch === true, 'Rotated synthetic admin password failed bcrypt comparison');
    });

    await run(3, 'Credentials', 'Invalid password fails bcrypt comparison', async () => {
      const user = await provider.getUserByUsername(TEST_FIXTURES.user.username);
      const isMatch = await bcrypt.compare('TotallyWrongPassword123!', user!.password_hash);
      assert(isMatch === false, 'Invalid password erroneously matched bcrypt hash');
    });

    await run(4, 'Credentials', 'Empty password fails bcrypt comparison', async () => {
      const user = await provider.getUserByUsername(TEST_FIXTURES.user.username);
      const isMatch = await bcrypt.compare('', user!.password_hash);
      assert(isMatch === false, 'Empty password erroneously matched bcrypt hash');
    });

    await run(5, 'Credentials', 'Lookup non-existent user returns undefined safely', async () => {
      const user = await provider.getUserByUsername('nonexistent_user_xyz_999');
      assert(user === undefined, 'Non-existent user lookup should return undefined');
    });

    // ------------------------------------------------------------------------
    // JWT TOKEN GENERATION & VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n--- 2. JWT Issuance & Token Lifecycle ---');

    let validToken = '';

    await run(6, 'JWT', 'generateToken creates standard HS256 JWT with correct claims', async () => {
      validToken = generateToken({
        userId: TEST_FIXTURES.user.id,
        username: TEST_FIXTURES.user.username,
        role: 'superadmin',
      });
      assert(typeof validToken === 'string' && validToken.split('.').length === 3, 'Token is valid 3-part JWT');
    });

    await run(7, 'JWT', 'verifyToken validates payload claims, issuer and audience', async () => {
      const payload = verifyToken(validToken);
      assert(payload !== null, 'Valid token failed verification');
      assert(payload!.userId === TEST_FIXTURES.user.id, 'userId claim mismatch');
      assert(payload!.username === TEST_FIXTURES.user.username, 'username claim mismatch');
      assert(payload!.role === 'superadmin', 'role claim mismatch');
      assert(payload!.iss === JWT_ISSUER, 'Issuer claim mismatch');
      assert(payload!.aud === JWT_AUDIENCE, 'Audience claim mismatch');
    });

    await run(8, 'JWT', 'verifyToken rejects tampered token signature', async () => {
      // Modify last character of signature
      const parts = validToken.split('.');
      const tamperedSignature = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      const payload = verifyToken(tamperedToken);
      assert(payload === null, 'Tampered token was accepted');
    });

    await run(9, 'JWT', 'verifyToken rejects expired JWT', async () => {
      const secret = getJwtSecret();
      const expiredToken = jwt.sign(
        { userId: TEST_FIXTURES.user.id, username: 'test_admin', role: 'admin' },
        secret,
        { algorithm: 'HS256', expiresIn: '-1s', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      const payload = verifyToken(expiredToken);
      assert(payload === null, 'Expired token was accepted');
    });

    await run(10, 'JWT', 'verifyToken rejects malformed token strings', async () => {
      assert(verifyToken('') === null, 'Empty string rejected');
      assert(verifyToken('not-a-jwt') === null, 'Plain string rejected');
      assert(verifyToken('header.payload') === null, 'Two-part string rejected');
    });

    // ------------------------------------------------------------------------
    // EXPRESS ADMIN MIDDLEWARE (requireAdmin)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Express requireAdmin Authorization Middleware ---');

    await run(11, 'Middleware', 'requireAdmin authorizes request with valid cookie', async () => {
      const req: any = {
        cookies: { [COOKIE_NAME]: validToken },
        headers: {},
      };
      let nextCalled = false;
      const res: any = {
        status: () => res,
        json: () => res,
      };

      await requireAdmin(req, res, () => { nextCalled = true; });
      assert(nextCalled === true, 'next() was not called for valid cookie session');
    });

    await run(12, 'Middleware', 'requireAdmin authorizes request with valid Bearer header', async () => {
      const req: any = {
        cookies: {},
        headers: { authorization: `Bearer ${validToken}` },
      };
      let nextCalled = false;
      const res: any = {
        status: () => res,
        json: () => res,
      };

      await requireAdmin(req, res, () => { nextCalled = true; });
      assert(nextCalled === true, 'next() was not called for valid Bearer token');
    });

    await run(13, 'Middleware', 'requireAdmin rejects unauthenticated request with HTTP 401', async () => {
      const req: any = { cookies: {}, headers: {} };
      let statusCode = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await requireAdmin(req, res, () => {});
      assert(statusCode === 401, `Expected 401, got ${statusCode}`);
      assert(responseBody?.error?.includes('Unauthorized'), 'Error message does not indicate unauthorized');
    });

    await run(14, 'Middleware', 'requireAdmin rejects insufficient role with HTTP 403', async () => {
      const guestToken = generateToken({
        userId: 'guest_user_001',
        username: 'guest_user',
        role: 'guest',
      });

      const req: any = {
        cookies: { [COOKIE_NAME]: guestToken },
        headers: {},
      };
      let statusCode = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await requireAdmin(req, res, () => {});
      assert(statusCode === 403, `Expected 403 Forbidden, got ${statusCode}`);
      assert(responseBody?.error?.includes('Forbidden'), 'Error message does not indicate Forbidden');
    });

    // ------------------------------------------------------------------------
    // RATE LIMITING
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Authentication Rate Limiting ---');

    await run(15, 'RateLimiting', 'Rate limiter allows requests under threshold and blocks after 5 failed attempts', async () => {
      const testIp = '192.168.100.99';
      clearLoginAttempts(testIp);

      // First 4 failed attempts should still allow
      for (let i = 0; i < 4; i++) {
        recordFailedLogin(testIp);
        const check = checkLoginRateLimit(testIp);
        assert(check.allowed === true, `Attempt ${i + 1} should be allowed`);
      }

      // 5th failed attempt should trigger lockout
      recordFailedLogin(testIp);
      const checkLocked = checkLoginRateLimit(testIp);
      assert(checkLocked.allowed === false, '5th attempt did not trigger lockout');
      assert(checkLocked.remainingSeconds! > 0, 'Lockout should specify remainingSeconds');

      // Clear attempts should restore access
      clearLoginAttempts(testIp);
      const checkCleared = checkLoginRateLimit(testIp);
      assert(checkCleared.allowed === true, 'clearLoginAttempts failed to reset lockout');
    });

  } finally {
    await provider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`AUTH INTEGRATION SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Auth Integration Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_auth_integration.ts')) {
  runAuthIntegrationTests().catch(err => {
    console.error('[FATAL ERROR IN AUTH INTEGRATION SUITE]', err);
    process.exit(1);
  });
}
