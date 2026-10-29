/**
 * SheGuard Automated Unit Tests Suite
 * Runs in Node.js ES Modules environment
 */
import assert from 'node:assert';
import { calculateDistance, formatDistance } from '../js/distance.js';
import { LocationService } from '../js/location.js';
import { RoutingService } from '../js/routing.js';
import { CONFIG } from '../js/config.js';

console.log('=== RUNNING SHEGUARD TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. Haversine Distance Algorithm Tests
// -------------------------------------------------------------
console.log('1. Distance Calculation Tests (Haversine Algorithm):');

test('Distance between identical coordinates is 0.0 km', () => {
  const d = calculateDistance(28.6139, 77.2090, 28.6139, 77.2090);
  assert.strictEqual(d, 0.0);
});

test('Calculates accurate distance between New Delhi and Mumbai (~1148 km)', () => {
  // New Delhi (28.6139, 77.2090), Mumbai (19.0760, 72.8777)
  const d = calculateDistance(28.6139, 77.2090, 19.0760, 72.8777);
  assert.ok(d >= 1140 && d <= 1160, `Expected ~1148 km, got ${d}`);
});

test('Rejects invalid coordinate values (null, undefined, NaN)', () => {
  assert.strictEqual(calculateDistance(null, 77.0, 28.0, 72.0), null);
  assert.strictEqual(calculateDistance(28.0, NaN, 28.0, 72.0), null);
  assert.strictEqual(calculateDistance(undefined, 77.0, 28.0, 72.0), null);
});

test('Rejects coordinates outside Earth coordinate bounds (>90 lat, >180 lon)', () => {
  assert.strictEqual(calculateDistance(95.0, 77.0, 28.0, 72.0), null);
  assert.strictEqual(calculateDistance(-95.0, 77.0, 28.0, 72.0), null);
  assert.strictEqual(calculateDistance(28.0, 195.0, 28.0, 72.0), null);
});

test('Format distance correctly outputs meters for <1km and km for >=1km', () => {
  assert.strictEqual(formatDistance(0.45), '450 m');
  assert.strictEqual(formatDistance(2.45), '2.5 km');
  assert.strictEqual(formatDistance(null), 'Distance unavailable');
});

// -------------------------------------------------------------
// 2. Location Freshness & Stale Detection Tests
// -------------------------------------------------------------
console.log('\n2. Location Freshness Evaluation Tests:');

const locService = new LocationService();

test('Location updated 5 minutes ago is evaluated as LIVE', () => {
  const recentTimestamp = Date.now() - (5 * 60 * 1000);
  assert.strictEqual(locService.isLocationLive(recentTimestamp), true);
});

test('Location updated 45 minutes ago is evaluated as STALE (>30 min threshold)', () => {
  const staleTimestamp = Date.now() - (45 * 60 * 1000);
  assert.strictEqual(locService.isLocationLive(staleTimestamp), false);
});

test('Handles missing or invalid timestamp gracefully', () => {
  assert.strictEqual(locService.isLocationLive(null), false);
  assert.strictEqual(locService.isLocationLive('not-a-date'), false);
});

// -------------------------------------------------------------
// 3. Routing Service URL & Navigation Fallback Tests
// -------------------------------------------------------------
console.log('\n3. Routing Service & Navigation Fallback Tests:');

const router = new RoutingService();

test('Generates correct external navigation fallback URL for Google Maps', () => {
  const url = router.getExternalNavigationUrl(28.6139, 77.2090, 28.5355, 77.3910);
  assert.ok(url.includes('destination=28.6139,77.209'), 'Missing destination coordinates in URL');
  assert.ok(url.includes('origin=28.5355,77.391'), 'Missing origin coordinates in URL');
});

// -------------------------------------------------------------
// 4. Configuration & Category Metadata Integrity Tests
// -------------------------------------------------------------
console.log('\n4. Configuration & Incident Categories Integrity:');

test('Contains all 7 standard incident categories defined in specification', () => {
  const ids = CONFIG.INCIDENT_CATEGORIES.map(c => c.id);
  assert.ok(ids.includes('harassment'), 'Missing harassment category');
  assert.ok(ids.includes('stalking'), 'Missing stalking category');
  assert.ok(ids.includes('physical_assault'), 'Missing physical assault category');
  assert.ok(ids.includes('threats'), 'Missing threats category');
  assert.ok(ids.includes('cyber_harassment'), 'Missing cyber harassment category');
  assert.ok(ids.includes('unsafe_location'), 'Missing unsafe location category');
  assert.ok(ids.includes('other'), 'Missing other category');
});

test('Contains all 6 verification statuses with matching badge classes', () => {
  const statuses = CONFIG.INCIDENT_STATUSES;
  assert.ok(statuses.submitted && statuses.submitted.badgeClass);
  assert.ok(statuses.pending_review && statuses.pending_review.badgeClass);
  assert.ok(statuses.under_review && statuses.under_review.badgeClass);
  assert.ok(statuses.verified && statuses.verified.badgeClass);
  assert.ok(statuses.rejected && statuses.rejected.badgeClass);
  assert.ok(statuses.resolved && statuses.resolved.badgeClass);
});

test('Contains verified national emergency helpline numbers', () => {
  const numbers = CONFIG.EMERGENCY_HELPLINES.map(h => h.number);
  assert.ok(numbers.includes('112'), 'Missing 112 National Emergency Helpline');
  assert.ok(numbers.includes('1091'), 'Missing 1091 Women Helpline');
});

// Summary
console.log(`\n===========================================`);
console.log(`TEST RUN SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log(`===========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
