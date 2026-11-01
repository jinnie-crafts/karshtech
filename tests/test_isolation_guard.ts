import {
  validateTestDatabaseUrl,
  assertTestDatabaseIsolation,
  KNOWN_PRODUCTION_IDENTIFIERS,
} from '../server/testing/testDatabaseGuard.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runIsolationSuite(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  function assert(condition: boolean, message: string) {
    testNum++;
    if (condition) {
      reports.push({ num: testNum, name: message, category: 'Isolation Guard', passed: true });
      console.log(`  ✓ ${message}`);
    } else {
      reports.push({ num: testNum, name: message, category: 'Isolation Guard', passed: false, error: message });
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  console.log('=== PHASE 4.3.1 TEST ENVIRONMENT ISOLATION & GUARD VERIFICATION ===\n');

  // --------------------------------------------------------------------------
  // 1. FAIL-CLOSED DATABASE GUARD TESTS
  // --------------------------------------------------------------------------
  console.log('--- 1. Database Guard URL Validation ---');

  // Empty / undefined URL
  const emptyRes = validateTestDatabaseUrl('');
  assert(!emptyRes.allowed, 'Rejects empty connection string');

  // Production URL match
  const mockProdUrl = 'postgresql://postgres.dqdgotivffhvtpwjqlsf:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  const prodMatchRes = validateTestDatabaseUrl(mockProdUrl, mockProdUrl);
  assert(!prodMatchRes.allowed, 'Rejects candidate URL identical to production DATABASE_URL');
  assert(prodMatchRes.reason?.includes('IDENTICAL') === true, 'Reason identifies identical URL conflict');

  // Rejection of production project identifier in candidate
  for (const prodId of KNOWN_PRODUCTION_IDENTIFIERS) {
    const candidateWithId = `postgresql://user:pass@somehost.com:5432/db_${prodId}`;
    const idRes = validateTestDatabaseUrl(candidateWithId);
    assert(!idRes.allowed, `Rejects candidate containing production identifier "${prodId}"`);
    assert(idRes.reason?.includes('production identifier') === true, `Reason mentions production identifier "${prodId}"`);
  }

  // Acceptance of safe isolated local URL
  const safeLocalUrl = 'postgresql://postgres:postgres@localhost:5432/karsh_tech_test';
  const safeRes = validateTestDatabaseUrl(safeLocalUrl, mockProdUrl);
  assert(safeRes.allowed, 'Accepts safe isolated local database URL (localhost:5432/karsh_tech_test)');
  assert(safeRes.databaseName === 'karsh_tech_test', 'Extracts correct test database name');

  // Acceptance of safe isolated Docker / 127.0.0.1 URL
  const dockerUrl = 'postgresql://karsh_test_user:test_pass@127.0.0.1:5433/karsh_tech_test';
  const dockerRes = validateTestDatabaseUrl(dockerUrl, mockProdUrl, true);
  assert(dockerRes.allowed, 'Accepts safe isolated Docker database URL (127.0.0.1:5433/karsh_tech_test)');
  assert(dockerRes.databaseName === 'karsh_tech_test', 'Extracts isolated database name');
  assert(dockerRes.databaseUser === 'karsh_test_user', 'Extracts isolated user');

  // Strict Docker Mode: Rejection of wrong port
  const wrongPortUrl = 'postgresql://karsh_test_user:test_pass@127.0.0.1:5432/karsh_tech_test';
  const wrongPortRes = validateTestDatabaseUrl(wrongPortUrl, mockProdUrl, true);
  assert(!wrongPortRes.allowed, 'Strict Docker mode rejects non-5433 port');

  // Strict Docker Mode: Rejection of wrong database name
  const wrongDbUrl = 'postgresql://karsh_test_user:test_pass@127.0.0.1:5433/production_clone';
  const wrongDbRes = validateTestDatabaseUrl(wrongDbUrl, mockProdUrl, true);
  assert(!wrongDbRes.allowed, 'Strict Docker mode rejects non-karsh_tech_test database');

  // Strict Docker Mode: Rejection of wrong user
  const wrongUserUrl = 'postgresql://postgres:test_pass@127.0.0.1:5433/karsh_tech_test';
  const wrongUserRes = validateTestDatabaseUrl(wrongUserUrl, mockProdUrl, true);
  assert(!wrongUserRes.allowed, 'Strict Docker mode rejects non-karsh_test_user user');

  // --------------------------------------------------------------------------
  // 2. RUNTIME ASSERTION & WRITE AUTHORIZATION GUARD
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Runtime Write Authorization Guard ---');

  // Simulate missing ALLOW_TEST_DATABASE_WRITES
  delete process.env.ALLOW_TEST_DATABASE_WRITES;
  let rejectedWithoutFlag = false;
  try {
    const dummyClient = { query: async () => ({ rows: [] }) } as any;
    await assertTestDatabaseIsolation(dummyClient);
  } catch (err: any) {
    rejectedWithoutFlag = true;
    assert(err.message.includes('ALLOW_TEST_DATABASE_WRITES'), 'Fails closed when ALLOW_TEST_DATABASE_WRITES is missing');
  }
  assert(rejectedWithoutFlag, 'assertTestDatabaseIsolation throws error without explicit write flag');

  // With write authorization flag but connected to production-like identity
  process.env.ALLOW_TEST_DATABASE_WRITES = 'true';
  let rejectedProdSession = false;
  try {
    const fakeProdClient = {
      query: async () => ({
        rows: [{ db_name: 'postgres', server_addr: '1.2.3.4', user_name: 'postgres.dqdgotivffhvtpwjqlsf' }],
      }),
    } as any;
    await assertTestDatabaseIsolation(fakeProdClient);
  } catch (err: any) {
    rejectedProdSession = true;
    assert(err.message.includes('production identifier'), 'Fails closed when session user contains production identifier');
  }
  assert(rejectedProdSession, 'Runtime guard halts execution if connected to production session user');

  // Safe runtime session check
  const fakeSafeClient = {
    query: async () => ({
      rows: [{ db_name: 'karsh_tech_test', server_addr: '127.0.0.1', user_name: 'karsh_test_user' }],
    }),
  } as any;
  const runtimeSafeRes = await assertTestDatabaseIsolation(fakeSafeClient, { strictDockerMode: true });
  assert(runtimeSafeRes.currentDatabase === 'karsh_tech_test', 'Runtime guard accepts clean isolated test session in strict Docker mode');

  // Test marker check: missing marker throws error
  let missingMarkerRejected = false;
  try {
    const clientWithoutMarker = {
      query: async (sql: string) => {
        if (sql.includes('information_schema.tables')) return { rows: [{ has_marker: false }] };
        return { rows: [{ db_name: 'karsh_tech_test', user_name: 'karsh_test_user' }] };
      },
    } as any;
    await assertTestDatabaseIsolation(clientWithoutMarker, { requireMarker: true, strictDockerMode: true });
  } catch (err: any) {
    missingMarkerRejected = true;
    assert(err.message.includes('_test_environment_marker'), 'Fails closed when test environment marker table is missing');
  }
  assert(missingMarkerRejected, 'Marker guard rejects unmarked database');

  // Test marker value check: unexpected marker value throws error
  let mismatchedMarkerRejected = false;
  try {
    const clientWithMismatch = {
      query: async (sql: string) => {
        if (sql.includes('information_schema.tables')) return { rows: [{ has_marker: true }] };
        if (sql.includes('FROM _test_environment_marker')) return { rows: [{ environment: 'wrong_marker_val' }] };
        return { rows: [{ db_name: 'karsh_tech_test', user_name: 'karsh_test_user' }] };
      },
    } as any;
    await assertTestDatabaseIsolation(clientWithMismatch, { requireMarker: true, strictDockerMode: true });
  } catch (err: any) {
    mismatchedMarkerRejected = true;
    assert(err.message.includes('marker value mismatch'), 'Fails closed when test environment marker value is unexpected');
  }
  assert(mismatchedMarkerRejected, 'Marker guard rejects unexpected marker value');

  // Test marker check: verified exact marker accepted
  const clientWithMarker = {
    query: async (sql: string) => {
      if (sql.includes('information_schema.tables')) return { rows: [{ has_marker: true }] };
      if (sql.includes('FROM _test_environment_marker')) return { rows: [{ environment: 'karsh-tech-local-docker-test' }] };
      return { rows: [{ db_name: 'karsh_tech_test', user_name: 'karsh_test_user' }] };
    },
  } as any;
  const markerPassRes = await assertTestDatabaseIsolation(clientWithMarker, { requireMarker: true, strictDockerMode: true });
  assert(markerPassRes.currentUser === 'karsh_test_user', 'Marker guard accepts database with verified _test_environment_marker');

  // --------------------------------------------------------------------------
  // 3. MOCK STORAGE SERVICE TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Mock Storage Service Verification ---');
  const mockStorage = new MockStorageService();
  await mockStorage.init();

  // Test 1: Upload to game-assets
  const imgBuffer = Buffer.from('mock-image-data-test');
  const uploadResult = await mockStorage.upload({
    bucket: 'game-assets',
    path: 'covers/test_cover.jpg',
    buffer: imgBuffer,
    contentType: 'image/jpeg',
  });
  assert(uploadResult.success, 'Mock storage upload succeeds');
  assert(uploadResult.url.startsWith('https://mock-storage.local/game-assets/'), 'Generates mock public URL for public bucket');
  assert(uploadResult.size === imgBuffer.length, 'Records correct buffer size');

  // Test 2: Upload to private release-apks
  const apkBuffer = Buffer.from('mock-apk-data-test');
  const apkUploadResult = await mockStorage.upload({
    bucket: 'release-apks',
    path: 'test-release.apk',
    buffer: apkBuffer,
    contentType: 'application/vnd.android.package-archive',
  });
  assert(apkUploadResult.success, 'Mock storage private APK upload succeeds');
  assert(apkUploadResult.url === '/api/releases/download', 'Returns internal download reference for private bucket');

  // Test 3: Public URL generation on private bucket throws security exception
  let privateUrlDenied = false;
  try {
    mockStorage.getPublicUrl('release-apks', 'test-release.apk');
  } catch (err: any) {
    privateUrlDenied = true;
    assert(err.message.includes('Security Violation'), 'getPublicUrl throws Security Violation on private bucket');
  }
  assert(privateUrlDenied, 'Public URL generation strictly denied for release-apks');

  // Test 4: Private streaming download
  const downloadStream = await mockStorage.downloadPrivate('release-apks', 'test-release.apk');
  assert(downloadStream.contentLength === apkBuffer.length, 'Download stream returns correct content length');
  assert(downloadStream.contentType === 'application/vnd.android.package-archive', 'Download stream returns correct MIME');
  const chunks: Buffer[] = [];
  for await (const chunk of downloadStream.stream) {
    chunks.push(Buffer.from(chunk));
  }
  const downloadedBuffer = Buffer.concat(chunks);
  assert(downloadedBuffer.equals(apkBuffer), 'Streamed content exactly matches original buffer');

  // Test 5: Missing object returns 404 error
  let missing404 = false;
  try {
    await mockStorage.downloadPrivate('release-apks', 'nonexistent.apk');
  } catch (err: any) {
    missing404 = true;
    assert(err.message.includes('404'), 'Missing object throws 404 error');
  }
  assert(missing404, 'Download throws on missing object');

  // Test 6: Overwrite prevention (x-upsert: false emulation)
  let overwriteConflict = false;
  try {
    await mockStorage.upload({
      bucket: 'game-assets',
      path: 'covers/test_cover.jpg',
      buffer: Buffer.from('different-size-data-causes-409'),
      contentType: 'image/jpeg',
      preventOverwrite: true,
    });
  } catch (err: any) {
    overwriteConflict = true;
    assert(err.message.includes('409'), 'Upload collision with different size throws 409 conflict');
  }
  assert(overwriteConflict, 'Prevents overwriting existing object when preventOverwrite is true');

  // Test 7: Protected objects deletion guard
  const deleteProtectedRes = await mockStorage.deleteObject('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
  assert(!deleteProtectedRes, 'Refuses to delete protected production asset');

  // Test 8: Deleting normal test object
  const deleteTestRes = await mockStorage.deleteObject('game-assets', 'covers/test_cover.jpg');
  assert(deleteTestRes, 'Successfully deletes non-protected test asset');

  // Test 9: Fault injection simulation
  mockStorage.simulateFailure('upload', new Error('Simulated network timeout'));
  let failureCaught = false;
  try {
    await mockStorage.upload({
      bucket: 'game-assets',
      path: 'should-fail.jpg',
      buffer: Buffer.from('data'),
      contentType: 'image/jpeg',
    });
  } catch (err: any) {
    failureCaught = true;
    assert(err.message === 'Simulated network timeout', 'Simulated failure successfully injected');
  }
  assert(failureCaught, 'Fault simulation works');
  mockStorage.clearSimulatedFailure('upload');

  // --------------------------------------------------------------------------
  // 4. TEST FIXTURES INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Test Fixtures Integrity & Isolation ---');
  assert(TEST_FIXTURES.user.id.startsWith('test_'), 'User fixture has synthetic test_ ID');
  assert(TEST_FIXTURES.user.username === 'test_admin', 'User fixture has synthetic test username');
  assert(TEST_FIXTURES.user.password_hash !== '$2b$10$w6KzX5Zz7bKk8uV6', 'User fixture uses separate non-production password hash');

  assert(TEST_FIXTURES.game.id.startsWith('test_'), 'Game fixture has synthetic test_ ID');
  assert(TEST_FIXTURES.game.slug === 'test-space-odyssey', 'Game fixture has distinct test slug');

  assert(TEST_FIXTURES.release.id.startsWith('test_'), 'Release fixture has synthetic test_ ID');
  assert(TEST_FIXTURES.release.download_count === 0, 'Release fixture has initial download_count of 0');

  assert(TEST_FIXTURES.product.id.startsWith('test_'), 'Product fixture has synthetic test_ ID');
  assert(TEST_FIXTURES.settings.studio_name.includes('Test'), 'Studio settings fixture includes "Test" marker');

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n======================================================`);
  console.log(`Isolation Suite Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Isolation Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_isolation_guard.ts')) {
  runIsolationSuite().catch((err) => {
    console.error('Fatal isolation test error:', err);
    process.exit(1);
  });
}
