import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../server/index.js';
import { db, setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { seedDatabase } from '../server/seed.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  requireAdmin,
  COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
} from '../server/auth.js';
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

export async function runAuthSecurityHardeningTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.5.2 AUTHENTICATION SECURITY HARDENING TESTS');
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
  const originalAdminPasswordEnv = process.env.ADMIN_PASSWORD;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: DATABASE BCRYPT SOLE AUTHORITY & BYPASS IMMUNITY
    // ------------------------------------------------------------------------
    console.log('--- 1. Database Bcrypt Sole Authority & Bypass Immunity ---');

    await run('SoleAuthority', 'Stored database bcrypt hash correctly authenticates valid candidate password', async () => {
      const adminUser = await postgresProvider.getUserByUsername(TEST_FIXTURES.user.username);
      assert(adminUser !== undefined, 'Admin user must exist in test database');
      const matches = await comparePassword(testAdminPassword, adminUser!.password_hash);
      assert(matches === true, 'comparePassword must return true for correct password against stored bcrypt hash');
    });

    await run('SoleAuthority', 'Incorrect password fails comparePassword against stored bcrypt hash', async () => {
      const adminUser = await postgresProvider.getUserByUsername(TEST_FIXTURES.user.username);
      const matches = await comparePassword('CompletelyWrongPassword_2026!', adminUser!.password_hash);
      assert(matches === false, 'comparePassword must return false for incorrect password');
    });

    await run('BypassImmunity', 'ADMIN_PASSWORD environment variable CANNOT bypass stored database bcrypt hash', async () => {
      const adminUser = await postgresProvider.getUserByUsername(TEST_FIXTURES.user.username);
      assert(adminUser !== undefined, 'Admin user must exist');

      // Set ADMIN_PASSWORD environment variable to a known rogue candidate
      const roguePassword = 'RogueAdminEnvPassword_12345!';
      process.env.ADMIN_PASSWORD = roguePassword;

      // 1. Direct comparePassword check
      const directCompare = await comparePassword(roguePassword, adminUser!.password_hash);
      assert(directCompare === false, 'comparePassword MUST NOT return true when ADMIN_PASSWORD does not match stored hash');

      // 2. HTTP POST /api/auth/login endpoint check
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUser!.username,
          password: roguePassword,
        }),
      });

      assert(res.status === 401, `Expected HTTP 401 Unauthorized for rogue env password, got ${res.status}`);
      const body = await res.json();
      assert(body.error === 'Invalid username or password', `Expected generic error message, got: ${body.error}`);
    });

    // ------------------------------------------------------------------------
    // SECTION 2: PRODUCTION STARTUP & SEEDING SAFEGUARDS
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Production Startup & Seeding Safeguards ---');

    await run('SeedingGuard', 'Pre-existing administrator is NEVER overwritten or altered during seedDatabase()', async () => {
      const adminBefore = await postgresProvider.getUserByUsername(TEST_FIXTURES.user.username);
      assert(adminBefore !== undefined, 'Admin must exist before test');

      // Attempt seeding with a conflicting ADMIN_PASSWORD and production environment set
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_PASSWORD = 'AttemptToOverwritePassword_999!';
      process.env.ADMIN_USERNAME = 'new_username_attempt';

      await seedDatabase();

      const adminAfter = await postgresProvider.getUserByUsername(TEST_FIXTURES.user.username);
      assert(adminAfter !== undefined, 'Original admin username must still exist');
      assert(adminAfter!.id === adminBefore!.id, 'User ID must remain unchanged');
      assert(adminAfter!.password_hash === adminBefore!.password_hash, 'Password bcrypt hash MUST NOT be overwritten');
      assert(adminAfter!.role === adminBefore!.role, 'User role MUST NOT be altered');

      // Verify rogue user was not created
      const rogueUser = await postgresProvider.getUserByUsername('new_username_attempt');
      assert(rogueUser === undefined, 'Seeding must not create new admin when users table is populated');
    });

    await run('BootstrapGuard', 'Production startup fails safely with clear error if admin missing and ADMIN_PASSWORD unset', async () => {
      // Create an isolated mock provider that reports 0 users
      let errorThrown: any = null;
      const emptyUserMockProvider: any = {
        getProviderName: () => 'postgres',
        getUsers: async () => [],
        getSettings: async () => ({ studio_name: 'Karsh Tech' }),
        updateSettings: async () => ({ studio_name: 'Karsh Tech' }),
        createUser: async () => { throw new Error('createUser should not be called'); },
      };

      setDatabaseProvider(emptyUserMockProvider);
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_PASSWORD;

      try {
        await seedDatabase();
      } catch (err: any) {
        errorThrown = err;
      } finally {
        setDatabaseProvider(postgresProvider);
      }

      assert(errorThrown !== null, 'seedDatabase must throw when production users table is empty and ADMIN_PASSWORD is unset');
      assert(
        errorThrown.message.includes('[SECURITY FATAL]'),
        `Error must contain [SECURITY FATAL], got: "${errorThrown.message}"`
      );
      assert(
        errorThrown.message.includes('ADMIN_PASSWORD is not configured'),
        `Error must mention ADMIN_PASSWORD is not configured, got: "${errorThrown.message}"`
      );
    });

    await run('BootstrapWhitespace', 'Pure whitespace ADMIN_PASSWORD in empty database fails safely in production', async () => {
      let errorThrown: any = null;
      const emptyUserMockProvider: any = {
        getProviderName: () => 'postgres',
        getUsers: async () => [],
        getSettings: async () => ({ studio_name: 'Karsh Tech' }),
        updateSettings: async () => ({ studio_name: 'Karsh Tech' }),
        createUser: async () => { throw new Error('createUser should not be called'); },
      };

      setDatabaseProvider(emptyUserMockProvider);
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_PASSWORD = '   \t  \n  ';

      try {
        await seedDatabase();
      } catch (err: any) {
        errorThrown = err;
      } finally {
        setDatabaseProvider(postgresProvider);
      }

      assert(errorThrown !== null, 'seedDatabase must throw when ADMIN_PASSWORD is pure whitespace');
      assert(
        errorThrown.message.includes('[SECURITY FATAL]'),
        `Error must contain [SECURITY FATAL], got: "${errorThrown.message}"`
      );
    });

    await run('BootstrapWhitespacePreservation', 'Configured bootstrap password preserves exact untrimmed whitespace', async () => {
      let createdUserRecord: any = null;
      const mockBootstrapProvider: any = {
        getProviderName: () => 'postgres',
        getUsers: async () => [],
        getSettings: async () => ({ studio_name: 'Karsh Tech' }),
        updateSettings: async () => ({ studio_name: 'Karsh Tech' }),
        createUser: async (user: any) => {
          createdUserRecord = user;
          return { id: 'usr_mock_bootstrapped_ws', created_at: new Date().toISOString(), ...user };
        },
      };

      setDatabaseProvider(mockBootstrapProvider);
      process.env.NODE_ENV = 'production';
      const exactUntrimmedPassword = '  SecretWithSpaces!2026  ';
      process.env.ADMIN_PASSWORD = exactUntrimmedPassword;
      process.env.ADMIN_USERNAME = 'untrimmed_admin';

      try {
        await seedDatabase();
      } finally {
        setDatabaseProvider(postgresProvider);
      }

      assert(createdUserRecord !== null, 'User must be created');
      // Verify exact untrimmed matches bcrypt hash
      const exactMatches = await bcrypt.compare(exactUntrimmedPassword, createdUserRecord.password_hash);
      assert(exactMatches === true, 'Exact untrimmed password must match generated bcrypt hash');

      // Verify trimmed candidate does NOT match because password was not trimmed
      const trimmedMatches = await bcrypt.compare(exactUntrimmedPassword.trim(), createdUserRecord.password_hash);
      assert(trimmedMatches === false, 'Trimmed candidate must NOT match when password had intentional spaces');
    });

    await run('RepeatedStartup', 'Repeated seedDatabase() execution creates zero duplicate administrators', async () => {
      const usersBefore = await postgresProvider.getUsers();
      const adminCountBefore = usersBefore.filter(u => u.role === 'superadmin' || u.role === 'admin').length;

      // Run seeding twice consecutively
      await seedDatabase();
      await seedDatabase();

      const usersAfter = await postgresProvider.getUsers();
      const adminCountAfter = usersAfter.filter(u => u.role === 'superadmin' || u.role === 'admin').length;

      assert(adminCountAfter === adminCountBefore, `Admin count must remain unchanged: before=${adminCountBefore}, after=${adminCountAfter}`);
      assert(usersAfter.length === usersBefore.length, `Total users must remain unchanged: before=${usersBefore.length}, after=${usersAfter.length}`);
    });

    // ------------------------------------------------------------------------
    // SECTION 3: SESSION INVALIDATION & DELETED USER DEFENSE
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Session Invalidation & Deleted User Defense ---');

    await run('DeletedUserDefense', 'Deleted or non-existent user cannot authenticate with an existing signed JWT', async () => {
      // 1. Create an ephemeral test user in the PostgreSQL test database
      const tempUsername = `temp_del_${Date.now()}`;
      const tempHash = await hashPassword('TempPassword123!');
      const createdTempUser = await postgresProvider.createUser({
        username: tempUsername,
        password_hash: tempHash,
        role: 'admin',
      });

      assert(createdTempUser.id !== undefined, 'Temporary user created');

      // 2. Generate a valid signed JWT token for this user
      const tempToken = generateToken({
        userId: createdTempUser.id,
        username: createdTempUser.username,
        role: createdTempUser.role,
      });

      // 3. Verify that the token currently grants access
      const accessResBefore = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert(accessResBefore.status === 200, `Expected 200 for active user, got ${accessResBefore.status}`);

      // 4. Delete the temporary user directly from the PostgreSQL test database
      await (postgresProvider as any).pool.query('DELETE FROM users WHERE id = $1', [createdTempUser.id]);

      // 5. Present the exact same token again
      const accessResAfter = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });

      assert(
        accessResAfter.status === 401,
        `Expected HTTP 401 for deleted user with valid JWT, got ${accessResAfter.status}`
      );
      const afterBody = await accessResAfter.json();
      assert(
        afterBody.error === 'Unauthorized: User not found or account deactivated',
        `Expected deactivation error, got: "${afterBody.error}"`
      );
    });

    // ------------------------------------------------------------------------
    // SECTION 4: COMPLETE AUTHENTICATION WORKFLOW INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Complete Authentication Workflow Integrity ---');

    let sessionToken = '';
    let sessionCookie = '';

    await run('AuthWorkflows', 'Valid login returns JWT and HttpOnly session cookie', async () => {
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
      assert(body.success === true, 'Login response indicated success');
      assert(typeof body.token === 'string' && body.token.length > 30, 'Valid JWT token returned');
      sessionToken = body.token;

      const setCookie = res.headers.get('set-cookie') || '';
      assert(setCookie.includes(COOKIE_NAME), 'Set-Cookie contains session cookie');
      assert(setCookie.toLowerCase().includes('httponly'), 'Cookie is HttpOnly');
      sessionCookie = setCookie.split(';')[0];
    });

    await run('AuthWorkflows', 'Protected route /api/admin/stats accessible via session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/admin/stats`, {
        headers: { Cookie: sessionCookie },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.stats !== undefined, 'Stats object returned');
    });

    await run('AuthWorkflows', 'Protected route /api/admin/stats accessible via Authorization Bearer header', async () => {
      const res = await fetch(`${baseUrl}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.stats !== undefined, 'Stats object returned');
    });

    await run('AuthWorkflows', 'POST /api/auth/logout successfully clears session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const setCookie = res.headers.get('set-cookie') || '';
      assert(
        setCookie.toLowerCase().includes('expires=') ||
        setCookie.includes('Max-Age=0') ||
        setCookie.includes(`${COOKIE_NAME}=;`),
        `Set-Cookie header expires session cookie: got "${setCookie}"`
      );
    });

  } finally {
    // Restore environment variables
    if (originalAdminPasswordEnv !== undefined) {
      process.env.ADMIN_PASSWORD = originalAdminPasswordEnv;
    } else {
      delete process.env.ADMIN_PASSWORD;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`PHASE 4.3.5.2 AUTHENTICATION SECURITY HARDENING SUMMARY`);
  console.log(`Total: ${reports.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  return reports;
}

// Allow direct execution
const isDirectEntry = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('test_auth_security_hardening.ts') ||
   process.argv[1].endsWith('test_auth_security_hardening.js'))
);

if (isDirectEntry) {
  runAuthSecurityHardeningTests().then((reports) => {
    const failed = reports.filter((r) => !r.passed).length;
    if (failed > 0) process.exit(1);
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
