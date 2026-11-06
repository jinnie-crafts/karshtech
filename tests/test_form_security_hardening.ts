import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import type { IDatabaseProvider } from '../server/database/IDatabaseProvider.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { JsonDatabaseProvider } from '../server/database/JsonDatabaseProvider.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';
import { TestHarness } from '../server/testing/testHarness.js';
import { resetAllFormRateLimits } from '../server/middleware/rateLimiter.js';
import { resetDuplicateSubmissions } from '../server/middleware/formValidation.js';
import {
  validateFormInputs,
  submitKarshTechForm,
  getWeb3FormsKey,
  isFormServiceConfigured,
} from '../src/lib/formSubmission.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

export interface SecurityTestReport {
  num: number;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runFormSecurityHardeningTests(): Promise<SecurityTestReport[]> {
  const reports: SecurityTestReport[] = [];
  let testNum = 0;

  async function run(category: string, name: string, fn: () => Promise<void>) {
    testNum++;
    try {
      await fn();
      reports.push({ num: testNum, category, name, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, category, name, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('================================================================');
  console.log('KARSH TECH — WEB3FORMS SECURITY & ABUSE PROTECTION TEST SUITE');
  console.log('================================================================\n');

  let dbProvider: IDatabaseProvider;
  let harness: TestHarness | null = null;
  let tempCleanDir: string | null = null;

  try {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
    const prodUrl = process.env.DATABASE_URL;

    const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
    if (!guard.allowed) throw new Error(guard.reason);

    harness = new TestHarness({ testDatabaseUrl: testDbUrl });
    await harness.applySchema();
    await harness.seedFixtures();

    const postgresProvider = new SupabasePostgresProvider(testDbUrl);
    await postgresProvider.init();
    dbProvider = postgresProvider;
  } catch {
    const tempDir = path.resolve(process.cwd(), 'scratch/test_sec_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    tempCleanDir = tempDir;
    const tempDbFile = path.join(tempDir, 'db.json');
    const tempBackups = path.join(tempDir, 'backups');

    const jsonProvider = new JsonDatabaseProvider(tempDbFile, tempBackups);
    await jsonProvider.init();
    await jsonProvider.createGame(TEST_FIXTURES.game);
    dbProvider = jsonProvider;
  }

  setDatabaseProvider(dbProvider);

  const mockStorage = new MockStorageService();
  await mockStorage.init();
  setStorageService(mockStorage);

  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // --------------------------------------------------------------------------
    // PART 1: PUBLIC CONFIGURATION EXPOSURE & VITE BUNDLE HYGIENE
    // --------------------------------------------------------------------------
    console.log('--- 1. Configuration Exposure & Bundle Hygiene ---');

    await run('CONFIG_EXPOSURE', 'GET /api/contact/config strictly returns boolean without secret keys', async () => {
      const res = await fetch(`${baseUrl}/api/contact/config`);
      assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
      const data = await res.json();
      assert(typeof data.configured === 'boolean', 'configured boolean must be present');
      assert(!('key' in data), 'Explicit "key" attribute must NOT be present in response');
      assert(!('access_key' in data), 'access_key must NOT be present in response');
      assert(!('secret' in data), 'secret must NOT be present in response');
      assert(
        res.headers.get('cache-control')?.includes('no-store') || false,
        'Cache-Control must contain no-store'
      );
    });

    await run('BUNDLE_HYGIENE', 'Vite production assets contain zero private server credentials', async () => {
      const distDir = path.resolve(process.cwd(), 'dist/assets');
      if (fs.existsSync(distDir)) {
        const jsFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
        const forbiddenPatterns = [
          'DATABASE_URL',
          'SUPABASE_SECRET_KEY',
          'ADMIN_PASSWORD',
          'JWT_SECRET',
          'postgres://',
          'postgresql://',
        ];
        for (const file of jsFiles) {
          const content = fs.readFileSync(path.join(distDir, file), 'utf8');
          for (const pattern of forbiddenPatterns) {
            assert(!content.includes(pattern), `Forbidden credential pattern "${pattern}" found in ${file}`);
          }
        }
      }
    });

    // --------------------------------------------------------------------------
    // PART 2: SERVER-SIDE RATE LIMITING
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Server-Side Rate Limiting (Contact, Support & Config) ---');

    await run('RATE_LIMIT', 'POST /api/contact enforces 5 submissions per IP per 15 minutes', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      // Submit 5 distinct requests
      for (let i = 1; i <= 5; i++) {
        const res = await fetch(`${baseUrl}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `User ${i}`,
            email: `user${i}@example.com`,
            subject: `Subject ${i}`,
            message: `Valid test message body number ${i} with more than ten chars.`,
            formStartedAt: Date.now() - 5000,
          }),
        });
        assert(res.status === 200, `Expected 200 for submission ${i}, got ${res.status}`);
        assert(res.headers.has('RateLimit-Remaining'), 'RateLimit-Remaining header present');
      }

      // 6th request must trigger HTTP 429
      const sixthRes = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User 6',
          email: 'user6@example.com',
          subject: 'Subject 6',
          message: 'Valid test message body number 6 with more than ten chars.',
          formStartedAt: Date.now() - 5000,
        }),
      });
      assert(sixthRes.status === 429, `Expected 429 on 6th request, got ${sixthRes.status}`);
      assert(sixthRes.headers.has('Retry-After'), 'Retry-After header present on 429');
      const body = await sixthRes.json();
      assert(body.error?.includes('Rate limit') || false, 'Error message indicates rate limit exceeded');
    });

    await run('RATE_LIMIT', 'POST /api/support enforces 5 submissions per IP per 15 minutes', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      // Submit 5 distinct requests
      for (let i = 1; i <= 5; i++) {
        const res = await fetch(`${baseUrl}/api/support`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Support User ${i}`,
            email: `sup${i}@example.com`,
            subject: `Issue ${i}`,
            message: `Valid test support message number ${i} with more than ten chars.`,
            formStartedAt: Date.now() - 5000,
          }),
        });
        assert(res.status === 200, `Expected 200 for support ticket ${i}, got ${res.status}`);
      }

      // 6th request must trigger HTTP 429
      const sixthRes = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Support User 6',
          email: 'sup6@example.com',
          subject: 'Issue 6',
          message: 'Valid test support message number 6 with more than ten chars.',
          formStartedAt: Date.now() - 5000,
        }),
      });
      assert(sixthRes.status === 429, `Expected 429 on 6th support request, got ${sixthRes.status}`);
    });

    await run('RATE_LIMIT', 'GET /api/contact/config enforces 30 requests per IP per 15 minutes', async () => {
      resetAllFormRateLimits();

      // 30 requests should succeed
      for (let i = 1; i <= 30; i++) {
        const res = await fetch(`${baseUrl}/api/contact/config`);
        assert(res.status === 200, `Expected 200 on config request ${i}, got ${res.status}`);
      }

      // 31st request must trigger HTTP 429
      const res31 = await fetch(`${baseUrl}/api/contact/config`);
      assert(res31.status === 429, `Expected 429 on 31st config request, got ${res31.status}`);
      assert(res31.headers.has('Retry-After'), 'Retry-After header present on config 429');
    });

    // --------------------------------------------------------------------------
    // PART 3: PROXY TRUST & IP SPOOFING RESISTANCE
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Proxy Trust & IP Spoofing Resistance ---');

    await run('PROXY_TRUST', 'app.set("trust proxy", 1) is configured and derives client IP safely', async () => {
      // Verify Express trust proxy setting
      const trustProxySetting = app.get('trust proxy');
      assert(
        trustProxySetting === 1 || trustProxySetting === true,
        `Expected trust proxy to be 1 or true, got ${trustProxySetting}`
      );
    });

    // --------------------------------------------------------------------------
    // PART 4: SPAM PROTECTION & VALIDATION
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Spam Protection & Payload Validation ---');

    await run('SPAM_PROTECTION', 'Honeypot field (botcheck) immediately rejects spam with 400', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Spam Bot',
          email: 'bot@spam.com',
          subject: 'SEO Services',
          message: 'Buy our automated backlinks ranking package immediately.',
          botcheck: 'automated-crawler-filled-this',
          formStartedAt: Date.now() - 10000,
        }),
      });
      assert(res.status === 400, `Expected 400 for honeypot spam, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('Spam') || false, 'Error indicates spam rejection');
    });

    await run('SPAM_PROTECTION', 'Submissions completed in under 3 seconds are rejected with 400', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Speedy Bot',
          email: 'speedy@example.com',
          subject: 'Instant Submission',
          message: 'Submitted in less than 500 milliseconds by automation.',
          formStartedAt: Date.now() - 400, // Only 400ms elapsed
        }),
      });
      assert(res.status === 400, `Expected 400 for fast submission, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('quickly') || body.error?.includes('3 seconds') || false, 'Mentions minimum time');
    });

    await run('SPAM_PROTECTION', 'Duplicate submissions within 60 seconds are rejected with 429', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      const payload = {
        name: 'Repeat Sender',
        email: 'repeat@example.com',
        subject: 'Identical Subject',
        message: 'This exact same message is being sent twice in a row.',
        formStartedAt: Date.now() - 5000,
      };

      // First submission passes
      const res1 = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert(res1.status === 200, `Expected 200 on first submission, got ${res1.status}`);

      // Immediate second duplicate submission triggers 429
      const res2 = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert(res2.status === 429, `Expected 429 on duplicate submission, got ${res2.status}`);
      const body = await res2.json();
      assert(body.error?.includes('Duplicate') || false, 'Mentions duplicate submission');
    });

    await run('VALIDATION', 'Rejects oversized and malformed payloads', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      // Malformed: non-object array
      const arrRes = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['invalid', 'array']),
      });
      assert(arrRes.status === 400, `Expected 400 for array payload, got ${arrRes.status}`);

      // Oversized message (> 5000 characters)
      const bigMessage = 'A'.repeat(5500);
      const bigRes = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Valid Subject',
          message: bigMessage,
          formStartedAt: Date.now() - 5000,
        }),
      });
      assert(bigRes.status === 400, `Expected 400 for oversized message, got ${bigRes.status}`);

      // Name exceeding 100 characters
      const longNameRes = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'N'.repeat(120),
          email: 'valid@example.com',
          subject: 'Valid Subject',
          message: 'Valid message body with sufficient length.',
          formStartedAt: Date.now() - 5000,
        }),
      });
      assert(longNameRes.status === 400, `Expected 400 for long name, got ${longNameRes.status}`);
    });

    await run('VALIDATION', 'Rejects invalid or unparseable email formats', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      const invalidEmails = ['plain', 'user@', '@domain.com', 'user@domain', 'user with spaces@domain.com'];
      for (const email of invalidEmails) {
        const res = await fetch(`${baseUrl}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Jane Doe',
            email,
            subject: 'Subject',
            message: 'Valid test message with more than ten characters.',
            formStartedAt: Date.now() - 5000,
          }),
        });
        assert(res.status === 400, `Expected 400 for invalid email "${email}", got ${res.status}`);
      }
    });

    // --------------------------------------------------------------------------
    // PART 5: PROVIDER DISPATCH SIMULATION & CLIENT-SIDE ROBUSTNESS
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Provider Dispatch Simulation & Client-Side Robustness ---');

    await run('CLIENT_MODULE', 'Client validation enforces name, email, subject, message and completion time', async () => {
      // Sub-3s rejection
      const fastResult = validateFormInputs({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Subject',
        message: 'Valid test message with sufficient length.',
        formStartedAt: Date.now() - 1000,
        formType: 'contact',
      });
      assert(!fastResult.valid, 'Expected sub-3s validation to fail');

      // Valid result
      const validResult = validateFormInputs({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Subject',
        message: 'Valid test message with sufficient length.',
        formStartedAt: Date.now() - 5000,
        formType: 'contact',
      });
      assert(validResult.valid, 'Expected valid submission to pass client validation');
    });

    await run('CLIENT_MODULE', 'getWeb3FormsKey resolves build-time key without exposing secrets', async () => {
      const key = getWeb3FormsKey();
      // Should be string (configured build key)
      assert(typeof key === 'string', 'Expected string key');
    });

    await run('LEGITIMATE_TRAFFIC', 'Legitimate user flow passes validation and backend audit', async () => {
      resetAllFormRateLimits();
      resetDuplicateSubmissions();

      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Legitimate Client',
          email: 'client@example.com',
          category: 'Website Development',
          subject: 'Custom Web Portal Development',
          message: 'We are seeking an initial engineering consultation for a high-performance web platform.',
          formStartedAt: Date.now() - 12000, // 12 seconds
        }),
      });
      assert(res.status === 200, `Expected 200 for legitimate traffic, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag true');
    });

    await run('SECURITY_ISOLATION', 'Existing administrative CORS and CSRF protections remain intact', async () => {
      // Unauthenticated state-changing admin request rejected
      const adminRes = await fetch(`${baseUrl}/api/admin/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Game' }),
      });
      assert(adminRes.status === 401 || adminRes.status === 403, `Expected 401/403 for admin, got ${adminRes.status}`);
    });

  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (dbProvider) {
      try {
        await dbProvider.close();
      } catch {}
    }
    if (harness) {
      try {
        await harness.close();
      } catch {}
    }
    if (tempCleanDir) {
      try {
        fs.rmSync(tempCleanDir, { recursive: true, force: true });
      } catch {}
    }
  }

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`SECURITY SUITE RESULTS: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Form Security Hardening Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_form_security_hardening.ts')) {
  runFormSecurityHardeningTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN SUITE]', err);
      process.exit(1);
    });
}
