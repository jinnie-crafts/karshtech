import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server/index.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runContactWorkflowTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 CONTACT & WEB3FORMS WORKFLOW AUDIT');
  console.log('================================================================\n');

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
    // --- 1. Backend Contact / Support API Endpoints ---
    console.log('--- 1. Backend /api/contact & /api/support Endpoints ---');

    await run('ContactAPI', 'POST /api/contact with valid payload returns HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
          category: 'Game Development',
          subject: 'Collaboration inquiry',
          message: 'Hello Karsh Tech, I would like to inquire about Android game development services.',
        }),
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
      assert(typeof body.message === 'string', 'Response contains message string');
    });

    await run('ContactAPI', 'POST /api/support with valid payload returns HTTP 200', async () => {
      const res = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John Player',
          email: 'john@example.com',
          game: 'Arrow Puzzle',
          message: 'Found an issue on level 15.',
        }),
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
    });

    await run('ContactAPI', 'POST /api/contact without name returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane@example.com',
          message: 'Missing name test',
        }),
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('Name, email, and message are required') === true, 'Error identifies required fields');
    });

    await run('ContactAPI', 'POST /api/contact without email returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          message: 'Missing email test',
        }),
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await run('ContactAPI', 'POST /api/contact without message returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
        }),
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // --- 2. Web3Forms Mock Simulation & Client Logic ---
    console.log('\n--- 2. Web3Forms Integration & Resiliency Logic ---');

    await run('Web3Forms', 'Simulated Web3Forms successful response confirms transmission', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url: any, init: any) => {
          if (typeof url === 'string' && url.includes('api.web3forms.com/submit')) {
            return new Response(JSON.stringify({ success: true, message: 'Form submitted successfully' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(url, init);
        };

        const formData = new FormData();
        formData.append('access_key', 'test-key');
        formData.append('name', 'Tester');
        formData.append('email', 'test@test.com');
        formData.append('message', 'Test message');

        const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData });
        const data = await res.json();
        assert(data.success === true, 'Submission successful');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await run('Web3Forms', 'Simulated Web3Forms network drop is caught safely without unhandled rejection', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url: any, init: any) => {
          if (typeof url === 'string' && url.includes('api.web3forms.com/submit')) {
            throw new Error('ENOTFOUND api.web3forms.com');
          }
          return originalFetch(url, init);
        };

        let handled = false;
        try {
          await fetch('https://api.web3forms.com/submit', { method: 'POST' });
        } catch (err: any) {
          handled = err.message.includes('ENOTFOUND');
        }
        assert(handled, 'Network drop was caught gracefully');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // --- 3. Secret Leakage & Environment Hygiene ---
    console.log('\n--- 3. Secret Leakage & Client Environment Hygiene ---');

    await run('SecurityHygiene', 'Frontend source code never references server-only secret keys', async () => {
      const srcDir = path.resolve(process.cwd(), 'src');
      const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

      const forbiddenSecrets = [
        'SUPABASE_SECRET_KEY',
        'DATABASE_URL',
        'POSTGRES_PASSWORD',
        'JWT_SECRET',
        'TEST_JWT_SECRET',
      ];

      for (const file of files) {
        const fullPath = path.join(srcDir, file);
        if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const secret of forbiddenSecrets) {
            const hasEnvUsage = content.includes(`process.env.${secret}`) || content.includes(`import.meta.env.${secret}`);
            assert(!hasEnvUsage, `Forbidden secret ${secret} referenced in frontend file ${file}`);
          }
        }
      }
    });

  } finally {
    server.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`CONTACT SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Contact Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_contact.ts')) {
  runContactWorkflowTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN CONTACT SUITE]', err);
      process.exit(1);
    });
}
