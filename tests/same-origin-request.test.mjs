// PÄRITOLU KONTROLL — muutev päring peab tulema meie oma lehelt.
//
// Viga, mida see fail kinni hoiab (leitud päris lehel 11.10.2026): päris serveris on `request.url`
// sisemine aadress (`https://127.0.0.1:3000/...`), brauseri `Origin` aga avalik aadress. Kontroll,
// mis võrdles ainult neid kahte, keeldus igast päringust: halduri esindusõiguse kinnitus, kinnituslingi
// küsimine, kättesaadavuse kinnitus ja halduri kättesaadavuse leht vastasid alati 403.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSameOriginRequest } from '../lib/security/sameOriginRequest.js';

const ENV_KEYS = ['NEXTAUTH_URL', 'AUTH_URL', 'APP_URL'];

function request(url, origin) {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  return { url, headers };
}

function withEnv(values, run) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const INTERNAL = 'https://127.0.0.1:3000/api/admin/service-representation';

test('päris server: avalikult aadressilt tulnud päring on oma, kuigi päringu aadress on sisemine', () => {
  withEnv({ NEXTAUTH_URL: 'https://sotsiaal.pro' }, () => {
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://sotsiaal.pro')), true);
    // Seadistuses võib aadressil olla tee või lõpukriips: loeb ainult päritolu.
    process.env.NEXTAUTH_URL = 'https://sotsiaal.pro/';
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://sotsiaal.pro')), true);
  });
  // Sama viga ilma seadistuseta: ainult päringu aadressi vastu võrreldes vastus on „ei".
  withEnv({}, () => assert.equal(isSameOriginRequest(request(INTERNAL, 'https://sotsiaal.pro')), false));
});

test('võõras leht ei ole oma, ka sarnase nime, teise protokolli või pordiga', () => {
  withEnv({ NEXTAUTH_URL: 'https://sotsiaal.pro' }, () => {
    for (const origin of [
      'https://evil.example',
      'https://sotsiaal.pro.evil.example',
      'https://evil-sotsiaal.pro',
      'http://sotsiaal.pro',
      'https://sotsiaal.pro:8443',
      'https://www.sotsiaal.pro',
      'null'
    ]) {
      assert.equal(isSameOriginRequest(request(INTERNAL, origin)), false, origin);
    }
  });
});

test('päritoluta või loetamatu päring ei ole oma; päiseid Host ja X-Forwarded-Host ei usaldata', () => {
  withEnv({ NEXTAUTH_URL: 'https://sotsiaal.pro' }, () => {
    assert.equal(isSameOriginRequest(request(INTERNAL)), false);
    assert.equal(isSameOriginRequest(request(INTERNAL, '')), false);
    assert.equal(isSameOriginRequest(request(INTERNAL, 'mitte aadress')), false);
    assert.equal(isSameOriginRequest(null), false);
    assert.equal(isSameOriginRequest({ url: 'mitte aadress', headers: new Headers({ origin: 'https://sotsiaal.pro' }) }), false);
    const spoofed = request(INTERNAL, 'https://evil.example');
    spoofed.headers.set('host', 'evil.example');
    spoofed.headers.set('x-forwarded-host', 'evil.example');
    assert.equal(isSameOriginRequest(spoofed), false);
  });
});

test('arendus: päringu enda aadress on oma ka ilma seadistuseta', () => {
  withEnv({}, () => {
    assert.equal(isSameOriginRequest(request('http://localhost:3000/api/x', 'http://localhost:3000')), true);
    assert.equal(isSameOriginRequest(request('http://localhost:3000/api/x', 'http://localhost:3001')), false);
  });
});

test('kõik seadistatud aadressid loevad; vigane seadistus ei luba midagi juurde', () => {
  withEnv({ AUTH_URL: 'https://a.example', APP_URL: 'https://b.example/app' }, () => {
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://a.example')), true);
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://b.example')), true);
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://c.example')), false);
  });
  withEnv({ NEXTAUTH_URL: 'mitte aadress' }, () => {
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://sotsiaal.pro')), false);
    assert.equal(isSameOriginRequest(request(INTERNAL, 'https://127.0.0.1:3000')), true);
  });
});

test('neli muutvat teed kasutavad seda kontrolli pärast õiguse kontrolli', () => {
  for (const path of [
    '../app/api/admin/service-representation/route.js',
    '../app/api/admin/service-availability/route.js',
    '../app/api/service-provider/profile/representation/route.js',
    '../app/api/service-provider/profile/services/[serviceId]/availability-confirmation/route.js'
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /if \(!isSameOriginRequest\(request\)\) return errorJson\("api\.common\.forbidden", 403/u, path);
  }
});
