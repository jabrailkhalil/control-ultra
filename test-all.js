/**
 * Control Ultra — Full System Test
 * Тестирует ВСЕ аспекты проекта
 */

const http = require('http');

const BASE = 'http://127.0.0.1:3777';
let passed = 0;
let failed = 0;
const errors = [];

function req(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch { resolve({ status: res.statusCode, data: d }); }
            });
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
    });
}

function test(name, condition, detail) {
    if (condition) {
        passed++;
        console.log(`  [PASS] ${name}`);
    } else {
        failed++;
        const msg = `${name}: ${detail || 'FAILED'}`;
        errors.push(msg);
        console.log(`  [FAIL] ${name} -- ${detail || ''}`);
    }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    console.log('');
    console.log('==============================================');
    console.log(' CONTROL ULTRA — FULL SYSTEM TEST');
    console.log('==============================================');
    console.log('');

    // ── 1. STATUS ──
    console.log('[1] STATUS & MONITORING');
    try {
        const r = await req('GET', '/api/status');
        test('GET /api/status returns 200', r.status === 200);
        test('superMode is boolean', typeof r.data.superMode === 'boolean');
        test('engine has queueLength', typeof r.data.engine.queueLength === 'number');
        test('uptime is number', typeof r.data.uptime === 'number');
        test('platform is win32', r.data.platform === 'win32');
        test('nodeVersion exists', !!r.data.nodeVersion);
        test('memoryUsage exists', !!r.data.memoryUsage);
    } catch (e) { test('STATUS endpoint', false, e.message); }

    // ── 2. CONFIG ──
    console.log('\n[2] CONFIG (SuperFile)');
    try {
        const r = await req('GET', '/api/config');
        test('GET /api/config returns 200', r.status === 200);
        test('config has superMode', 'superMode' in r.data);
        test('config has permissions', !!r.data.permissions);
        test('config has safety', !!r.data.safety);
        test('config has autoApprove', !!r.data.autoApprove);
        test('config has processGuard', !!r.data.processGuard);
        test('blockedCommands is array', Array.isArray(r.data.safety.blockedCommands));
    } catch (e) { test('CONFIG endpoint', false, e.message); }

    // ── 3. COMMAND EXECUTION ──
    console.log('\n[3] COMMAND EXECUTION');
    try {
        const r = await req('POST', '/api/commands', { command: 'echo TEST_PASS_123' });
        test('POST /api/commands returns success', r.data.success === true);
        test('command has id', !!r.data.command.id);
        test('command has status', !!r.data.command.status);
        test('command has pid or queued', r.data.command.pid > 0 || r.data.command.status === 'queued');

        // Wait for completion
        await sleep(2000);
        const r2 = await req('GET', '/api/commands/' + r.data.command.id);
        test('GET /api/commands/:id works', r2.status === 200);
        test('command completed', r2.data.status === 'completed');
        test('exit code is 0', r2.data.exitCode === 0);
        test('output contains TEST_PASS_123', (r2.data.output || []).join('').includes('TEST_PASS_123'));
    } catch (e) { test('COMMAND EXECUTION', false, e.message); }

    // ── 4. BLOCKED COMMANDS ──
    console.log('\n[4] BLOCKED COMMANDS (Safety)');
    try {
        const r1 = await req('POST', '/api/commands', { command: 'format C:' });
        test('format C: is blocked', r1.data.success === false);
        test('blocked has reason', !!r1.data.command.reason);

        const r2 = await req('POST', '/api/commands', { command: 'del /s /q C:\\' });
        test('del /s /q C:\\ is blocked', r2.data.success === false);

        const r3 = await req('POST', '/api/commands', { command: 'shutdown /s' });
        test('shutdown /s is blocked', r3.data.success === false);

        const r4 = await req('POST', '/api/commands', { command: 'rm -rf /' });
        test('rm -rf / is blocked', r4.data.success === false);
    } catch (e) { test('BLOCKED COMMANDS', false, e.message); }

    // ── 5. BATCH COMMANDS ──
    console.log('\n[5] BATCH COMMANDS');
    try {
        const r = await req('POST', '/api/commands/batch', {
            commands: [
                { command: 'echo BATCH_1' },
                { command: 'echo BATCH_2' },
                { command: 'echo BATCH_3' },
            ]
        });
        test('batch returns success', r.data.success === true);
        test('batch has 3 commands', r.data.commands.length === 3);
        test('all commands have ids', r.data.commands.every(c => !!c.id));
    } catch (e) { test('BATCH COMMANDS', false, e.message); }

    // ── 6. HISTORY ──
    console.log('\n[6] HISTORY');
    await sleep(2000);
    try {
        const r = await req('GET', '/api/history?limit=10');
        test('GET /api/history returns array', Array.isArray(r.data));
        test('history has entries', r.data.length > 0);
        test('history entry has command', !!r.data[0].command);
        test('history entry has status', !!r.data[0].status);
    } catch (e) { test('HISTORY', false, e.message); }

    // ── 7. ENVIRONMENT DETECTION ──
    console.log('\n[7] ENVIRONMENT DETECTION');
    try {
        const r = await req('GET', '/api/env');
        test('GET /api/env returns 200', r.status === 200);
        test('system.platform exists', !!r.data.system.platform);
        test('system.cpus is number', typeof r.data.system.cpus === 'number');
        test('runtimes.node exists', !!r.data.runtimes.node);
        test('packageManagers.npm exists', !!r.data.packageManagers.npm);
        test('tools.git exists', !!r.data.tools.git);
        test('shells.powershell exists', !!r.data.shells.powershell);
    } catch (e) { test('ENV DETECTION', false, e.message); }

    // ── 8. PROJECT ANALYSIS ──
    console.log('\n[8] PROJECT ANALYSIS');
    try {
        const r = await req('POST', '/api/env/analyze', { path: process.cwd() });
        test('analyze returns type', !!r.data.type);
        test('type is node', r.data.type === 'node');
        test('language includes javascript', r.data.language.includes('javascript'));
        test('framework is express', r.data.framework === 'express');
        test('packageManager is npm', r.data.packageManager === 'npm');
        test('has dependencies', !!r.data.dependencies);
        test('dependencies include express', r.data.dependencies.production.includes('express'));
    } catch (e) { test('PROJECT ANALYSIS', false, e.message); }

    // ── 9. PROJECT READINESS CHECK ──
    console.log('\n[9] PROJECT READINESS CHECK');
    try {
        const r = await req('POST', '/api/env/check', { path: process.cwd() });
        test('check returns ready', typeof r.data.ready === 'boolean');
        test('installed is array', Array.isArray(r.data.installed));
        test('suggestion exists', !!r.data.suggestion);
        test('node is installed', r.data.installed.some(i => i.tool === 'node'));
    } catch (e) { test('READINESS CHECK', false, e.message); }

    // ── 10. FILE OPERATIONS ──
    console.log('\n[10] FILE OPERATIONS');
    const testFile = process.cwd() + '\\test_cu_temp.txt';
    try {
        // Create
        const r1 = await req('POST', '/api/files/create', { path: testFile, content: 'Hello Line1\nWorld Line2\nTest Line3\n' });
        test('file create success', r1.data.success === true);

        // Read
        const r2 = await req('POST', '/api/files/read', { path: testFile });
        test('file read success', r2.data.success === true);
        test('file content correct', r2.data.content.includes('Hello Line1'));
        test('file content has multiple lines', r2.data.content.split('\n').length >= 2);

        // Exists
        const r3 = await req('POST', '/api/files/exists', { path: testFile });
        test('file exists', r3.data.exists === true);
        test('type is file', r3.data.type === 'file');

        // Append
        const r4 = await req('POST', '/api/files/append', { path: testFile, content: 'Appended Line4\n' });
        test('file append success', r4.data.success === true);

        // Replace
        const r5 = await req('POST', '/api/files/replace', { path: testFile, search: 'World', replacement: 'UNIVERSE' });
        test('file replace success', r5.data.success === true);
        test('replaced 1 occurrence', r5.data.replacements === 1);

        // Verify replace worked
        const r6 = await req('POST', '/api/files/read', { path: testFile });
        test('replace applied correctly', r6.data.content.includes('UNIVERSE'));

        // Insert at line
        const r7 = await req('POST', '/api/files/insert-line', { path: testFile, line: 2, content: 'INSERTED' });
        test('insert at line success', r7.data.success === true);

        // Delete lines
        const r8 = await req('POST', '/api/files/delete-lines', { path: testFile, from: 2, to: 2 });
        test('delete lines success', r8.data.success === true);

        // Remove (cleanup)
        const r9 = await req('POST', '/api/files/remove', { path: testFile });
        test('file remove success', r9.data.success === true);

        // Verify removed
        const r10 = await req('POST', '/api/files/exists', { path: testFile });
        test('file no longer exists', r10.data.exists === false);
    } catch (e) { test('FILE OPS', false, e.message); }

    // ── 11. FILE SEARCH/TREE/LIST ──
    console.log('\n[11] FILE SEARCH/TREE/LIST');
    try {
        const r1 = await req('POST', '/api/files/tree', { path: process.cwd() + '\\src', maxDepth: 2 });
        test('tree returns success', r1.data.success === true);
        test('tree has content', r1.data.tree.length > 10);

        const r2 = await req('POST', '/api/files/list', { path: process.cwd() + '\\src\\modules', options: {} });
        test('list returns success', r2.data.success === true);
        test('list has files', r2.data.count > 0);

        const r3 = await req('POST', '/api/files/search', { path: process.cwd() + '\\src\\modules', query: 'constructor' });
        test('search returns results', r3.data.success === true);
        test('search found matches', r3.data.count > 0);
    } catch (e) { test('FILE SEARCH', false, e.message); }

    // ── 12. SCAFFOLD TEMPLATES ──
    console.log('\n[12] SCAFFOLD TEMPLATES');
    try {
        const r1 = await req('GET', '/api/scaffold/templates');
        test('templates returns array', Array.isArray(r1.data));
        test('has 8 templates', r1.data.length === 8);
        test('has node-basic', r1.data.some(t => t.id === 'node-basic'));
        test('has python-flask', r1.data.some(t => t.id === 'python-flask'));

        // Scaffold a test project
        const testProjDir = process.cwd() + '\\test_scaffold_temp';
        const r2 = await req('POST', '/api/scaffold/create', { template: 'node-basic', name: 'test-project', path: testProjDir });
        test('scaffold creates project', r2.data.success === true);
        test('scaffold created files', r2.data.files.length > 0);

        // Verify files created
        const r3 = await req('POST', '/api/files/exists', { path: testProjDir + '\\package.json' });
        test('scaffolded package.json exists', r3.data.exists === true);

        const r4 = await req('POST', '/api/files/read', { path: testProjDir + '\\package.json' });
        test('package.json has project name', r4.data.content.includes('test-project'));

        // Cleanup
        await req('POST', '/api/files/remove', { path: testProjDir });
    } catch (e) { test('SCAFFOLD', false, e.message); }

    // ── 13. CONFIG OPERATIONS ──
    console.log('\n[13] CONFIG OPERATIONS');
    try {
        // Toggle super mode off then on
        const r1 = await req('POST', '/api/config/toggle-super');
        test('toggle super returns success', r1.data.success === true);
        test('super mode toggled', typeof r1.data.superMode === 'boolean');

        // Toggle back
        const r2 = await req('POST', '/api/config/toggle-super');
        test('toggle back works', r2.data.success === true);
    } catch (e) { test('CONFIG OPS', false, e.message); }

    // ── 14. COMMAND WITH CWD ──
    console.log('\n[14] COMMAND WITH OPTIONS');
    try {
        const r = await req('POST', '/api/commands', {
            command: 'echo CWD_TEST',
            cwd: process.cwd(),
            timeout: 5000,
        });
        test('command with cwd accepted', r.data.success === true);
        await sleep(1000);
        const r2 = await req('GET', '/api/commands/' + r.data.command.id);
        test('command with options completed', r2.data.status === 'completed');
    } catch (e) { test('COMMAND OPTIONS', false, e.message); }

    // ── 15. INVALID REQUESTS ──
    console.log('\n[15] ERROR HANDLING');
    try {
        const r1 = await req('POST', '/api/commands', {});
        test('empty command returns error', r1.status === 400);

        const r2 = await req('GET', '/api/commands/nonexistent-id');
        test('nonexistent command returns 404', r2.status === 404);

        const r3 = await req('POST', '/api/commands/batch', { commands: [] });
        test('empty batch returns error', r3.status === 400);

        const r4 = await req('POST', '/api/scaffold/create', { template: 'nonexistent' });
        test('invalid template returns error', r4.status === 400);
    } catch (e) { test('ERROR HANDLING', false, e.message); }

    // ── RESULTS ──
    console.log('');
    console.log('==============================================');
    console.log(` TEST RESULTS: ${passed} PASSED / ${failed} FAILED / ${passed + failed} TOTAL`);
    console.log('==============================================');
    if (errors.length > 0) {
        console.log('');
        console.log('FAILURES:');
        errors.forEach(e => console.log('  - ' + e));
    }
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
