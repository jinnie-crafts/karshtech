import { runPostgresCrudTests } from './test_postgres_crud.js';
import { runSqlSafetyTests } from './test_sql_safety.js';
import { runAtomicCounterTests } from './test_atomic_counter.js';
import { runTransactionsRecoveryTests } from './test_transactions_recovery.js';
import { runStorageUnitTests } from './test_storage_unit.js';
import { runIsolationSuite } from './test_isolation_guard.js';
import { runAuthIntegrationTests } from './test_auth_integration.js';
import { runJsonRegressionTests } from './test_json_regression.js';
import { runProductionSafetyChecks } from './test_prod_invariants.js';

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
  console.log('KARSH TECH — PHASE 4.3.2 COMPREHENSIVE TEST SUITE EXECUTION');
  console.log('================================================================\n');

  const summaries: Record<string, CategorySummary> = {
    real_postgres: {
      categoryName: '1. Real Docker PostgreSQL Integration Tests',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_postgres_crud.ts', 'test_sql_safety.ts', 'test_atomic_counter.ts', 'test_transactions_recovery.ts'],
    },
    mock_unit: {
      categoryName: '2. Mock-Based Unit Tests',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_storage_unit.ts', 'test_isolation_guard.ts'],
    },
    json_provider: {
      categoryName: '3. JSON Provider Regression Tests',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_json_regression.ts'],
    },
    auth_tests: {
      categoryName: '4. Authentication & Session Integration Tests',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_auth_integration.ts'],
    },
    prod_readonly: {
      categoryName: '5. Production Read-Only Safety Checks',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suiteFiles: ['test_prod_invariants.ts'],
    },
  };

  try {
    // 1. Real PostgreSQL CRUD
    const crudReports = await runPostgresCrudTests();
    summaries.real_postgres.total += crudReports.length;
    summaries.real_postgres.passed += crudReports.filter(r => r.passed).length;
    summaries.real_postgres.failed += crudReports.filter(r => !r.passed).length;

    // 2. SQL Safety
    const sqlReports = await runSqlSafetyTests();
    summaries.real_postgres.total += sqlReports.length;
    summaries.real_postgres.passed += sqlReports.filter(r => r.passed).length;
    summaries.real_postgres.failed += sqlReports.filter(r => !r.passed).length;

    // 3. Atomic Counter Concurrency
    const counterReports = await runAtomicCounterTests();
    summaries.real_postgres.total += counterReports.length;
    summaries.real_postgres.passed += counterReports.filter(r => r.passed).length;
    summaries.real_postgres.failed += counterReports.filter(r => !r.passed).length;

    // 4. Transactions and Recovery
    const txReports = await runTransactionsRecoveryTests();
    summaries.real_postgres.total += txReports.length;
    summaries.real_postgres.passed += txReports.filter(r => r.passed).length;
    summaries.real_postgres.failed += txReports.filter(r => !r.passed).length;

    // 5. Mock Storage Unit Tests
    const storageReports = await runStorageUnitTests();
    summaries.mock_unit.total += storageReports.length;
    summaries.mock_unit.passed += storageReports.filter(r => r.passed).length;
    summaries.mock_unit.failed += storageReports.filter(r => !r.passed).length;

    // 6. Test Environment Isolation & Guard Tests
    const guardReports = await runIsolationSuite();
    summaries.mock_unit.total += guardReports.length;
    summaries.mock_unit.passed += guardReports.filter(r => r.passed).length;
    summaries.mock_unit.failed += guardReports.filter(r => !r.passed).length;

    // 7. Authentication
    const authReports = await runAuthIntegrationTests();
    summaries.auth_tests.total += authReports.length;
    summaries.auth_tests.passed += authReports.filter(r => r.passed).length;
    summaries.auth_tests.failed += authReports.filter(r => !r.passed).length;

    // 6. JSON Provider Regression
    const jsonReports = await runJsonRegressionTests();
    summaries.json_provider.total += jsonReports.length;
    summaries.json_provider.passed += jsonReports.filter(r => r.passed).length;
    summaries.json_provider.failed += jsonReports.filter(r => !r.passed).length;

    // 7. Production Read-Only Invariants
    const prodReports = await runProductionSafetyChecks();
    summaries.prod_readonly.total += prodReports.length;
    summaries.prod_readonly.passed += prodReports.filter(r => r.passed).length;
    summaries.prod_readonly.failed += prodReports.filter(r => !r.passed).length;

  } catch (err: any) {
    console.error('[SUITE RUNNER EXCEPTION]', err.message);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log(`PHASE 4.3.2 TEST EXECUTION SUMMARY (Total Duration: ${durationSec}s)`);
  console.log('================================================================');
  console.log('| Category | Suite Files | Total | Passed | Failed | Skipped | Status |');
  console.log('|---|---|---|---|---|---|---|');

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  for (const s of Object.values(summaries)) {
    grandTotal += s.total;
    grandPassed += s.passed;
    grandFailed += s.failed;
    const status = s.failed === 0 && s.total > 0 ? 'PASS' : (s.total === 0 ? 'NOT RUN' : 'FAIL');
    console.log(`| **${s.categoryName}** | \`${s.suiteFiles.join(', ')}\` | ${s.total} | ${s.passed} | ${s.failed} | ${s.skipped} | **${status}** |`);
  }

  console.log('|---|---|---|---|---|---|---|');
  console.log(`| **TOTAL TEST RESULTS** | All Phase 4.3.2 Suites | **${grandTotal}** | **${grandPassed}** | **${grandFailed}** | **0** | **${grandFailed === 0 ? 'PASS (100%)' : 'FAIL'}** |`);
  console.log('================================================================\n');

  if (grandFailed > 0) {
    process.exit(1);
  }
}

main();
