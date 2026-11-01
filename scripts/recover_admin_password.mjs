#!/usr/bin/env node
/**
 * ==============================================================================
 * KARSH TECH PLATFORM — CONTROLLED ONE-TIME ADMIN PASSWORD RECOVERY
 * ==============================================================================
 * Milestone: Phase 4.3.9
 * Purpose: Securely synchronizes the production administrator's bcrypt hash in
 *          PostgreSQL with the configured ADMIN_PASSWORD environment variable.
 *
 * Safety Invariants:
 * 1. Strictly requires CONFIRM_ADMIN_PASSWORD_RECOVERY=true to execute writes.
 * 2. Without the confirmation flag, performs a safe READ-ONLY dry run.
 * 3. Atomic transaction isolation (BEGIN ... UPDATE ... VERIFY ... COMMIT).
 * 4. Fails closed on any ambiguity (0 or >1 admins, unexpected role, empty pass).
 * 5. Verifies bcrypt equality before transaction commit.
 * 6. ZERO secrets, passwords, or hashes are logged or printed.
 * ==============================================================================
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env if present and process.loadEnvFile is available
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const { Pool } = pg;

/**
 * Executes the admin password recovery routine.
 * @param {Object} options
 * @param {string} [options.databaseUrl]
 * @param {string} [options.adminUsername]
 * @param {string} [options.adminPassword]
 * @param {boolean|string} [options.confirmRecovery]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{
 *   success: boolean,
 *   dryRun: boolean,
 *   userId: string,
 *   username: string,
 *   role: string,
 *   dbHost: string,
 *   dbName: string,
 *   hashVerified: boolean
 * }>}
 */
export async function executePasswordRecovery(options = {}) {
  const dbUrl = options.databaseUrl || process.env.DATABASE_URL;
  const username = (options.adminUsername || process.env.ADMIN_USERNAME || 'khrgosh').trim();
  const password = options.adminPassword !== undefined ? options.adminPassword : process.env.ADMIN_PASSWORD;
  const isConfirmed = options.confirmRecovery === true || options.confirmRecovery === 'true' || process.env.CONFIRM_ADMIN_PASSWORD_RECOVERY === 'true';
  const isDryRun = options.dryRun === true || !isConfirmed;

  // 1. Fail Closed: Database Configuration
  if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.trim().length === 0) {
    throw new Error('[RECOVERY FATAL] DATABASE_URL is missing or empty.');
  }

  let dbHost = 'unknown';
  let dbName = 'unknown';
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, '') || 'postgres';
  } catch {
    throw new Error('[RECOVERY FATAL] DATABASE_URL format is invalid.');
  }

  // 2. Fail Closed: Admin Password
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('[RECOVERY FATAL] ADMIN_PASSWORD is missing or empty in environment.');
  }

  // 3. Connect to Database Pool
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbHost === '127.0.0.1' || dbHost === 'localhost' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    // 4. Query Target Administrator (Parameterized & Case-Insensitive)
    const findRes = await client.query(
      `SELECT id, username, role, created_at, password_hash
       FROM users
       WHERE LOWER(username) = LOWER($1);`,
      [username]
    );

    // 5. Fail Closed: Target User Existence
    if (findRes.rows.length === 0) {
      throw new Error(`[RECOVERY FATAL] Target administrator "${username}" does not exist in users table.`);
    }

    // 6. Fail Closed: Multiple Matches Ambiguity
    if (findRes.rows.length > 1) {
      throw new Error(`[RECOVERY FATAL] Multiple users (${findRes.rows.length}) matched "${username}". Ambiguous target.`);
    }

    const targetUser = findRes.rows[0];

    // 7. Fail Closed: Role Verification
    if (targetUser.role !== 'superadmin') {
      throw new Error(`[RECOVERY FATAL] Target user "${targetUser.username}" role is "${targetUser.role}". Expected "superadmin".`);
    }

    // 8. DRY-RUN MODE: When confirmation flag is not set
    if (isDryRun) {
      const currentMatches = await bcrypt.compare(password, targetUser.password_hash);
      return {
        success: true,
        dryRun: true,
        userId: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        dbHost,
        dbName,
        hashVerified: currentMatches,
      };
    }

    // 9. RECOVERY EXECUTION: Atomic Transaction
    await client.query('BEGIN');

    // Generate new bcrypt hash (standard 10 rounds matching application configuration)
    const newHash = await bcrypt.hash(password, 10);

    // Update ONLY password_hash for the verified ID
    const updateRes = await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND role = 'superadmin'
       RETURNING id, username, role, created_at, password_hash;`,
      [newHash, targetUser.id]
    );

    if (updateRes.rowCount !== 1) {
      await client.query('ROLLBACK');
      throw new Error(`[RECOVERY FATAL] Expected 1 row updated, got ${updateRes.rowCount}. Transaction rolled back.`);
    }

    const updatedUser = updateRes.rows[0];

    // 10. Read-back Invariant Verification: Compare new hash against plain password inside transaction
    const verifySuccess = await bcrypt.compare(password, updatedUser.password_hash);
    if (!verifySuccess) {
      await client.query('ROLLBACK');
      throw new Error('[RECOVERY FATAL] Verification failed: read-back hash did not match ADMIN_PASSWORD. Transaction rolled back.');
    }

    // Ensure no other fields were mutated
    if (updatedUser.id !== targetUser.id || updatedUser.username !== targetUser.username || updatedUser.role !== targetUser.role) {
      await client.query('ROLLBACK');
      throw new Error('[RECOVERY FATAL] Immutable fields mutated during update. Transaction rolled back.');
    }

    // Commit Transaction
    await client.query('COMMIT');

    return {
      success: true,
      dryRun: false,
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      dbHost,
      dbName,
      hashVerified: true,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI Execution Handler
const isDirectCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectCli) {
  console.log('================================================================');
  console.log('KARSH TECH — SECURE ONE-TIME ADMIN PASSWORD RECOVERY UTILITY');
  console.log('================================================================\n');

  executePasswordRecovery()
    .then((res) => {
      console.log('Target Administrator Identified:');
      console.log(`  User ID:       ${res.userId}`);
      console.log(`  Username:      ${res.username}`);
      console.log(`  Role:          ${res.role}`);
      console.log(`  Database Host: ${res.dbHost}`);
      console.log(`  Database Name: ${res.dbName}`);

      if (res.dryRun) {
        console.log('\n[DRY-RUN COMPLETE] No database writes were performed.');
        console.log(`  Current password match status: ${res.hashVerified ? 'MATCHES CURRENT HASH' : 'MISMATCH (RECOVERY NEEDED)'}`);
        console.log('\nTo execute live password recovery, run with:');
        console.log('  CONFIRM_ADMIN_PASSWORD_RECOVERY=true node scripts/recover_admin_password.mjs\n');
      } else {
        console.log('\n[SUCCESS] Password recovery transaction committed successfully!');
        console.log('  Updated password hash verified: TRUE');
        console.log('  Bcrypt verification against ADMIN_PASSWORD: PASS');
        console.log('  Zero plaintext passwords or hashes logged.\n');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[RECOVERY FAILED]:', err.message);
      process.exit(1);
    });
}
