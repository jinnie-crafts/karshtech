import jwt from 'jsonwebtoken';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const SECRET = process.env.JWT_SECRET || 'bd1db785e67e77696c8bd980f162806b70ac4d2390dfbe59ccc7ce24797e5ab7698da9c5a9b55e0f2f1e03ed1e497959621611f439c926729bf74f8067680f1f';
const ISSUER = 'tech.aadirishi.in';
const AUDIENCE = 'tech.aadirishi.in';

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
  console.log('--- STARTING KARSH TECH AUTHENTICATION & JWT SECURITY SUITE ---\n');
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

  // TEST 1: Valid admin login
  let sessionCookie = '';
  let validToken = '';
  try {
    const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'KarshTechAdmin2026!' }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
    validToken = res.data?.token || '';
    assert(1, 'Valid admin login', res.status === 200 && res.data?.user?.username === 'khrgosh', `Status: ${res.status}`);
  } catch (err) {
    assert(1, 'Valid admin login', false, err.message);
  }

  // TEST 2: Invalid username
  try {
    const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_admin_xyz', password: 'KarshTechAdmin2026!' }),
    });
    assert(2, 'Invalid username rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(2, 'Invalid username rejected', false, err.message);
  }

  // TEST 3: Invalid password
  try {
    const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'DefinitelyWrongPassword123!' }),
    });
    assert(3, 'Invalid password rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(3, 'Invalid password rejected', false, err.message);
  }

  // TEST 4: Missing JWT on protected route
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/games`);
    assert(4, 'Missing JWT rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(4, 'Missing JWT rejected', false, err.message);
  }

  // TEST 5: Malformed JWT
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt-token-string' },
    });
    assert(5, 'Malformed JWT rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(5, 'Malformed JWT rejected', false, err.message);
  }

  // TEST 6: Expired JWT
  try {
    const expiredToken = jwt.sign(
      { sub: 'usr_1793024870587_o71mp', userId: 'usr_1793024870587_o71mp', username: 'khrgosh', role: 'superadmin' },
      SECRET,
      { algorithm: 'HS256', expiresIn: -10, issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(6, 'Expired JWT rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(6, 'Expired JWT rejected', false, err.message);
  }

  // TEST 7: Tampered JWT
  try {
    const parts = validToken.split('.');
    if (parts.length === 3) {
      const tamperedToken = `${parts[0]}.${parts[1]}xyz.${parts[2]}`;
      const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      assert(7, 'Tampered JWT rejected', res.status === 401, `Status: ${res.status}`);
    } else {
      assert(7, 'Tampered JWT rejected', false, 'Valid token was not 3 parts');
    }
  } catch (err) {
    assert(7, 'Tampered JWT rejected', false, err.message);
  }

  // TEST 8: JWT signed with a different secret
  try {
    const bogusSecret = 'completely_different_and_unauthorized_secret_key_1234567890';
    const wrongSecretToken = jwt.sign(
      { sub: 'usr_1793024870587_o71mp', userId: 'usr_1793024870587_o71mp', username: 'khrgosh', role: 'superadmin' },
      bogusSecret,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${wrongSecretToken}` },
    });
    assert(8, 'JWT signed with wrong secret rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(8, 'JWT signed with wrong secret rejected', false, err.message);
  }

  // TEST 9: Old username token (token issued for "admin" when current username is "khrgosh")
  try {
    const oldUsernameToken = jwt.sign(
      { sub: 'usr_1793024870587_o71mp', userId: 'usr_1793024870587_o71mp', username: 'admin', role: 'superadmin' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${oldUsernameToken}` },
    });
    assert(9, 'Old username token rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(9, 'Old username token rejected', false, err.message);
  }

  // TEST 10: Deleted or disabled admin account
  try {
    const nonexistentUserToken = jwt.sign(
      { sub: 'usr_nonexistent_id_99999', userId: 'usr_nonexistent_id_99999', username: 'deleted_admin', role: 'superadmin' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${nonexistentUserToken}` },
    });
    assert(10, 'Deleted/nonexistent user token rejected', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assert(10, 'Deleted/nonexistent user token rejected', false, err.message);
  }

  // TEST 11: Unauthorized role attempting admin access
  try {
    const userRoleToken = jwt.sign(
      { sub: 'usr_1793024870587_o71mp', userId: 'usr_1793024870587_o71mp', username: 'khrgosh', role: 'user' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${userRoleToken}` },
    });
    assert(11, 'Unauthorized role (user) denied access with 403 Forbidden', res.status === 403, `Status: ${res.status}`);
  } catch (err) {
    assert(11, 'Unauthorized role (user) denied access with 403 Forbidden', false, err.message);
  }

  // TEST 12: Logout and subsequent access using cleared session
  try {
    // Call logout endpoint
    const logoutRes = await fetchJson(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5173',
        'Cookie': sessionCookie
      }
    });
    const setCookieLogout = logoutRes.headers.get('set-cookie');
    const isCleared = setCookieLogout && (setCookieLogout.includes('Max-Age=0') || setCookieLogout.includes('Expires='));
    
    // Attempt to access protected endpoint with the cleared cookie or empty cookie
    const followUpRes = await fetchJson(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Cookie': 'karsh_session=' }
    });
    assert(12, 'Logout clears session cookie and denies subsequent access', isCleared && followUpRes.status === 401, `Cleared: ${isCleared}, Followup Status: ${followUpRes.status}`);
  } catch (err) {
    assert(12, 'Logout clears session cookie', false, err.message);
  }

  // Protected Route Audit
  console.log('\n--- VERIFYING PROTECTED ADMINISTRATIVE ENDPOINTS ---');
  const protectedRoutes = [
    { name: 'GET /api/admin/games', url: `${BASE_URL}/api/admin/games` },
    { name: 'GET /api/admin/stats', url: `${BASE_URL}/api/admin/stats` },
    { name: 'GET /api/admin/settings', url: `${BASE_URL}/api/admin/settings` },
  ];

  for (const route of protectedRoutes) {
    const unauth = await fetchJson(route.url);
    const auth = await fetchJson(route.url, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    console.log(`Protected: ${route.name} -> Unauth: ${unauth.status} (expected 401), Auth: ${auth.status} (expected 200)`);
  }

  console.log(`\n--- TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) throw new Error(`${failed} tests failed in Auth test suite`);
  return { passed, failed };
}
