import fs from 'fs';
import path from 'path';

console.log('=== SIMULATING RENDER PERSISTENT DISK & REDEPLOYMENT LIFECYCLE ===\n');

const testMountDir = path.resolve(process.cwd(), 'scratch_render_mount');
const testUploadsDir = path.join(testMountDir, 'uploads');
const testDbFile = path.join(testMountDir, 'db.json');

// Cleanup any old test mount
if (fs.existsSync(testMountDir)) {
  fs.rmSync(testMountDir, { recursive: true, force: true });
}

fs.mkdirSync(testMountDir, { recursive: true });

// Set environment variable simulating Render Persistent Disk configuration
process.env.DATA_DIR = testMountDir;
process.env.NODE_ENV = 'production'; // simulate Render production environment

// 1. Initial Container Deployment #1
console.log('[Step 1] Initial Container 1 starts up with empty persistent disk mounted at:', testMountDir);
const { ensureStorageDirectories } = await import('./server/paths.js');
const { db } = await import('./server/db.js');
const { seedDatabase } = await import('./server/seed.js');

ensureStorageDirectories();
await seedDatabase();

// Verify that in production, NO dummy Arrow Puzzle was created
const gamesAfterDeploy1 = db.getGames();
console.log(`Games in catalog after Deploy #1: ${gamesAfterDeploy1.length}`);
if (gamesAfterDeploy1.length !== 0) {
  throw new Error(`FAIL: Expected 0 games on initial production startup, but found ${gamesAfterDeploy1.length} games (dummy game was created)!`);
}
console.log('[PASS] Deploy #1: Zero dummy games created on fresh production startup.');

// Verify admin user exists
const usersAfterDeploy1 = db.getUsers();
if (usersAfterDeploy1.length === 0 || usersAfterDeploy1[0].username !== 'khrgosh') {
  throw new Error('FAIL: Superadmin khrgosh was not properly created');
}
console.log('[PASS] Deploy #1: Superadmin user khrgosh successfully initialized.');

// 2. User logs in to production Admin Panel and creates real production game & uploads real APK
console.log('\n[Step 2] Admin logs into production and creates real game "Nebula Odyssey"...');
const realGame = db.createGame({
  title: 'Nebula Odyssey',
  slug: 'nebula-odyssey',
  tagline: 'Deep Space Survival Exploration',
  description: 'A rich space journey',
  genre: ['Action', 'Sci-Fi'],
  platforms: ['Android'],
  status: 'Available',
  featured: true,
  cover_image: '/uploads/images/nebula_cover.jpg',
  screenshots: ['/uploads/images/nebula_1.jpg'],
  features: ['Procedural galaxies'],
  controls: ['Touch thrusters'],
  requirements: { min_android: '10' },
  developer: 'Karsh Tech',
});

const realRelease = db.createRelease({
  game_id: realGame.id,
  version_name: '2.0.0',
  version_code: 200,
  release_date: '2026-10-31',
  release_notes: 'Production launch',
  apk_filename: 'nebula_odyssey_prod_release.apk',
  original_filename: 'nebula odyssey.apk',
  apk_file_size: 15400000,
  apk_download_url: `/api/releases/placeholder/download`,
  min_sdk: 28,
  target_sdk: 35,
  is_published: true,
});

console.log(`Created real game ID: ${realGame.id}, Release ID: ${realRelease.id}`);

// 3. User modifies code locally, commits, pushes to GitHub. Render triggers Redeploy (Deployment #2)
console.log('\n[Step 3] Simulating Deployment #2 (Render spins up a new container, mounting existing persistent disk)...');

// Re-read db directly from disk to simulate container reboot
db.reload();
await seedDatabase();

// Verify that the real game is intact and dummy Arrow Puzzle was NOT injected
const gamesAfterDeploy2 = db.getGames();
console.log(`Games in catalog after Deploy #2: ${gamesAfterDeploy2.length}`);

if (gamesAfterDeploy2.length !== 1 || gamesAfterDeploy2[0].title !== 'Nebula Odyssey') {
  throw new Error(`FAIL: Real game was lost or replaced after redeployment! Current games: ${JSON.stringify(gamesAfterDeploy2)}`);
}
console.log('[PASS] Deploy #2: Real game "Nebula Odyssey" persisted intact across redeploy!');

const releasesAfterDeploy2 = db.getReleasesByGameId(realGame.id);
if (releasesAfterDeploy2.length !== 1 || releasesAfterDeploy2[0].original_filename !== 'nebula odyssey.apk') {
  throw new Error('FAIL: Real release or original filename lost after redeployment!');
}
console.log('[PASS] Deploy #2: Real release and original filename persisted intact across redeploy!');

// 4. Admin deletes a game in the Admin Console. Render triggers Deployment #3.
console.log('\n[Step 4] Admin deletes a game. Simulating Deployment #3...');
db.deleteGame(realGame.id);
const gamesAfterDelete = db.getGames();
console.log(`Games in catalog after deletion: ${gamesAfterDelete.length}`);

// Redeploy simulation
db.reload();
await seedDatabase();

const gamesAfterDeploy3 = db.getGames();
if (gamesAfterDeploy3.length !== 0) {
  throw new Error('FAIL: Deleted game was resurrected upon server reboot/redeploy!');
}
console.log('[PASS] Deploy #3: Deleted game remained deleted after reboot/redeploy. Zero resurrection!');

// Cleanup
fs.rmSync(testMountDir, { recursive: true, force: true });
console.log('\n=== RENDER PERSISTENCE SIMULATION PASSED WITH 100% SUCCESS! ===\n');
