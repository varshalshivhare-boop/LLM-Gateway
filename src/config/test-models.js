// ─────────────────────────────────────────────
//  src/config/test-models.js
//  Run this to check which Gemini models are
//  available for your current API key.
//
//  Usage:  node src/config/test-models.js
// ─────────────────────────────────────────────

require('dotenv').config();
const https = require('https');

const key = process.env.GEMINI_API_KEY;

if (!key) {
  console.error('❌  GEMINI_API_KEY not found in .env');
  process.exit(1);
}

// All known Gemini models to test
const MODELS_TO_TEST = [
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

function testModel(model) {
  return new Promise(resolve => {
    const body = JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => { resolve({ model, status: res.statusCode }); res.resume(); }
    );
    req.on('error', e => resolve({ model, status: 'ERROR', error: e.message }));
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('\n=== Gemini Model Availability Test ===\n');

  const results = await Promise.all(MODELS_TO_TEST.map(testModel));
  const working = [];

  results.forEach(({ model, status, error }) => {
    let icon, note;
    if (status === 200)      { icon = '✅'; note = 'WORKING';             working.push(model); }
    else if (status === 503) { icon = '⚠️ '; note = 'OVERLOADED (retry)'; working.push(model); }
    else if (status === 429) { icon = '⚠️ '; note = 'RATE LIMITED (retry)'; }
    else if (status === 404) { icon = '❌'; note = 'NOT FOUND (deprecated)'; }
    else if (status === 403) { icon = '❌'; note = 'FORBIDDEN (bad/missing API key)'; }
    else                     { icon = '❌'; note = `status ${status} ${error || ''}`; }

    console.log(`  ${icon}  ${model.padEnd(25)} → ${note}`);
  });

  console.log('\n─────────────────────────────────────');
  if (working.length > 0) {
    console.log('✅  Add these to FALLBACK_MODELS in model.config.ts:');
    working.forEach(m => console.log(`     '${m}',`));
  } else {
    console.log('⚠️   No working models found. Check your GEMINI_API_KEY in .env');
    console.log('     Get a key from: https://aistudio.google.com/apikey');
    console.log('     Key must start with: AIzaSy...');
  }
  console.log('');
})();
