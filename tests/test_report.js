const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let buf = '';
            res.on('data', chunk => buf += chunk);
            res.on('end', () => resolve(JSON.parse(buf)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function getBinary(path, token) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                buffer: Buffer.concat(chunks),
                headers: res.headers
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

function get(path, token) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            let buf = '';
            res.on('data', chunk => buf += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: buf, headers: res.headers }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('Logging in as CEO...');
    const login = await post('/api/auth/login', { email: 'ceo@circularseed.com', password: 'CircularCEO#2025' });
    if (!login.success) throw new Error('Login failed: ' + login.error);
    const token = login.token;
    console.log('Logged in successfully, token received.');

    // 1. Test Native PDF Binary Stream
    console.log('\n--- Test 1: Native PDF Binary Stream Export (/api/machines/CS-FS-0004/export?format=pdf) ---');
    const pdfRes = await getBinary('/api/machines/CS-FS-0004/export?format=pdf', token);
    console.log('Response Status:', pdfRes.status);
    console.log('Content-Type:', pdfRes.headers['content-type']);
    console.log('Content-Disposition:', pdfRes.headers['content-disposition']);
    console.log('PDF File Size:', pdfRes.buffer.length, 'bytes');

    const isPdfHeader = pdfRes.buffer.slice(0, 4).toString() === '%PDF';
    console.log('  [PASS] Has valid PDF magic header (%PDF):', isPdfHeader);
    console.log('  [PASS] Content-Type is application/pdf:', pdfRes.headers['content-type'] === 'application/pdf');
    console.log('  [PASS] Content-Disposition has attachment filename:', pdfRes.headers['content-disposition'].includes('attachment; filename='));

    if (!isPdfHeader || pdfRes.headers['content-type'] !== 'application/pdf') {
        throw new Error('Native PDF export failed validation.');
    }

    // 2. Test HTML Report Alignment & Fixes
    console.log('\n--- Test 2: HTML Detailed Report Alignment & Layout (/api/machines/CS-FS-0004/export?format=html) ---');
    const htmlRes = await get('/api/machines/CS-FS-0004/export?format=html', token);
    console.log('Response Status:', htmlRes.status);
    console.log('Content-Type:', htmlRes.headers['content-type']);
    console.log('HTML Length:', htmlRes.data.length, 'bytes');

    const checks = [
        'CircularSeed',
        'FLEXISHRED-DC',
        'report-top-stripe',
        'report-id-badge',
        'Detailed Machine Technical &amp; Operational Audit Report',
        '1. Master Asset Profile &amp; Technical Specifications',
        '2. Real-Time Operational Performance &amp; Sensor Telemetry',
        '3. Safety Integrity Level (SIL) &amp; Interlock Compliance Audit',
        '4. 24-Hour Duty Cycle Analytics &amp; Statistical Envelope',
        '5. Recent Telemetry Log Samples',
        '6. Comprehensive Servicing, Overhaul &amp; Maintenance History',
        '7. Operational Event Log &amp; Diagnostic Incident Records',
        'Lead Field Service Engineer',
        'Plant Operations &amp; Safety Manager',
        'AS/NZS 4024.1',
        'Est. Plastic Shredded',
        'Est. CO2e Abated'
    ];

    let allPassed = true;
    for (const check of checks) {
        const found = htmlRes.data.includes(check);
        console.log(`  [${found ? 'PASS' : 'FAIL'}] Contains "${check}"`);
        if (!found) allPassed = false;
    }

    // Check that the overlapping absolute pseudo-element is removed
    const hasBadBefore = htmlRes.data.includes('.report-paper::before');
    console.log(`  [${!hasBadBefore ? 'PASS' : 'FAIL'}] Absolute overlapping .report-paper::before removed: ${!hasBadBefore}`);
    if (hasBadBefore) allPassed = false;

    if (allPassed) {
        console.log('\n>>> ALL PDF & REPORT VERIFICATIONS PASSED SUCCESSFULLY! <<<');
    } else {
        console.error('\n>>> SOME CHECKS FAILED! <<<');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
