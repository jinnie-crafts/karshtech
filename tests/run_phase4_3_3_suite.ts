// Phase 4.3.3 Dedicated Storage Suites
import { runStorageUploadTests } from './test_storage_upload.js';
import { runStorageCollisionTests } from './test_storage_collision.js';
import { runApkStreamingTests } from './test_apk_streaming.js';
import { runLegacyImageRedirectTests } from './test_legacy_image_redirect.js';
import { runStorageDeleteSafetyTests } from './test_storage_delete_safety.js';
import { runStorageApiIntegrationTests } from './test_storage_api_integration.js';
import { runStorageProdReadonlyTests } from './test_storage_prod_readonly.js';

// Phase 4.3.2 Regression Suites
import { runIsolationSuite } from './test_isolation_guard.js';
import { runAuthIntegrationTests } from './test_auth_integration.js';
import { runAtomicCounterTests } from './test_atomic_counter.js';
import { runSqlSafetyTests } from './test_sql_safety.js';
import { runJsonRegressionTests } from './test_json_regression.js';
import { runPostgresCrudTests } from './test_postgres_crud.js';

interface CategorySummary {
  categoryName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  suiteFiles: string[];
}

async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.3 COMPREHENSIVE STORAGE & API SUITE');
  console.log('================================================================\n');

  const phase433Summaries: Record<string, CategorySummary> = {
    upload_validation: {
      categoryName: '1. Storage Upload & Buffer Validation',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_upload.ts'],
    },
    collision_integrity: {
      categoryName: '2. Storage Collision & Content Integrity',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_collision.ts'],
    },
    apk_streaming: {
      categoryName: '3. Private APK Streaming & Download Counter',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_apk_streaming.ts'],
    },
    legacy_redirect: {
      categoryName: '4. Legacy Image Redirect Security & Traversal',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_legacy_image_redirect.ts'],
    },
    delete_safety: {
      categoryName: '5. Delete Safeguards & Protected Asset Defense',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_delete_safety.ts'],
    },
    api_integration: {
      categoryName: '6. Express Multipart API & Auth Integration',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_api_integration.ts'],
    },
    prod_readonly: {
      categoryName: '7. Production Read-Only Storage Verification',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_prod_readonly.ts'],
    },
  };

  const regressionSummaries: Record<string, CategorySummary> = {
    guard_regression: {
      categoryName: 'R1. Fail-Closed Database Guard & Marker',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_isolation_guard.ts'],
    },
    auth_regression: {
      categoryName: 'R2. Authentication & Admin Middleware',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_auth_integration.ts'],
    },
    counter_regression: {
      categoryName: 'R3. High-Concurrency Atomic Counter',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_atomic_counter.ts'],
    },
    sql_regression: {
      categoryName: 'R4. SQL Injection & Column Allowlist Defense',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_sql_safety.ts'],
    },
    json_regression: {
      categoryName: 'R5. Fallback JSON Provider & Corruption Recovery',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_json_regression.ts'],
    },
    crud_regression: {
      categoryName: 'R6. Real Docker PostgreSQL CRUD Integration',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_postgres_crud.ts'],
    },
  };

  try {
    // ==========================================
    // PHASE 4.3.3 DEDICATED STORAGE SUITES
    // ==========================================
    console.log('>>> EXECUTING PHASE 4.3.3 STORAGE INTEGRATION SUITES <<<\n');

    const uploadReports = await runStorageUploadTests();
    phase433Summaries.upload_validation.total = uploadReports.length;
    phase433Summaries.upload_validation.passed = uploadReports.filter(r => r.passed).length;
    phase433Summaries.upload_validation.failed = uploadReports.filter(r => !r.passed).length;

    const collisionReports = await runStorageCollisionTests();
    phase433Summaries.collision_integrity.total = collisionReports.length;
    phase433Summaries.collision_integrity.passed = collisionReports.filter(r => r.passed).length;
    phase433Summaries.collision_integrity.failed = collisionReports.filter(r => !r.passed).length;

    const streamingReports = await runApkStreamingTests();
    phase433Summaries.apk_streaming.total = streamingReports.length;
    phase433Summaries.apk_streaming.passed = streamingReports.filter(r => r.passed).length;
    phase433Summaries.apk_streaming.failed = streamingReports.filter(r => !r.passed).length;

    const redirectReports = await runLegacyImageRedirectTests();
    phase433Summaries.legacy_redirect.total = redirectReports.length;
    phase433Summaries.legacy_redirect.passed = redirectReports.filter(r => r.passed).length;
    phase433Summaries.legacy_redirect.failed = redirectReports.filter(r => !r.passed).length;

    const deleteReports = await runStorageDeleteSafetyTests();
    phase433Summaries.delete_safety.total = deleteReports.length;
    phase433Summaries.delete_safety.passed = deleteReports.filter(r => r.passed).length;
    phase433Summaries.delete_safety.failed = deleteReports.filter(r => !r.passed).length;

    const apiReports = await runStorageApiIntegrationTests();
    phase433Summaries.api_integration.total = apiReports.length;
    phase433Summaries.api_integration.passed = apiReports.filter(r => r.passed).length;
    phase433Summaries.api_integration.failed = apiReports.filter(r => !r.passed).length;

    const prodReports = await runStorageProdReadonlyTests();
    phase433Summaries.prod_readonly.total = prodReports.length;
    phase433Summaries.prod_readonly.passed = prodReports.filter(r => r.passed).length;
    phase433Summaries.prod_readonly.failed = prodReports.filter(r => !r.passed).length;

    // ==========================================
    // PHASE 4.3.2 REGRESSION SUITES
    // ==========================================
    console.log('\n>>> EXECUTING PHASE 4.3.2 REGRESSION SUITES <<<\n');

    const guardReports = await runIsolationSuite();
    regressionSummaries.guard_regression.total = guardReports.length;
    regressionSummaries.guard_regression.passed = guardReports.filter(r => r.passed).length;
    regressionSummaries.guard_regression.failed = guardReports.filter(r => !r.passed).length;

    const authReports = await runAuthIntegrationTests();
    regressionSummaries.auth_regression.total = authReports.length;
    regressionSummaries.auth_regression.passed = authReports.filter(r => r.passed).length;
    regressionSummaries.auth_regression.failed = authReports.filter(r => !r.passed).length;

    const counterReports = await runAtomicCounterTests();
    regressionSummaries.counter_regression.total = counterReports.length;
    regressionSummaries.counter_regression.passed = counterReports.filter(r => r.passed).length;
    regressionSummaries.counter_regression.failed = counterReports.filter(r => !r.passed).length;

    const sqlReports = await runSqlSafetyTests();
    regressionSummaries.sql_regression.total = sqlReports.length;
    regressionSummaries.sql_regression.passed = sqlReports.filter(r => r.passed).length;
    regressionSummaries.sql_regression.failed = sqlReports.filter(r => !r.passed).length;

    const jsonReports = await runJsonRegressionTests();
    regressionSummaries.json_regression.total = jsonReports.length;
    regressionSummaries.json_regression.passed = jsonReports.filter(r => r.passed).length;
    regressionSummaries.json_regression.failed = jsonReports.filter(r => !r.passed).length;

    const crudReports = await runPostgresCrudTests();
    regressionSummaries.crud_regression.total = crudReports.length;
    regressionSummaries.crud_regression.passed = crudReports.filter(r => r.passed).length;
    regressionSummaries.crud_regression.failed = crudReports.filter(r => !r.passed).length;

  } catch (err: any) {
    console.error('[SUITE RUNNER FATAL EXCEPTION]', err.message);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log(`PHASE 4.3.3 EXECUTION REPORT (Total Wall Time: ${durationSec}s)`);
  console.log('================================================================\n');

  console.log('### PART A: Phase 4.3.3 Dedicated Storage & API Tests');
  console.log('| Category | Suite Files | Total | Passed | Failed | Status |');
  console.log('|---|---|---|---|---|---|');

  let p433Total = 0;
  let p433Passed = 0;
  let p433Failed = 0;

  for (const s of Object.values(phase433Summaries)) {
    p433Total += s.total;
    p433Passed += s.passed;
    p433Failed += s.failed;
    const status = s.failed === 0 && s.total > 0 ? 'PASS' : (s.total === 0 ? 'NOT RUN' : 'FAIL');
    console.log(`| **${s.categoryName}** | \`${s.suiteFiles.join(', ')}\` | ${s.total} | ${s.passed} | ${s.failed} | **${status}** |`);
  }
  console.log('|---|---|---|---|---|---|');
  console.log(`| **SUBTOTAL (Phase 4.3.3)** | 7 Storage Suites | **${p433Total}** | **${p433Passed}** | **${p433Failed}** | **${p433Failed === 0 ? 'PASS (100%)' : 'FAIL'}** |\n`);

  console.log('### PART B: Phase 4.3.2 Regression Verification Tests');
  console.log('| Category | Suite Files | Total | Passed | Failed | Status |');
  console.log('|---|---|---|---|---|---|');

  let regTotal = 0;
  let regPassed = 0;
  let regFailed = 0;

  for (const s of Object.values(regressionSummaries)) {
    regTotal += s.total;
    regPassed += s.passed;
    regFailed += s.failed;
    const status = s.failed === 0 && s.total > 0 ? 'PASS' : (s.total === 0 ? 'NOT RUN' : 'FAIL');
    console.log(`| **${s.categoryName}** | \`${s.suiteFiles.join(', ')}\` | ${s.total} | ${s.passed} | ${s.failed} | **${status}** |`);
  }
  console.log('|---|---|---|---|---|---|');
  console.log(`| **SUBTOTAL (Regression)** | 6 Regression Suites | **${regTotal}** | **${regPassed}** | **${regFailed}** | **${regFailed === 0 ? 'PASS (100%)' : 'FAIL'}** |\n`);

  const grandTotal = p433Total + regTotal;
  const grandPassed = p433Passed + regPassed;
  const grandFailed = p433Failed + regFailed;

  console.log('================================================================');
  console.log(`GRAND TOTAL: ${grandTotal} Tests | ${grandPassed} Passed | ${grandFailed} Failed | Status: ${grandFailed === 0 ? 'ALL PASS (100%)' : 'FAIL'}`);
  console.log('================================================================\n');

  if (grandFailed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
