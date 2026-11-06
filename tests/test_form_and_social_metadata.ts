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
import { MediaService } from '../server/services/MediaService.js';
import { MetadataService } from '../server/services/MetadataService.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';
import { TestHarness } from '../server/testing/testHarness.js';
import { validateFormInputs, submitKarshTechForm, getWeb3FormsKey } from '../src/lib/formSubmission.js';

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

export async function runFormAndSocialMetadataTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — FORM RELIABILITY & DYNAMIC SOCIAL METADATA SUITE');
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
    const tempDir = path.resolve(process.cwd(), 'scratch/test_metadata_' + Date.now());
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

  const mediaService = new MediaService(mockStorage, dbProvider);
  const metadataService = new MetadataService(dbProvider, mediaService);

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
    // PART 1: FORM INPUT VALIDATION & SUBMISSION INTEGRITY
    // --------------------------------------------------------------------------
    console.log('--- 1. Form Input Validation & Spam Protection ---');

    await run('VALIDATION', 'Rejects empty or single-character sender name', async () => {
      const res = validateFormInputs({
        name: 'A',
        email: 'test@example.com',
        subject: 'General Inquiry',
        message: 'This is a test inquiry message with more than ten chars.',
        formType: 'contact',
      });
      assert(!res.valid, 'Expected invalid name to fail');
      assert(res.error?.includes('full name') || false, 'Error message mentions name');
    });

    await run('VALIDATION', 'Rejects malformed email addresses', async () => {
      const invalidEmails = ['plain', 'user@', '@domain.com', 'user@domain'];
      for (const email of invalidEmails) {
        const res = validateFormInputs({
          name: 'Jane Doe',
          email,
          subject: 'Valid Subject',
          message: 'This is a test inquiry message with more than ten chars.',
          formType: 'contact',
        });
        assert(!res.valid, `Expected invalid email ${email} to fail`);
      }
    });

    await run('VALIDATION', 'Rejects message shorter than 10 characters', async () => {
      const res = validateFormInputs({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Valid Subject',
        message: 'Too short',
        formType: 'contact',
      });
      assert(!res.valid, 'Expected short message to fail');
      assert(res.error?.includes('10 characters') || false, 'Error message mentions 10 characters');
    });

    await run('ANTI_SPAM', 'Honeypot field (botcheck) rejects spam bots silently', async () => {
      const res = validateFormInputs({
        name: 'Spam Bot',
        email: 'spambot@example.com',
        subject: 'SEO Marketing Offer',
        message: 'Buy our automated backlinks service immediately.',
        botcheck: 'automated-bot-content',
        formType: 'contact',
      });
      assert(!res.valid, 'Expected honeypot to fail');
      assert(res.error?.includes('Spam detection') || false, 'Spam error message returned');
    });

    await run('VALIDATION', 'Accepts valid submission payload', async () => {
      const res = validateFormInputs({
        name: 'Jane Doe',
        email: 'jane@example.com',
        category: 'Website Development',
        subject: 'New Project Consultation',
        message: 'We are looking to develop a custom web application platform.',
        formType: 'contact',
      });
      assert(res.valid, 'Valid payload accepted');
    });

    // --------------------------------------------------------------------------
    // PART 2: BACKEND CONTACT & CONFIG ENDPOINTS
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Backend Config & Audit Endpoints ---');

    await run('BACKEND_API', 'GET /api/contact/config returns JSON with configured status', async () => {
      const res = await fetch(`${baseUrl}/api/contact/config`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(typeof data.configured === 'boolean', 'configured boolean present');
    });

    await run('BACKEND_API', 'POST /api/contact logs valid transmission to server audit trail', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Audit Test User',
          email: 'audit@example.com',
          category: 'Mobile Application Development',
          subject: 'Android APK Inquiry',
          message: 'Testing server-side contact audit logging mechanism.',
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Success flag true in response');
    });

    await run('BACKEND_API', 'POST /api/support logs valid ticket to server audit trail', async () => {
      const res = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Support Ticket User',
          email: 'supportuser@example.com',
          game: 'Arrow Puzzle',
          subject: 'APK Installation Assistance',
          message: 'Assistance requested with Android 15 permissions dialog.',
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Support ticket logged');
    });

    await run('BACKEND_API', 'POST /api/contact rejects missing required fields with 400', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incomplete' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await run('BACKEND_API', 'POST /api/contact rejects honeypot spam bot with 400', async () => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Spam Bot',
          email: 'bot@spam.com',
          message: 'Spam message payload',
          botcheck: 'i-am-a-bot',
        }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // --------------------------------------------------------------------------
    // PART 3: DYNAMIC SOCIAL METADATA INJECTION
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Dynamic Server-Side HTML Metadata Injection ---');

    await run('METADATA', 'GET / returns raw HTML with Homepage Open Graph metadata', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('<title>Karsh Tech — Technology &amp; Digital Product Development Organization</title>') ||
             html.includes('<title>Karsh Tech — Technology & Digital Product Development Organization</title>'),
             'Title tag contains Homepage title');
      assert(html.includes('property="og:title"'), 'og:title tag present');
      assert(html.includes('property="og:description"'), 'og:description tag present');
      assert(html.includes('property="og:image" content="https://tech.aadirishi.in/brand/karsh-tech-full.png"'), 'og:image contains full brand logo');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/"'), 'Canonical URL points to homepage');
      assert(html.includes('name="twitter:card" content="summary_large_image"'), 'Twitter card is summary_large_image');
    });

    await run('METADATA', 'GET /products returns raw HTML with Products catalog metadata', async () => {
      const res = await fetch(`${baseUrl}/products`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Products &amp; Digital Solutions — Karsh Tech') ||
             html.includes('Products & Digital Solutions — Karsh Tech'),
             'Title tag contains Products title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/products"'), 'Canonical URL points to /products');
    });

    await run('METADATA', 'GET /games returns raw HTML with Games catalog metadata', async () => {
      const res = await fetch(`${baseUrl}/games`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Games &amp; Interactive Experiences — Karsh Tech') ||
             html.includes('Games & Interactive Experiences — Karsh Tech'),
             'Title tag contains Games title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/games"'), 'Canonical URL points to /games');
    });

    await run('METADATA', 'GET /games/test-space-odyssey returns dynamic game title and cover image', async () => {
      const res = await fetch(`${baseUrl}/games/test-space-odyssey`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Test Space Odyssey — Official Game by Karsh Tech'), 'Title tag contains dynamic game title');
      assert(html.includes('property="og:title" content="Test Space Odyssey — Official Game by Karsh Tech"'), 'og:title contains dynamic title');
      assert(html.includes('https://mock-storage.local/game-assets/test_cover.jpg'), 'og:image contains canonical cover URL');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/games/test-space-odyssey"'), 'Canonical URL points to game slug');
    });

    await run('METADATA', 'GET /games/space-odyssey (alias) fuzzy matches game and normalizes canonical URL', async () => {
      const res = await fetch(`${baseUrl}/games/space-odyssey`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Test Space Odyssey — Official Game by Karsh Tech'), 'Title tag contains dynamic game title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/games/test-space-odyssey"'), 'Canonical points to canonical slug');
    });

    await run('METADATA', 'GET /services returns Services engineering metadata', async () => {
      const res = await fetch(`${baseUrl}/services`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Engineering &amp; Development Services — Karsh Tech') ||
             html.includes('Engineering & Development Services — Karsh Tech'),
             'Title tag contains Services title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/services"'), 'Canonical URL points to /services');
    });

    await run('METADATA', 'GET /studio returns Studio team philosophy metadata', async () => {
      const res = await fetch(`${baseUrl}/studio`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Engineering Team &amp; Studio Philosophy — Karsh Tech') ||
             html.includes('Engineering Team & Studio Philosophy — Karsh Tech'),
             'Title tag contains Studio title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/studio"'), 'Canonical URL points to /studio');
    });

    await run('METADATA', 'GET /contact returns Contact consultation metadata', async () => {
      const res = await fetch(`${baseUrl}/contact`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Contact &amp; Technical Consultation — Karsh Tech') ||
             html.includes('Contact & Technical Consultation — Karsh Tech'),
             'Title tag contains Contact title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/contact"'), 'Canonical URL points to /contact');
    });

    await run('METADATA', 'GET /support returns Support assistance metadata', async () => {
      const res = await fetch(`${baseUrl}/support`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Support &amp; Technical Assistance — Karsh Tech') ||
             html.includes('Support & Technical Assistance — Karsh Tech'),
             'Title tag contains Support title');
      assert(html.includes('rel="canonical" href="https://tech.aadirishi.in/support"'), 'Canonical URL points to /support');
    });

    await run('METADATA', 'Unknown route returns fallback metadata with noindex', async () => {
      const res = await fetch(`${baseUrl}/random-unknown-page-route`);
      assert(res.status === 200, `Expected 200 HTML shell, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('Page Not Found — Karsh Tech'), 'Title tag has Page Not Found');
      assert(html.includes('name="robots" content="noindex, nofollow"'), 'Robots tag has noindex');
    });

    await run('METADATA', 'Admin route returns noindex, nofollow metadata', async () => {
      const res = await fetch(`${baseUrl}/admin/media`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const html = await res.text();

      assert(html.includes('name="robots" content="noindex, nofollow"'), 'Robots tag has noindex on admin');
    });

    // --------------------------------------------------------------------------
    // PART 4: CRAWLER USER-AGENT PARITY
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Crawler User-Agent Parity ---');

    const crawlers = [
      { name: 'WhatsApp', ua: 'WhatsApp/2.21.12.21 i' },
      { name: 'Facebook', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      { name: 'Twitter/X', ua: 'Twitterbot/1.0' },
      { name: 'LinkedIn', ua: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)' },
      { name: 'Discord', ua: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
    ];

    for (const c of crawlers) {
      await run('CRAWLER_PARITY', `${c.name} crawler receives raw HTML with page-specific OG tags`, async () => {
        const res = await fetch(`${baseUrl}/games/test-space-odyssey`, {
          headers: { 'User-Agent': c.ua },
        });
        assert(res.status === 200, `${c.name} received HTTP 200`);
        const html = await res.text();
        assert(html.includes('Test Space Odyssey — Official Game by Karsh Tech'), `${c.name} received game title`);
        assert(html.includes('property="og:image"'), `${c.name} received og:image`);
      });
    }

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
  console.log(`SUITE RESULTS: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Form & Social Metadata Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_form_and_social_metadata.ts')) {
  runFormAndSocialMetadataTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN SUITE]', err);
      process.exit(1);
    });
}
