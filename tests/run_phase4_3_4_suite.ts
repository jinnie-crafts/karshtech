import { runPublicFlowsTests } from './test_e2e_public_flows.js';
import { runAdminFlowsTests } from './test_e2e_admin_flows.js';
import { runAuthSessionsTests } from './test_e2e_auth_sessions.js';
import { runSecurityTests } from './test_e2e_security.js';
import { runStorageFollowupAudit } from './test_storage_followup_audit.js';
import { runContactWorkflowTests } from './test_e2e_contact.js';
import { runRenderConfigurationAudit } from './test_render_configuration_audit.js';
import { runFailureRecoveryTests } from './test_e2e_failure_recovery.js';

interface SuiteResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       KARSH TECH — PHASE 4.3.4 MASTER TEST RUNNER             ║');
  console.log('║   End-to-End API, User Flow, Security & Storage Audit Suite    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const suiteResults: SuiteResult[] = [];

  const suites = [
    { name: '1. Public User Flows (Catalog, Slugs, Sitemap)', fn: runPublicFlowsTests },
    { name: '2. Admin Workflows (Games, Releases, Products, Settings)', fn: runAdminFlowsTests },
    { name: '3. Authentication & Sessions (JWT, Cookies, Bearer)', fn: runAuthSessionsTests },
    { name: '4. Security & Injection Defense (RBAC, CSRF, SQLi)', fn: runSecurityTests },
    { name: '5. Storage Follow-up Audit (ETag/MD5, Counters, Overwrite)', fn: runStorageFollowupAudit },
    { name: '6. Web3Forms & Contact Resiliency', fn: runContactWorkflowTests },
    { name: '7. Render Deployment & CORS Configuration', fn: runRenderConfigurationAudit },
    { name: '8. Failure Recovery & Edge Cases', fn: runFailureRecoveryTests },
  ];

  for (const suite of suites) {
    console.log(`\n▶ Starting Suite: ${suite.name}`);
    const suiteStart = Date.now();
    try {
      const reports = await suite.fn();
      const passed = reports.filter((r) => r.passed).length;
      const failed = reports.filter((r) => !r.passed).length;
      const errors = reports.filter((r) => !r.passed && r.error).map((r) => `${r.name}: ${r.error}`);
      suiteResults.push({
        suiteName: suite.name,
        total: reports.length,
        passed,
        failed,
        durationMs: Date.now() - suiteStart,
        errors,
      });
    } catch (err: any) {
      suiteResults.push({
        suiteName: suite.name,
        total: 0,
        passed: 0,
        failed: 1,
        durationMs: Date.now() - suiteStart,
        errors: [err.message],
      });
      console.error(`💥 Suite ${suite.name} encountered fatal failure:`, err.message);
    }
  }

  const totalDuration = Date.now() - startTime;
  const grandTotal = suiteResults.reduce((acc, s) => acc + s.total, 0);
  const grandPassed = suiteResults.reduce((acc, s) => acc + s.passed, 0);
  const grandFailed = suiteResults.reduce((acc, s) => acc + s.failed, 0);

  console.log('\n\n================================================================');
  console.log('         PHASE 4.3.4 MASTER TEST SUITE SUMMARY MATRIX');
  console.log('================================================================\n');

  console.log('| Suite Name                                          | Total | Passed | Failed | Status |');
  console.log('|-----------------------------------------------------|-------|--------|--------|--------|');
  for (const s of suiteResults) {
    const status = s.failed === 0 ? '✓ PASS' : '✗ FAIL';
    const paddedName = s.suiteName.padEnd(51, ' ');
    const paddedTotal = s.total.toString().padStart(5, ' ');
    const paddedPassed = s.passed.toString().padStart(6, ' ');
    const paddedFailed = s.failed.toString().padStart(6, ' ');
    console.log(`| ${paddedName} | ${paddedTotal} | ${paddedPassed} | ${paddedFailed} | ${status} |`);
  }
  console.log('|-----------------------------------------------------|-------|--------|--------|--------|');
  const padGrandTotal = grandTotal.toString().padStart(5, ' ');
  const padGrandPassed = grandPassed.toString().padStart(6, ' ');
  const padGrandFailed = grandFailed.toString().padStart(6, ' ');
  const overallStatus = grandFailed === 0 ? '✓ ALL PASS' : '✗ FAILED';
  console.log(`| TOTAL ACROSS ALL 8 PHASE 4.3.4 SUITES               | ${padGrandTotal} | ${padGrandPassed} | ${padGrandFailed} | ${overallStatus} |`);
  console.log(`\nTotal Execution Time: ${(totalDuration / 1000).toFixed(2)} seconds\n`);

  if (grandFailed > 0) {
    console.error(`\n❌ ${grandFailed} tests failed during Phase 4.3.4 master execution!`);
    for (const s of suiteResults) {
      if (s.errors.length > 0) {
        console.error(`\nSuite [${s.suiteName}] Failures:`);
        s.errors.forEach((e) => console.error(`  - ${e}`));
      }
    }
    process.exit(1);
  } else {
    console.log(`\n✅ ALL ${grandPassed} TESTS PASSED SUCCESSFULLY! No regressions detected.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR IN MASTER RUNNER]', err);
  process.exit(1);
});
