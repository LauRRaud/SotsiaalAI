// Sisselogimise järel tagasi lehele, kust inimene tuli.
//
// Leht, mis nõuab kontot, saadab sisselogimata inimese vestluse sisselogimisaknasse.
// Aadress kannab kaasa tee (`next`), mille kirjutada võib igaüks: test hoiab, et
// tagasi viiakse ainult selle saidi enda teele ja et iga selline leht tee kaasa annab.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { loginHref, safeNextPath } from '../lib/safeNextPath.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const ORIGIN = 'https://sotsiaal.pro';
const BACKSLASH = String.fromCharCode(92);

test('tagasitee on ainult selle saidi enda tee', () => {
  assert.equal(safeNextPath('/kiireloomuline-abi', ORIGIN), '/kiireloomuline-abi');
  assert.equal(safeNextPath('/teekond/abc?tab=1#osa', ORIGIN), '/teekond/abc?tab=1#osa');
  assert.equal(safeNextPath(' /toimetulekutoetus ', ORIGIN), '/toimetulekutoetus');
  /* Teine sait, ükskõik mis kujul: tulemus on kas tühi või selle saidi enda tee. */
  const foreign = [
    'https://evil.example/x',
    '//evil.example/x',
    `/${BACKSLASH}evil.example`,
    `${BACKSLASH}${BACKSLASH}evil.example`,
    'evil.example',
    'javascript:alert(1)',
    `/${String.fromCharCode(10)}/evil.example`,
    `/${String.fromCharCode(9)}/evil.example`,
    '/%2F%2Fevil.example'
  ];
  for (const value of foreign) {
    const path = safeNextPath(value, ORIGIN);
    assert.ok(path === '' || (path.startsWith('/') && !path.startsWith('//')), JSON.stringify(value));
    if (path) assert.equal(new URL(path, ORIGIN).origin, ORIGIN, JSON.stringify(value));
  }
  assert.equal(safeNextPath('https://evil.example/x', ORIGIN), '');
  assert.equal(safeNextPath('//evil.example/x', ORIGIN), '');
  assert.equal(safeNextPath(`/${BACKSLASH}evil.example`, ORIGIN), '');
  assert.equal(safeNextPath(`/${String.fromCharCode(10)}/evil.example`, ORIGIN), '');
  /* Tühi, liiga pikk, API ja ring tagasi sisselogimisaknasse. */
  assert.equal(safeNextPath('', ORIGIN), '');
  assert.equal(safeNextPath(null, ORIGIN), '');
  assert.equal(safeNextPath(undefined), '');
  assert.equal(safeNextPath(`/${'a'.repeat(600)}`, ORIGIN), '');
  assert.equal(safeNextPath('/api/auth/signout', ORIGIN), '');
  assert.equal(safeNextPath('/vestlus?login=1&next=/x', ORIGIN), '');
  assert.equal(safeNextPath('/vestlus?workspace=journey', ORIGIN), '/vestlus?workspace=journey');
});

test('sisselogimisakna aadress kannab tee kaasa ja kodeerib selle', () => {
  assert.equal(loginHref('/kiireloomuline-abi'), '/vestlus?login=1&next=%2Fkiireloomuline-abi');
  assert.equal(loginHref('/vestlus?workspace=journey'), '/vestlus?login=1&next=%2Fvestlus%3Fworkspace%3Djourney');
  assert.equal(loginHref(''), '/vestlus?login=1');
  assert.equal(loginHref('https://evil.example'), '/vestlus?login=1');
  /* Aadress loetakse tagasi samaks teeks. */
  const back = new URL(loginHref('/teekond/abc?tab=1'), ORIGIN).searchParams.get('next');
  assert.equal(safeNextPath(back, ORIGIN), '/teekond/abc?tab=1');
});

test('vestlus viib sisse logitud inimese tagasiteele ja lehed annavad tee kaasa', () => {
  const chat = read('../components/alalehed/ChatBody.jsx');
  const start = chat.indexOf('const nextReturnHandledRef = useRef(false);');
  assert.ok(start > 0);
  const effect = chat.slice(start, start + 520);
  for (const piece of [
    'if (!requestLoginOnOpen || status !== "authenticated") return;',
    'const next = safeNextPath(searchParams?.get("next"), window.location.origin);',
    'if (!next) return;',
    'nextReturnHandledRef.current = true;',
    'router.replace(next);'
  ]) {
    assert.ok(effect.includes(piece), piece);
  }
  /* Tee tuleb aadressilt ainult selle ühe kontrolli kaudu. */
  assert.equal(chat.split('get("next")').length - 1, 1);
  assert.ok(read('../app/vestlus/page.js').includes('requestLoginOnOpen={loginRequested || emailVerifiedEntry}'));
  for (const [file, expected] of [
    ['../components/benefits/SubsistenceCalculator.jsx', 'href={loginHref("/toimetulekutoetus")}'],
    ['../components/urgent/UrgentRequestForm.jsx', 'href={loginHref(pathname || "/kiireloomuline-abi")}'],
    ['../app/kovisioon/page.jsx', 'redirect(localizePath(loginHref("/kovisioon"), locale));'],
    ['../app/lopetatud-juhtumid/page.jsx', 'redirect(localizePath(loginHref("/lopetatud-juhtumid"), locale));'],
    ['../app/parimad-praktikad/page.jsx', 'redirect(localizePath(loginHref("/parimad-praktikad"), locale));'],
    ['../app/teemaseemned/page.jsx', 'redirect(localizePath(loginHref("/teemaseemned"), locale));']
  ]) {
    const source = read(file);
    assert.ok(source.includes(expected), file);
    assert.ok(!source.includes('"/vestlus?login=1"'), `${file}: paljast sisselogimise aadressi ei ole`);
  }
});
