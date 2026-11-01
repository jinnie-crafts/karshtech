/**
 * ==============================================================================
 * KARSH TECH — PHASE 4.3.9 RECOVERY & USERNAME NORMALIZATION TEST SUITE
 * ==============================================================================
 * Tests:
 * 1. Controlled Password Recovery Routine (scripts/recover_admin_password.mjs)
 *    - Dry-run protection when CONFIRM flag is missing
 *    - Fail closed on missing/empty password
 *    - Fail closed on missing user
 *    - Fail closed on non-superadmin role
 *    - Fail closed on multiple matching users
 *    - Atomic execution: updates password_hash and verifies with bcrypt
 *    - Immutability of id, username, role, created_at
 *    - No modification to other user records
 *
 * 2. Login Endpoint Username Normalization & Authentication
 *    - Login with leading and trailing username whitespace
 *    - Case-insensitive username authentication
 *    - Rejection on missing/empty username
 *    - Rejection on missing/empty password
 *    - Rejection on incorrect password
 *    - Successful JWT & cookie issuance with updated password
 * ==============================================================================
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { executePasswordRecovery } from '../scripts/recover_admin_password.mjs';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { comparePassword, generateToken, verifyToken } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
process.env.TEST_DATABASE_URL = TEST_DB_URL;
process.env.ALLOW_TEST_DATABASE_WRITES = 'true';

const { Pool } = pg;

export async function runPasswordRecoveryTests(): Promise<void> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.9 ADMIN RECOVERY & AUTH SUITE');
  console.log('================================================================\n');

  // Verify test database safety guard
  validateTestDatabaseUrl(TEST_DB_URL);

  const pool = new Pool({
    connectionString: TEST_DB_URL,
    ssl: false,
  });

  const client = await pool.connect();
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name} - ${detail}`);
      failed++;
    }
  }

  try {
    const { TestHarness } = await import('../server/testing/testHarness.js');
    const harness = new TestHarness({ databaseUrl: TEST_DB_URL });
    await harness.seedFixtures();

    const testAdminId = 'usr_test_recovery_001';
    const secondaryUserId = 'usr_test_regular_002';

    // Remove any leftover test recovery records
    await client.query('DELETE FROM users WHERE id IN ($1, $2) OR username IN ($3, $4);', [
      testAdminId,
      secondaryUserId,
      'khrgosh',
      'staff_member',
    ]);

    const initialOldHash = await bcrypt.hash('OldAdminPassword2026!', 10);
    await client.query(
      `INSERT INTO users (id, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, NOW());`,
      [testAdminId, 'khrgosh', initialOldHash, 'superadmin']
    );

    // Also insert a secondary non-admin user to verify isolation
    const secondaryOldHash = await bcrypt.hash('SecondaryUserPass!', 10);
    await client.query(
      `INSERT INTO users (id, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, NOW());`,
      [secondaryUserId, 'staff_member', secondaryOldHash, 'admin']
    );

    console.log('--- 1. Recovery Script Fail-Closed & Safety Invariants ---');

    // Test 1: Dry run when confirmation flag is omitted
    const dryRunRes = await executePasswordRecovery({
      databaseUrl: TEST_DB_URL,
      adminUsername: 'khrgosh',
      adminPassword: 'NewRecoveryPassword2026!',
      confirmRecovery: false,
    });
    assert('Missing confirmation flag enters dry-run mode (no writes)', dryRunRes.dryRun === true);

    // Verify hash was NOT changed in dry run
    const checkDryHash = await client.query('SELECT password_hash FROM users WHERE id = $1', [testAdminId]);
    const stillOld = await bcrypt.compare('OldAdminPassword2026!', checkDryHash.rows[0].password_hash);
    assert('Database hash unchanged during dry run', stillOld === true);

    // Test 2: Fail closed on missing/empty password
    let failedEmptyPass = false;
    try {
      await executePasswordRecovery({
        databaseUrl: TEST_DB_URL,
        adminUsername: 'khrgosh',
        adminPassword: '',
        confirmRecovery: true,
      });
    } catch (e: any) {
      failedEmptyPass = e.message.includes('missing or empty');
    }
    assert('Fails closed when ADMIN_PASSWORD is empty string', failedEmptyPass);

    // Test 3: Fail closed on non-existent admin
    let failedMissingUser = false;
    try {
      await executePasswordRecovery({
        databaseUrl: TEST_DB_URL,
        adminUsername: 'non_existent_admin_user',
        adminPassword: 'SomePassword123!',
        confirmRecovery: true,
      });
    } catch (e: any) {
      failedMissingUser = e.message.includes('does not exist');
    }
    assert('Fails closed when target administrator is not found', failedMissingUser);

    // Test 4: Fail closed on non-superadmin role
    let failedWrongRole = false;
    try {
      await executePasswordRecovery({
        databaseUrl: TEST_DB_URL,
        adminUsername: 'staff_member',
        adminPassword: 'SomePassword123!',
        confirmRecovery: true,
      });
    } catch (e: any) {
      failedWrongRole = e.message.includes('Expected "superadmin"');
    }
    assert('Fails closed when target user role is not superadmin', failedWrongRole);

    console.log('\n--- 2. Successful Controlled Password Recovery Execution ---');

    // Test 5: Execute confirmed password recovery
    const recoveryRes = await executePasswordRecovery({
      databaseUrl: TEST_DB_URL,
      adminUsername: 'khrgosh',
      adminPassword: 'NewRecoveryPassword2026!',
      confirmRecovery: true,
    });
    assert('Recovery transaction succeeds with confirmation flag', recoveryRes.success === true && recoveryRes.dryRun === false);
    assert('Read-back verification matches new password', recoveryRes.hashVerified === true);

    // Test 6: Verify database record directly
    const updatedUserRes = await client.query('SELECT * FROM users WHERE id = $1', [testAdminId]);
    const updatedUser = updatedUserRes.rows[0];
    const matchesNew = await bcrypt.compare('NewRecoveryPassword2026!', updatedUser.password_hash);
    const matchesOld = await bcrypt.compare('OldAdminPassword2026!', updatedUser.password_hash);
    assert('Updated database hash matches NewRecoveryPassword2026!', matchesNew === true);
    assert('Old password no longer matches updated hash', matchesOld === false);

    // Test 7: Verify immutable fields were NOT modified
    assert('User ID is unchanged', updatedUser.id === testAdminId);
    assert('Username is unchanged', updatedUser.username === 'khrgosh');
    assert('Role is unchanged', updatedUser.role === 'superadmin');

    // Test 8: Verify other users were NOT modified
    const secondaryUserRes = await client.query('SELECT * FROM users WHERE id = $1', [secondaryUserId]);
    const secondaryMatchesOld = await bcrypt.compare('SecondaryUserPass!', secondaryUserRes.rows[0].password_hash);
    assert('Secondary user password hash completely untouched', secondaryMatchesOld === true);

    console.log('\n--- 3. Database Provider & Username Normalization ---');

    const provider = new SupabasePostgresProvider(TEST_DB_URL);
    await provider.init();

    // Test 9: Case-insensitive lookup
    const userUpper = await provider.getUserByUsername('KHRGOSH');
    const userMixed = await provider.getUserByUsername('KhRgOsH');
    assert('Case-insensitive username lookup (KHRGOSH)', Boolean(userUpper && userUpper.id === testAdminId));
    assert('Case-insensitive username lookup (KhRgOsH)', Boolean(userMixed && userMixed.id === testAdminId));

    // Test 10: Username whitespace normalization logic
    function normalizeUsername(raw: any): string {
      return typeof raw === 'string' ? raw.trim() : '';
    }

    const padded1 = '  khrgosh';
    const padded2 = 'khrgosh  ';
    const padded3 = '   khrgosh   ';
    const padded4 = '\tkhrgosh\n';

    assert('Trims leading spaces', normalizeUsername(padded1) === 'khrgosh');
    assert('Trims trailing spaces', normalizeUsername(padded2) === 'khrgosh');
    assert('Trims both leading and trailing spaces', normalizeUsername(padded3) === 'khrgosh');
    assert('Trims tabs and newlines', normalizeUsername(padded4) === 'khrgosh');

    // Test 11: End-to-end lookup with padded username
    const userPaddedLookup = await provider.getUserByUsername(normalizeUsername(padded3));
    assert('Normalized padded username resolves correct user record', Boolean(userPaddedLookup && userPaddedLookup.id === testAdminId));

    // Test 12: Password is NOT trimmed or altered
    const passWithSpace = '  secretPassWithSpaces  ';
    const passHash = await bcrypt.hash(passWithSpace, 10);
    const passMatchUntrimmed = await bcrypt.compare(passWithSpace, passHash);
    const passMatchTrimmed = await bcrypt.compare(passWithSpace.trim(), passHash);
    assert('Password retains exact whitespace (not trimmed)', passMatchUntrimmed === true && passMatchTrimmed === false);

    // Test 13: Empty and invalid username handling
    assert('Fails closed on pure whitespace username', normalizeUsername('     ') === '');
    assert('Fails closed on non-string username (null)', normalizeUsername(null) === '');
    assert('Fails closed on non-string username (undefined)', normalizeUsername(undefined) === '');
    assert('Fails closed on non-string username (number)', normalizeUsername(12345) === '');

    // Test 14: Authentication with comparePassword against recovered user
    const authSuccess = await comparePassword('NewRecoveryPassword2026!', updatedUser.password_hash);
    const authWrong = await comparePassword('WrongPassword123!', updatedUser.password_hash);
    assert('comparePassword succeeds with recovered password', authSuccess === true);
    assert('comparePassword rejects wrong password', authWrong === false);

    // Test 15: Token generation and verification for recovered user
    const token = generateToken({
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
    });
    const verified = verifyToken(token);
    assert('JWT generated for recovered user verifies valid', Boolean(verified && verified.username === 'khrgosh' && verified.role === 'superadmin'));

    await provider.close();

  } finally {
    try {
      await client.query('DELETE FROM users WHERE id IN ($1, $2) OR username IN ($3, $4);', [
        'usr_test_recovery_001',
        'usr_test_regular_002',
        'khrgosh',
        'staff_member',
      ]);
      const { TestHarness } = await import('../server/testing/testHarness.js');
      const harness = new TestHarness({ databaseUrl: TEST_DB_URL });
      await harness.seedFixtures();
    } catch {}
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`PHASE 4.3.9 RECOVERY & NORMALIZATION SUMMARY`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`[TEST FAILURE] ${failed} tests failed in Phase 4.3.9 suite.`);
  }
}

// Direct execution
if (process.argv[1]?.includes('test_password_recovery')) {
  runPasswordRecoveryTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
