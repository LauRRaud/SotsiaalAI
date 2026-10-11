// Sisselogimise järel tagasi lehele, kust inimene tuli.
//
// Leht, mis nõuab kontot, saadab sisselogimata inimese vestluse sisselogimisaknasse.
// Aadress kannab kaasa tee (`next`), mille kirjutada võib igaüks: test hoiab, et
// tagasi viiakse ainult selle saidi enda teele ja et iga selline leht tee kaasa annab.
import test from 'node:test';
import assert from 'node:assert/strict';

import { loginHref, safeNextPath } from '../lib/safeNextPath.js';

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
