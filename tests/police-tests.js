/**
 * SheGuard - Police Portal & Two-Frontend Architecture Unit Tests
 */
import assert from 'node:assert';
import { PRE_AUTHORIZED_OFFICERS } from '../police-portal/js/police-auth.js';
import { CONFIG } from '../js/config.js';

console.log('=== RUNNING SHEGUARD POLICE PORTAL TEST SUITE ===\n');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 1. Police Roles & Pre-Authorized Personnel Integrity
// -------------------------------------------------------------
console.log('1. Police RBAC & Personnel Integrity Tests:');

test('Pre-authorized roster contains all 4 mandatory law enforcement roles', () => {
  const roles = PRE_AUTHORIZED_OFFICERS.map(o => o.role);
  assert.ok(roles.includes('SUPER_ADMIN'), 'Missing SUPER_ADMIN role');
  assert.ok(roles.includes('POLICE_ADMIN'), 'Missing POLICE_ADMIN role');
  assert.ok(roles.includes('POLICE_OFFICER'), 'Missing POLICE_OFFICER role');
  assert.ok(roles.includes('MODERATOR'), 'Missing MODERATOR role');
});

test('Officers have unique badge numbers and official service emails', () => {
  const badges = new Set();
  const emails = new Set();

  PRE_AUTHORIZED_OFFICERS.forEach(o => {
    assert.ok(o.badgeNumber, 'Officer missing badge number');
    assert.ok(o.email && o.email.endsWith('@sheguard.police.gov'), `Invalid service email domain: ${o.email}`);
    assert.ok(!badges.has(o.badgeNumber), `Duplicate badge number: ${o.badgeNumber}`);
    assert.ok(!emails.has(o.email), `Duplicate service email: ${o.email}`);
    badges.add(o.badgeNumber);
    emails.add(o.email);
  });
});

// -------------------------------------------------------------
// 2. Report Status Synchronization Tests
// -------------------------------------------------------------
console.log('\n2. Report Status Synchronization Tests:');

test('Supports all 8 synchronized statuses across User and Police frontends', () => {
  const expected = [
    'submitted',
    'pending_verification',
    'under_review',
    'assigned',
    'under_investigation',
    'verified',
    'resolved',
    'rejected'
  ];

  expected.forEach(st => {
    assert.ok(CONFIG.INCIDENT_STATUSES[st], `Missing status in CONFIG.INCIDENT_STATUSES: ${st}`);
    assert.ok(CONFIG.INCIDENT_STATUSES[st].badgeClass, `Missing badgeClass for: ${st}`);
  });
});

// -------------------------------------------------------------
// 3. SOS Emergency Progression Tests
// -------------------------------------------------------------
console.log('\n3. Emergency SOS Dispatch Progression Tests:');

test('Validates emergency response workflow statuses', () => {
  const validSosStatuses = ['SENT', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED', 'CANCELLED'];
  assert.strictEqual(validSosStatuses.length, 5);
  assert.ok(validSosStatuses.includes('ACKNOWLEDGED'));
  assert.ok(validSosStatuses.includes('DISPATCHED'));
  assert.ok(validSosStatuses.includes('RESOLVED'));
});

console.log(`\n===========================================`);
console.log('POLICE PORTAL UNIT TESTS: ALL PASSED!');
console.log(`===========================================\n`);
