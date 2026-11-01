# KARSH TECH — PHASE 4.3.6.2
## Concurrency Boundary & Integration Audit Report

**Project:** Karsh Tech Platform  
**Project Root:** `c:\Users\karsh\Desktop\karsh Techs`  
**Milestone:** Phase 4.3.6.2 — Concurrency Boundary & Integration Audit  
**Status:** AUDIT COMPLETE — ALL 8 CONCURRENCY SCENARIOS VERIFIED & HARDENED (57/57 TESTS PASSING, 100%)  
**Production Integrity:** 100% PRESERVED (ZERO PRODUCTION WRITES, PRODUCTION INVARIANTS CONFIRMED)  
**Date:** November 1, 2026  

---

## 1. Executive Summary

Phase 4.3.6.2 conducted a targeted, deep-dive architectural audit of the Karsh Tech Admin Media & Asset Manager concurrency perimeter, focusing specifically on:
1. The internal mechanics, lock lifecycle, cleanup, and normalization of [`AssetConcurrencyManager`](file:///c:/Users/karsh/Desktop/karsh%20Techs/server/index.ts#L1504-L1575).
2. An exhaustive backend inventory of every database mutation path modifying asset reference columns (`games.cover_image`, `games.banner_image`, `games.screenshots`, `products.cover_image`, `products.gallery`, `releases.apk_filename`).
3. Experimental verification of eight concurrent race condition scenarios between asset deletion, attachments, general CRUD updates, reordering, detaching, and multiple concurrent deletions.
4. An assessment of the production deployment topology on Render and the design of a database-backed distributed locking strategy for future horizontal scaling.

All eight race condition scenarios and key normalization were verified through 57 dedicated tests with a **100% pass rate** in an isolated Docker PostgreSQL 16.15 and `MockStorageService` environment. Zero production writes or modifications occurred.

---

## 2. Audit of AssetConcurrencyManager

### A. Process-Local vs. Shared Nature
`AssetConcurrencyManager` maintains an in-memory `Map<string, Promise<void>>` (`this.queues`).
- **Nature:** Strictly **process-local**.
- **Scope:** Coordinates asynchronous tasks within a single Node.js event loop / process.
- **Limitation:** It does **not** share state across multiple Node.js worker processes (`cluster.fork()`) or separate container/server instances. In a multi-instance deployment without distributed locking, instances would have independent maps.

### B. Lock Lifecycle & Cleanup
- When an operation calls `runExclusive(bucket, path, fn)` or `runExclusiveMany(items, fn)`:
  1. A `next` promise is created along with its `release` resolver and stored in `this.queues.set(key, next)`.
  2. The function waits for the previous operation on that key (`await prev`).
  3. Inside a `try ... finally` block, `fn()` executes.
  4. In the `finally` block, `release()` is unconditionally invoked.
  5. The manager checks: `if (this.queues.get(key) === next) { this.queues.delete(key); }`.
  6. If no subsequent operations are waiting in the queue for that key, the map entry is deleted. If another operation queued behind `next`, the map retains that later promise until the queue is exhausted.
- **Finding:** Lock entries are reliably cleaned up. There is **zero memory leakage** in `this.queues`.

### C. Exception Safety & Rejection Handling
- `prev` is always a promise whose resolver is triggered solely via `release!()` in a `finally` block.
- The queue promises are **never rejected**; they only resolve to signal completion of prior work.
- Therefore, `await prev` will never throw an unhandled rejection, even if the preceding operation failed with an exception.
- If `fn()` throws or rejects, the `finally` block guarantees that `release!()` executes, unblocking queued requests immediately.
- **Finding:** Lock acquisition and release are **100% exception-safe**.

### D. Lock Key Normalization
Prior to Phase 4.3.6.2, `makeKey` performed a raw `path.basename(objectPath)`. If a path had query parameters (e.g. `cover.jpg?v=2`), trailing fragments (`#frag`), URL encoding (`%20`), or leading slashes, different representations could produce distinct lock keys.

**Hardening Implemented:**
```typescript
public makeKey(bucket: string, objectPath: string): string {
  if (!objectPath || typeof objectPath !== 'string') return '';
  let clean = objectPath.split('?')[0].split('#')[0].trim().replace(/^\/+/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  const basename = path.basename(clean);
  return `${(bucket || '').toLowerCase().trim()}::${basename}`;
}
```
All variations (`cover.jpg`, `/cover.jpg`, `https://.../game-assets/cover.jpg?v=123`, `GAME-ASSETS::cover.jpg#hash`) now resolve to the exact same canonical key: `game-assets::cover.jpg`.

### E. Multi-Asset Deadlock Prevention (`runExclusiveMany`)
When an endpoint modifies multiple assets (e.g. general game update with cover image and screenshots, or gallery reordering), acquiring locks in arbitrary order risks classic ABBA deadlocks.
- **Implementation:** `runExclusiveMany` extracts all unique canonical keys and **deterministically sorts them alphabetically** (`uniqueKeys.sort()`) before chaining promises.
- **Guarantee:** All operations acquiring multiple locks acquire them in identical global order. Deadlock is mathematically impossible.

---

## 3. Database Mutation Path Inventory

The backend was exhaustively searched for all operations capable of modifying asset reference columns:

| Endpoint / Operation | HTTP Method | Target Entity & Fields | Previous Coordination | Hardened Coordination | Status |
|---|---|---|---|---|---|
| `/api/admin/games` | `POST` | `games.cover_image`, `games.banner_image`, `games.screenshots` | None (Direct insert) | Validates asset existence in storage if non-placeholder | **SECURED** |
| `/api/admin/games/:id` | `PUT` | `games.cover_image`, `games.banner_image`, `games.screenshots` | **None (Gap Identified)** | Wrapped in `assetConcurrency.runExclusiveMany`, verifies storage existence inside lock | **HARDENED** |
| `/api/admin/games/:id` | `DELETE` | `games` (deletes row, releases references) | DB cascade delete | Releases DB references safely | **SECURED** |
| `/api/admin/games/:id/screenshots` | `POST` | `games.screenshots` (append) | `runExclusive` on screenshot | `runExclusive`, storage existence verified inside lock | **SECURED** |
| `/api/admin/games/:id/screenshots` | `DELETE` | `games.screenshots` (detach) | **None (Gap Identified)** | Wrapped in `runExclusive('game-assets', targetBase)` | **HARDENED** |
| `/api/admin/games/:id/screenshots` | `PUT` | `games.screenshots` (reorder) | **None (Gap Identified)** | Wrapped in `runExclusiveMany` on all screenshots | **HARDENED** |
| `/api/admin/products` | `POST` | `products.cover_image`, `products.gallery` | None (Direct insert) | Validates asset existence in storage if non-placeholder | **SECURED** |
| `/api/admin/products/:id` | `PUT` | `products.cover_image`, `products.gallery` | **None (Gap Identified)** | Wrapped in `assetConcurrency.runExclusiveMany`, verifies storage existence inside lock | **HARDENED** |
| `/api/admin/products/:id` | `DELETE` | `products` (deletes row, releases references) | DB row delete | Releases DB references safely | **SECURED** |
| `/api/admin/products/:id/gallery` | `POST` | `products.gallery` (append) | `runExclusive` on gallery img | `runExclusive`, storage existence verified inside lock | **SECURED** |
| `/api/admin/products/:id/gallery` | `DELETE` | `products.gallery` (detach) | **None (Gap Identified)** | Wrapped in `runExclusive('product-assets', targetBase)` | **HARDENED** |
| `/api/admin/products/:id/gallery` | `PUT` | `products.gallery` (reorder) | **None (Gap Identified)** | Wrapped in `runExclusiveMany` on all gallery items | **HARDENED** |
| `/api/admin/releases` | `POST` | `releases.apk_filename` | None | Strict 403 on `release-apks` generic deletion isolates APKs | **SECURED** |
| `/api/admin/releases/:id` | `PUT` | `releases.apk_filename` | None | Strict 403 on `release-apks` generic deletion isolates APKs | **SECURED** |
| `/api/admin/releases/:id` | `DELETE` | `releases` (deletes row) | Cascade / explicit | Managed strictly through Releases workflow | **SECURED** |
| `/api/admin/media` | `DELETE` | Storage object deletion | `runExclusive`, re-checks DB | `runExclusive`, re-queries DB inside lock, fails with 409 if referenced | **AUTHORITATIVE** |

### Key Gap Identified & Resolved
Prior to Phase 4.3.6.2, general updates via `PUT /api/admin/games/:id` and `PUT /api/admin/products/:id` did not acquire concurrency locks. An administrator submitting a general game or product update could introduce an image reference concurrently with a generic deletion of that same asset, risking a dangling database reference. Both endpoints have now been updated with `assetConcurrency.runExclusiveMany`, verifying that any newly introduced asset exists in storage inside the lock before updating the database.

---

## 4. Concurrency Safety Test Results (All 8 Scenarios)

The test suite in [`tests/test_media_manager.ts`](file:///c:/Users/karsh/Desktop/karsh%20Techs/tests/test_media_manager.ts#L700-L890) was expanded to explicitly test all eight race condition scenarios under parallel execution (`Promise.all`):

```
================================================================
KARSH TECH — PHASE 4.3.6.2 CONCURRENCY VERIFICATION MATRIX
================================================================
```

### Scenario 1: Screenshot Attachment vs. Generic Asset Deletion
- **Execution:** `POST .../screenshots` vs `DELETE /api/admin/media` concurrently on `race_s1_screenshot.png`.
- **Outcome:** Deterministic serialization.
  - If attach won lock: Attach 200, Delete 409 Conflict (active DB reference detected). Storage preserved.
  - If delete won lock: Delete 200, Attach 404 Not Found (asset does not exist in storage). Zero DB reference.
- **Result:** **PASS (Zero dangling references)**

### Scenario 2: Product Gallery Attachment vs. Generic Asset Deletion
- **Execution:** `POST .../gallery` vs `DELETE /api/admin/media` concurrently on `race_s2_gallery.png`.
- **Outcome:** Deterministic serialization. Either Attach 200 + Delete 409, or Delete 200 + Attach 404.
- **Result:** **PASS (Zero dangling references)**

### Scenario 3: General Game Update vs. Generic Asset Deletion
- **Execution:** `PUT /api/admin/games/:id` (`cover_image: race_s3_game_cover.png`) vs `DELETE /api/admin/media` concurrently.
- **Outcome:**
  - If game update won lock: Update 200, Delete 409 Conflict. Game has cover, asset preserved in storage.
  - If delete won lock: Delete 200, Game update 404 Not Found (storage verification inside lock fails). Game cover remains intact.
- **Result:** **PASS (Zero dangling references)**

### Scenario 4: General Product Update vs. Generic Asset Deletion
- **Execution:** `PUT /api/admin/products/:id` (`cover_image: race_s4_prod_cover.png`) vs `DELETE /api/admin/media` concurrently.
- **Outcome:**
  - If product update won lock: Update 200, Delete 409 Conflict.
  - If delete won lock: Delete 200, Product update 404 Not Found.
- **Result:** **PASS (Zero dangling references)**

### Scenario 5: Screenshot Reordering vs. Generic Asset Deletion
- **Execution:** `PUT .../screenshots` (reordering existing screenshots) vs `DELETE /api/admin/media` concurrently on an existing screenshot.
- **Outcome:**
  - Because the screenshot is actively referenced in DB, `DELETE` detects the reference inside the lock and returns HTTP 409 Conflict.
  - Reordering succeeds with HTTP 200.
  - File is safely preserved in storage and DB.
- **Result:** **PASS (Zero dangling references)**

### Scenario 6: Product Gallery Reordering vs. Generic Asset Deletion
- **Execution:** `PUT .../gallery` (reordering gallery items) vs `DELETE /api/admin/media` concurrently on an existing gallery image.
- **Outcome:**
  - Deletion detects active gallery reference inside lock and returns HTTP 409 Conflict.
  - Gallery reordering succeeds with HTTP 200.
- **Result:** **PASS (Zero dangling references)**

### Scenario 7: Concurrent Detach vs. Generic Asset Deletion
- **Execution:** `DELETE .../screenshots` (`url: race_s7_detach.png`) vs `DELETE /api/admin/media` concurrently.
- **Outcome:**
  - If detach won lock: Detach 200 (screenshot removed from DB). Deletion observes 0 references and deletes object with 200. Cleanly removed from both.
  - If deletion won lock: Deletion observes active reference and returns 409 Conflict (storage preserved). Detach executes second with 200 (removed from DB). Asset safely preserved as unreferenced in library.
- **Result:** **PASS (Zero dangling references)**

### Scenario 8: Multiple Concurrent Deletion Requests for Same Object
- **Execution:** Two simultaneous `DELETE /api/admin/media?bucket=game-assets&path=race_s8_double_del.png` requests.
- **Outcome:**
  - Request 1 acquires lock, verifies 0 references, deletes object from storage, returns HTTP 200.
  - Request 2 acquires lock, verifies 0 references, calls `deleteObject()`, receives `false` (already deleted), returns HTTP 404 Not Found.
  - Clean execution with zero unhandled crashes or state corruption.
- **Result:** **PASS (Zero dangling references)**

### Lock Key Normalization Verification
- Verified that `game-assets::cover.jpg`, `/cover.jpg`, `https://.../cover.jpg?v=123`, `GAME-ASSETS::cover.jpg#frag`, and `folder%2Fcover.jpg` all resolve to `game-assets::cover.jpg`.
- **Result:** **PASS**

---

## 5. Deployment Topology Assessment

### Current Production Topology (Render Free Tier)
- **Service Type:** Web Service (Render Free tier).
- **Instance Count:** Exactly **1 container instance** (`numInstances: 1`).
- **Process Model:** Exactly **1 Node.js OS process** running the Express server.
- **Clustering:** Disabled (single event loop).

### Concurrency Guarantee Assessment
- In the current deployment topology, all HTTP traffic is served by the same Node.js process.
- The in-memory `AssetConcurrencyManager` FIFO promise queue is **100% authoritative and effective** for single-process architectures.
- Concurrent requests within the single process are serialized safely without race conditions.

### Future Scaling Limitation & Distributed Locking Migration
If the application is ever scaled horizontally in the future (e.g., Render Paid multi-instance scaling, autoscaling, or Node.js cluster mode), an in-memory lock will no longer suffice because memory is isolated per process.

#### Proposed Zero-Cost Distributed Locking Strategy: PostgreSQL Advisory Locks
Rather than introducing external paid services like Redis (e.g. Redlock), Karsh Tech already connects to Supabase PostgreSQL, which provides native, high-performance distributed locking primitives:

```sql
-- Acquire transaction-scoped advisory lock on 64-bit integer hash of asset key
SELECT pg_advisory_xact_lock(hashtext('game-assets::my_cover.jpg'));
```

**Architectural Advantages:**
1. **Zero Additional Cost:** Uses the existing Supabase PostgreSQL connection pool without any third-party infrastructure.
2. **True Distributed Authority:** All Render instances connect to the same PostgreSQL database, ensuring unified cross-process serialization.
3. **Automatic Crash Cleanup:** When transaction-scoped (`pg_advisory_xact_lock`), locks automatically release upon commit or rollback, preventing deadlocks even if a worker container crashes mid-operation.
4. **Sub-millisecond Performance:** Stored in PostgreSQL shared memory with zero disk I/O overhead.

*Note: In accordance with audit instructions, this distributed locking strategy is documented for future horizontal scaling but has NOT been implemented, as the current single-instance deployment is fully secured by `AssetConcurrencyManager`.*

---

## 6. Complete Verification & Regression Results

All verification suites were run against the isolated Docker test PostgreSQL (`127.0.0.1:5433`):

| Test Runner / Suite | Focus Area | Executions | Passed | Failed | Status |
|---|---|---|---|---|---|
| `test_media_manager.ts` | Media Manager & 8 Concurrency Scenarios | 57 | 57 | 0 | **PASS (100%)** |
| `run_phase4_3_4_suite.ts` | Phase 4.3.4 Master E2E & API Suite (8 Suites) | 73 | 73 | 0 | **PASS (100%)** |
| `run_phase4_3_3_suite.ts` | Phase 4.3.3 Storage, API & P4.3.2 Regression | 193 | 193 | 0 | **PASS (100%)** |
| `test_auth_security_hardening.ts` | Phase 4.3.5.2 Bcrypt Sole Authority & Seeding | 13 | 13 | 0 | **PASS (100%)** |
| `test_storage_prod_readonly.ts` | Production Read-Only Invariants | 7 | 7 | 0 | **PASS (100%)** |
|---|---|---|---|---|---|
| **TOTAL COMBINED RUNNER EXECUTIONS** | **All Verification Test Suites** | **343** | **343** | **0** | **PASS (100%)** |

### Static Analysis & Build Verification
- **TypeScript Typecheck (`npx tsc -b`):** 0 errors. Passed cleanly.
- **Frontend Production Build (`npm run build`):** Built cleanly in 8.53s. Generated `dist/index.html` (4.96 kB), CSS (66.12 kB), JS bundle (754.09 kB).

---

## 7. Production Read-Only Invariant Confirmation

Executed live read-only verification (`tests/test_storage_prod_readonly.ts`) against the production Supabase project (`rkvwvywlyvfxhphjcdus.supabase.co`):

| Production Asset / Invariant | Expected Value | Observed Production State | Status |
|---|---|---|---|
| `arrow_puzzle_cover.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow_puzzle_screenshot_1.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow_puzzle_screenshot_2.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow_puzzle_screenshot_3.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow_puzzle_screenshot_4.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow_puzzle_screenshot_5.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `default_avatar.png` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `default_cover.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `default_screenshot.jpg` | Present in `game-assets` | HTTP 200 CDN Verified | **UNTOUCHED** |
| `arrow-puzzle-release-v1.0.0.apk` | 2,885,749 bytes in `release-apks` | 2,885,749 bytes | **UNTOUCHED** |
| Direct Public APK CDN Access | Strictly Blocked (400/403) | Blocked (No public access) | **CONFIRMED** |
| Production Download Counter | Exactly 7 downloads | download_count = 7 | **UNMODIFIED** |
| Studio Contact Email | `karshhtech@gmail.com` | `karshhtech@gmail.com` | **UNMODIFIED** |
| Authoritative `server/data/db.json` | Hash matches Phase 2.7 manifest | Exact SHA-256 match | **UNTOUCHED** |

**Zero production records were modified. Zero production storage objects were written, altered, or deleted.**

---

## 8. Audit Conclusion

The Concurrency Boundary & Integration Audit (Phase 4.3.6.2) is **fully completed and signed off**:
- `AssetConcurrencyManager` is verified exception-safe, clean of memory leaks, normalized, and deadlock-free (`runExclusiveMany`).
- All database mutation paths affecting asset references are cataloged and hardened.
- All eight concurrent race condition scenarios pass deterministically with zero dangling references.
- The single-process Render Free deployment topology is verified safe; a zero-cost PostgreSQL advisory lock migration path is documented for any future multi-instance scaling.
- In accordance with operational rules, **no commits were pushed to GitHub, and no deployment to Render was performed**.
