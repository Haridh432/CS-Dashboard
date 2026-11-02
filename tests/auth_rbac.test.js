/**
 * Automated Test Suite for CircularSeed Platform
 * Tests authentication, RBAC, tenant isolation, and machine commands.
 */

const assert = require('assert');
const authService = require('../backend/auth/authService');
const machineService = require('../backend/machines/machineService');
const telemetryEngine = require('../backend/telemetry/telemetryEngine');
const db = require('../backend/database/db');

async function runTests() {
    console.log('--- Starting CircularSeed RBAC & Platform Tests ---');

    // 1. Authentication Tests
    console.log('[Test 1] CEO Login with correct credentials');
    const ceoLogin = authService.login('ceo@circularseed.com', 'CircularCEO#2025');
    assert.strictEqual(ceoLogin.success, true, 'CEO login should succeed');
    assert.strictEqual(ceoLogin.user.role, 'CEO');
    assert.ok(ceoLogin.token, 'Should return JWT token');

    console.log('[Test 2] Login with invalid password');
    const badLogin = authService.login('ceo@circularseed.com', 'WrongPassword123');
    assert.strictEqual(badLogin.success, false, 'Invalid password should fail');

    console.log('[Test 3] Token verification');
    const verifiedUser = authService.verifyToken(ceoLogin.token);
    assert.ok(verifiedUser, 'Token should verify successfully');
    assert.strictEqual(verifiedUser.email, 'ceo@circularseed.com');

    // 2. Customer Tests
    console.log('[Test 4] Customer Login');
    const custLogin = authService.login('customer@acme-plastics.com', 'Customer#Acme2025');
    assert.strictEqual(custLogin.success, true);
    assert.strictEqual(custLogin.user.role, 'CUSTOMER');
    assert.strictEqual(custLogin.user.organizationId, 'ORG-ACME');

    // 3. Machine Scoping & Tenant Isolation
    console.log('[Test 5] CEO Fleet Scope: CEO sees all registered machines');
    const ceoMachines = machineService.getMachinesForUser(ceoLogin.user);
    assert.ok(ceoMachines.length >= 6, 'CEO should see all registered machines');

    console.log('[Test 6] Customer Scope: Acme customer sees ONLY Acme machines');
    const custMachines = machineService.getMachinesForUser(custLogin.user);
    assert.ok(custMachines.length > 0, 'Acme customer should have machines');
    for (const m of custMachines) {
        assert.strictEqual(m.organizationId, 'ORG-ACME', `Machine ${m.id} must belong to ORG-ACME`);
        assert.notStrictEqual(m.organizationId, 'ORG-GREENCYCLE', 'Customer must NEVER see other org machines');
    }

    console.log('[Test 7] Operator Scope: Operator 1 sees ONLY assigned CS-FS-0001');
    const op1Login = authService.login('operator@circularseed.com', 'Operator#Flexishred1');
    assert.strictEqual(op1Login.success, true);
    const op1Machines = machineService.getMachinesForUser(op1Login.user);
    assert.strictEqual(op1Machines.length, 1, 'Operator 1 must see exactly 1 assigned machine');
    assert.strictEqual(op1Machines[0].id, 'CS-FS-0001');

    console.log('[Test 8] Operator Scope: Operator 2 sees assigned CS-FS-0002 and CS-FS-0003');
    const op2Login = authService.login('operator2@circularseed.com', 'Operator#Flexishred2');
    const op2Machines = machineService.getMachinesForUser(op2Login.user);
    assert.strictEqual(op2Machines.length, 2, 'Operator 2 must see 2 assigned machines');
    const op2Ids = op2Machines.map(m => m.id);
    assert.ok(op2Ids.includes('CS-FS-0002'));
    assert.ok(op2Ids.includes('CS-FS-0003'));

    // 4. Command Execution & Safety Rules
    console.log('[Test 9] Customer cannot issue machine commands (Permission check)');
    assert.strictEqual(custLogin.user.permissions.canControlMachine, false, 'Customer must not have control permission');

    console.log('[Test 10] Operator command on assigned machine');
    const stopResult = telemetryEngine.handleCommand('CS-FS-0001', op1Login.user, 'STOP');
    assert.strictEqual(stopResult.accepted, true, 'Operator should be able to execute STOP on assigned machine');

    console.log('[Test 11] Safety Interlock: START rejected when E-Stop is active');
    telemetryEngine.injectFault('CS-FS-0001', 'TOGGLE_ESTOP');
    const startResult = telemetryEngine.handleCommand('CS-FS-0001', op1Login.user, 'START');
    assert.strictEqual(startResult.accepted, false, 'START must be rejected when E-Stop is active');
    assert.ok(startResult.error.includes('Emergency-Stop'), 'Error must specify emergency stop');

    // Reset E-Stop for cleanup
    telemetryEngine.injectFault('CS-FS-0001', 'TOGGLE_ESTOP');

    console.log('[Test 12] Fleet summary metrics for CEO');
    const ceoSummary = machineService.getCeoFleetSummary();
    assert.ok(ceoSummary.totalRegistered >= 6, 'CEO summary total registered calculation');
    assert.ok(typeof ceoSummary.activeFaults === 'number', 'Active faults calculated');

    console.log('[Test 13] Historical telemetry retrieval');
    const history = machineService.getMachineHistory('CS-FS-0001', '24h');
    assert.ok(Array.isArray(history), 'History should be an array');
    assert.ok(history.length > 0, 'Should return seeded historical telemetry points');

    console.log('[Test 14] CEO can add a new machine to the fleet');
    const ceoNewMachine = machineService.createMachine({
        id: 'CS-FS-0099',
        model: 'FLEXISHRED-DC Pro',
        organizationId: 'ORG-ACME',
        location: 'Test Testing Lab',
        state: 'READY'
    }, ceoLogin.user);
    assert.strictEqual(ceoNewMachine.id, 'CS-FS-0099');
    assert.strictEqual(ceoNewMachine.organization_id, 'ORG-ACME');

    console.log('[Test 15] Customer can add machine scoped strictly to their org');
    const custNewMachine = machineService.createMachine({
        id: 'CS-FS-0098',
        model: 'FLEXISHRED-DC Std',
        organizationId: 'ORG-GREENCYCLE', // Trying to spoof org
        location: 'Acme Test Line',
        state: 'STOPPED'
    }, custLogin.user);
    assert.strictEqual(custNewMachine.id, 'CS-FS-0098');
    assert.strictEqual(custNewMachine.organization_id, 'ORG-ACME', 'Customer machine must be scoped to their own org');

    console.log('[Test 16] Operator is rejected from adding a machine');
    assert.throws(() => {
        machineService.createMachine({ id: 'CS-FS-0097' }, op1Login.user);
    }, /Access denied/);

    console.log('[Test 17] Customer cannot delete a machine belonging to another organization');
    assert.throws(() => {
        machineService.deleteMachine('CS-FS-0004', custLogin.user); // CS-FS-0004 belongs to ORG-GREENCYCLE
    }, /Access denied/);

    console.log('[Test 18] Customer and CEO can delete authorized machines');
    const deletedByCust = machineService.deleteMachine('CS-FS-0098', custLogin.user);
    assert.strictEqual(deletedByCust.id, 'CS-FS-0098');
    const deletedByCeo = machineService.deleteMachine('CS-FS-0099', ceoLogin.user);
    assert.strictEqual(deletedByCeo.id, 'CS-FS-0099');

    console.log('\n>>> ALL 18 TEST CASES PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
