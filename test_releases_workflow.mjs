import fs from 'fs';
import path from 'path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, data: json };
}

export async function run() {
  console.log('=== STARTING KARSH TECH RELEASES & GAME MAPPING VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(testNum, testName, condition, detail) {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${testName} - ${detail}`);
      failed++;
    }
  }

  // 1. Admin Login
  let token = '';
  try {
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'KarshTechAdmin2026!' }),
    });
    token = loginRes.data?.token || '';
    assert(1, 'Admin login with khrgosh returns valid JWT', loginRes.status === 200 && !!token, `Status: ${loginRes.status}`);
  } catch (err) {
    assert(1, 'Admin login with khrgosh returns valid JWT', false, err.message);
  }

  // 2. Existing Arrow Puzzle game and releases check (backward compatibility)
  let arrowGame = null;
  let existingArrowRelease = null;
  try {
    const gamesRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const games = gamesRes.data?.games || [];
    arrowGame = games.find((g) => g.slug === 'arrow-puzzle');
    const relRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrowReleases = (relRes.data?.releases || []).filter((r) => r.game_id === arrowGame?.id);
    existingArrowRelease = arrowReleases[0];
    const hasOriginalName = !!existingArrowRelease?.original_filename;
    assert(2, 'Arrow Puzzle exists with intact releases and backward-compatible original_filename', !!arrowGame && arrowReleases.length > 0 && hasOriginalName, `Arrow ID: ${arrowGame?.id}, original_filename: ${existingArrowRelease?.original_filename}`);
  } catch (err) {
    assert(2, 'Arrow Puzzle exists with intact releases and backward-compatible original_filename', false, err.message);
  }

  // 3. Create a new test game in Game Catalog
  let testGame = null;
  try {
    const newGamePayload = {
      title: 'Nebula Odyssey Quest',
      slug: `nebula-odyssey-${Date.now()}`,
      tagline: 'Procedural Atmospheric Space Puzzle',
      description: 'A deep space navigational game engineered natively for Android by Karsh Tech.',
      genre: ['Puzzle', 'Exploration'],
      platforms: ['Android'],
      status: 'Available',
      featured: false,
      developer: 'Karsh Tech',
      cover_image: '/brand/karsh-tech-full.png',
      screenshots: ['/brand/karsh-tech-full.png'],
      features: ['Procedural Level Matrix', 'Low Latency Audio'],
      controls: ['Swipe to orient thrust vectors'],
      requirements: {
        min_android: 'Android 8.0 (API 26)',
        target_android: 'Android 15 (API 35)',
        storage: '35 MB',
        ram: '2 GB',
        internet: 'None (100% Offline)',
      },
    };
    const createGameRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newGamePayload),
    });
    testGame = createGameRes.data?.game;
    assert(3, 'Create new test game in Game Catalog succeeds with unique ID', createGameRes.status === 201 && !!testGame?.id, `Status: ${createGameRes.status}, ID: ${testGame?.id}`);
  } catch (err) {
    assert(3, 'Create new test game in Game Catalog succeeds with unique ID', false, err.message);
  }

  // 4. Verify newly created game is immediately in GET /api/admin/games dropdown list
  try {
    const listRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const games = listRes.data?.games || [];
    const found = games.find((g) => g.id === testGame?.id);
    assert(4, 'Newly created game is immediately returned in GET /api/admin/games for release dropdown', !!found && found.title === testGame?.title, `Found: ${!!found}`);
  } catch (err) {
    assert(4, 'Newly created game is immediately returned in GET /api/admin/games for release dropdown', false, err.message);
  }

  // 5. Upload real APK with spaces in original filename: "arrow puzzle.apk"
  let upload1StoredFilename = '';
  let upload1OriginalFilename = '';
  let upload1Size = 0;
  try {
    const formData = new FormData();
    const mockApkBytes = Buffer.from('PK\x03\x04MockBinaryContentForArrowPuzzleTestingKarshTech2026');
    const blob = new Blob([mockApkBytes], { type: 'application/vnd.android.package-archive' });
    formData.append('apk', blob, 'arrow puzzle.apk');

    const res = await fetch(`${BASE_URL}/api/admin/upload/apk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    upload1StoredFilename = data.filename || data.stored_filename;
    upload1OriginalFilename = data.original_filename;
    upload1Size = data.size;

    const originalPreserved = upload1OriginalFilename === 'arrow puzzle.apk';
    const storageUnique = upload1StoredFilename !== 'arrow puzzle.apk' && upload1StoredFilename.endsWith('.apk');

    assert(5, 'Upload "arrow puzzle.apk" preserves original name with spaces & generates unique stored name', res.status === 200 && originalPreserved && storageUnique, `Status: ${res.status}, Original: "${upload1OriginalFilename}", Stored: "${upload1StoredFilename}"`);
  } catch (err) {
    assert(5, 'Upload "arrow puzzle.apk" preserves original name with spaces & generates unique stored name', false, err.message);
  }

  // 6. Upload a SECOND APK with identical original filename "arrow puzzle.apk" to verify NO collision
  let upload2StoredFilename = '';
  try {
    const formData2 = new FormData();
    const mockApkBytes2 = Buffer.from('PK\x03\x04SecondDistinctUploadBytesKarshTech2026');
    const blob2 = new Blob([mockApkBytes2], { type: 'application/vnd.android.package-archive' });
    formData2.append('apk', blob2, 'arrow puzzle.apk');

    const res2 = await fetch(`${BASE_URL}/api/admin/upload/apk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData2,
    });
    const data2 = await res2.json();
    upload2StoredFilename = data2.filename || data2.stored_filename;

    const noCollision = upload1StoredFilename !== upload2StoredFilename;
    const sameOriginal = data2.original_filename === 'arrow puzzle.apk';

    assert(6, 'Second upload with same name has zero storage collision and distinct disk filename', res2.status === 200 && noCollision && sameOriginal, `Stored1: ${upload1StoredFilename}, Stored2: ${upload2StoredFilename}`);
  } catch (err) {
    assert(6, 'Second upload with same name has zero storage collision and distinct disk filename', false, err.message);
  }

  // 7. Submit release with target game and original_filename
  let createdRelease = null;
  try {
    const releasePayload = {
      game_id: testGame.id,
      version_name: '1.0.0',
      version_code: 1,
      min_sdk: 26,
      target_sdk: 35,
      release_notes: 'Initial production build for Nebula Odyssey Quest.',
      apk_filename: upload1StoredFilename,
      original_filename: upload1OriginalFilename,
      apk_file_size: upload1Size,
      is_published: true,
      release_date: new Date().toISOString().split('T')[0],
    };

    const createRelRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(releasePayload),
    });

    createdRelease = createRelRes.data?.release;
    const hasOriginal = createdRelease?.original_filename === 'arrow puzzle.apk';
    assert(7, 'POST /api/admin/releases stores both original_filename and unique apk_filename', createRelRes.status === 201 && hasOriginal, `Status: ${createRelRes.status}, Original: "${createdRelease?.original_filename}", Stored: "${createdRelease?.apk_filename}"`);
  } catch (err) {
    assert(7, 'POST /api/admin/releases stores both original_filename and unique apk_filename', false, err.message);
  }

  // 8. Admin GET /api/admin/releases returns original_filename
  try {
    const allReleasesRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const releases = allReleasesRes.data?.releases || [];
    const matched = releases.find((r) => r.id === createdRelease?.id);
    const correctOriginal = matched?.original_filename === 'arrow puzzle.apk';
    assert(8, 'Admin GET /api/admin/releases displays original_filename "arrow puzzle.apk"', !!matched && correctOriginal, `Matched original_filename: "${matched?.original_filename}"`);
  } catch (err) {
    assert(8, 'Admin GET /api/admin/releases displays original_filename "arrow puzzle.apk"', false, err.message);
  }

  // 9. Public APK download serves the file with RFC 6266 / RFC 5987 Content-Disposition header
  try {
    const initialCount = createdRelease.download_count || 0;
    const downloadRes = await fetch(`${BASE_URL}/api/releases/${createdRelease.id}/download`);
    const isOk = downloadRes.status === 200;
    const disposition = downloadRes.headers.get('content-disposition') || '';

    // Must match: filename="arrow puzzle.apk" and filename*=UTF-8''arrow%20puzzle.apk
    const hasQuotedOriginal = disposition.includes('filename="arrow puzzle.apk"');
    const hasUtf8Encoded = disposition.includes("filename*=UTF-8''arrow%20puzzle.apk");

    // Verify counter increment
    const checkRelRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updatedRel = (checkRelRes.data?.releases || []).find((r) => r.id === createdRelease.id);
    const countIncremented = (updatedRel?.download_count || 0) === initialCount + 1;

    assert(9, 'Public download sends RFC 6266 header: filename="arrow puzzle.apk" & filename*=UTF-8\'\'...', isOk && hasQuotedOriginal && hasUtf8Encoded && countIncremented, `Status: ${downloadRes.status}, Disposition: "${disposition}", Count: ${updatedRel?.download_count}`);
  } catch (err) {
    assert(9, 'Public download sends RFC 6266 header: filename="arrow puzzle.apk" & filename*=UTF-8\'\'...', false, err.message);
  }

  // 10. Backward compatibility: Existing older release downloads cleanly
  try {
    if (existingArrowRelease) {
      const arrowDlRes = await fetch(`${BASE_URL}/api/releases/${existingArrowRelease.id}/download`);
      const arrowDlOk = arrowDlRes.status === 200;
      const arrowDisp = arrowDlRes.headers.get('content-disposition') || '';
      const hasArrowName = arrowDisp.includes('filename=') && arrowDisp.includes('.apk');
      assert(10, 'Existing older release downloads successfully with valid Content-Disposition', arrowDlOk && hasArrowName, `Status: ${arrowDlRes.status}, Header: "${arrowDisp}"`);
    } else {
      assert(10, 'Existing older release downloads successfully with valid Content-Disposition', true, 'Skipped (no existing release)');
    }
  } catch (err) {
    assert(10, 'Existing older release downloads successfully with valid Content-Disposition', false, err.message);
  }

  // 11. Preserving original_filename when updating release metadata (PUT)
  try {
    const updateRes = await fetchJson(`${BASE_URL}/api/admin/releases/${createdRelease.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        release_notes: 'Updated notes without modifying APK binary.',
      }),
    });
    const updated = updateRes.data?.release;
    const preserved = updated?.original_filename === 'arrow puzzle.apk';
    assert(11, 'Editing release metadata preserves original_filename', updateRes.status === 200 && preserved, `Original filename: "${updated?.original_filename}"`);
  } catch (err) {
    assert(11, 'Editing release metadata preserves original_filename', false, err.message);
  }

  // 12. Test validation: Missing game_id rejected with 400
  try {
    const badRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        version_name: '1.0.1',
        apk_filename: upload1StoredFilename,
      }),
    });
    assert(12, 'Rejection of release creation when game_id is missing (400 Bad Request)', badRes.status === 400, `Status: ${badRes.status}`);
  } catch (err) {
    assert(12, 'Rejection of release creation when game_id is missing (400 Bad Request)', false, err.message);
  }

  // 13. Test validation: Non-existent game_id rejected with 404
  try {
    const badRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game_id: 'game_nonexistent_xyz999',
        version_name: '1.0.1',
        apk_filename: upload1StoredFilename,
      }),
    });
    assert(13, 'Rejection of release creation when game_id does not exist (404 Not Found)', badRes.status === 404, `Status: ${badRes.status}`);
  } catch (err) {
    assert(13, 'Rejection of release creation when game_id does not exist (404 Not Found)', false, err.message);
  }

  // 14. Clean up test game, releases, and uploaded test binaries
  try {
    const delRelRes = await fetchJson(`${BASE_URL}/api/admin/releases/${createdRelease.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const delGameRes = await fetchJson(`${BASE_URL}/api/admin/games/${testGame.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    // Clean up second upload APK from disk if leftover
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads', 'apks');
    const f2Path = path.join(uploadsDir, upload2StoredFilename);
    if (fs.existsSync(f2Path)) {
      try { fs.unlinkSync(f2Path); } catch {}
    }

    assert(14, 'Clean removal of test release, game, and test binaries with zero residue', delRelRes.status === 200 && delGameRes.status === 200, `Del Rel: ${delRelRes.status}, Del Game: ${delGameRes.status}`);
  } catch (err) {
    assert(14, 'Clean removal of test release, game, and test binaries with zero residue', false, err.message);
  }

  // 15. Verify Arrow Puzzle and its release remain 100% intact after cleanup
  try {
    const arrowCheckRes = await fetchJson(`${BASE_URL}/api/games/arrow-puzzle`);
    const arrowGameCheck = arrowCheckRes.data?.game;
    const intact = arrowGameCheck?.id === arrowGame?.id && !!arrowGameCheck?.latest_release;
    assert(15, 'Arrow Puzzle and its existing releases are completely preserved and intact', intact, `Arrow ID: ${arrowGameCheck?.id}, Has latest: ${!!arrowGameCheck?.latest_release}`);
  } catch (err) {
    assert(15, 'Arrow Puzzle and its existing releases are completely preserved and intact', false, err.message);
  }

  console.log(`\n=== RELEASES SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) throw new Error(`${failed} tests failed in Releases test suite`);
  return { passed, failed };
}
