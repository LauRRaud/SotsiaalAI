// Teenuse ja teeninduskoha olek profiili salvestamisel.
//
// VIGA, mida see test hoiab: olemasoleva kirje puhul tagastas reegel alati selle
// senise oleku, kui küsiti PUBLISHED. Vorm saadab iga kirje oleku alati kaasa,
// nii et kord avaldamata salvestatud teenust ega teeninduskohta ei saanud enam
// kunagi avaldada, kuigi vorm näitas „Avaldatud" ja salvestamine õnnestus.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { preserveServiceProviderChildStatus } from '../lib/serviceProviderProfilePolicy.js';
import { normalizeServiceProviderServiceInput } from '../lib/serviceProviderProfiles.js';

test('tagasivõtmine kehtib alati', () => {
  for (const explicit of [true, false]) {
    assert.equal(preserveServiceProviderChildStatus({ status: 'PUBLISHED' }, 'DRAFT', { explicit }), 'DRAFT');
    assert.equal(preserveServiceProviderChildStatus({ status: 'PUBLISHED' }, 'REVIEW', { explicit }), 'REVIEW');
    assert.equal(preserveServiceProviderChildStatus(null, 'DRAFT', { explicit }), 'DRAFT');
  }
});

test('sõnaselge avaldamine kehtib ka kirjel, mis oli enne avaldamata', () => {
  assert.equal(preserveServiceProviderChildStatus({ status: 'DRAFT' }, 'PUBLISHED', { explicit: true }), 'PUBLISHED');
  assert.equal(preserveServiceProviderChildStatus({ status: 'REVIEW' }, 'PUBLISHED', { explicit: true }), 'PUBLISHED');
  assert.equal(preserveServiceProviderChildStatus({ status: 'PUBLISHED' }, 'PUBLISHED', { explicit: true }), 'PUBLISHED');
  assert.equal(preserveServiceProviderChildStatus(null, 'PUBLISHED', { explicit: true }), 'PUBLISHED');
});

test('vaikeväärtusest tulnud PUBLISHED ei avalda olemasolevat kirjet uuesti', () => {
  assert.equal(preserveServiceProviderChildStatus({ status: 'DRAFT' }, 'PUBLISHED'), 'DRAFT');
  assert.equal(preserveServiceProviderChildStatus({ status: 'REVIEW' }, 'PUBLISHED', { explicit: false }), 'REVIEW');
  /* Uus kirje (olemasolevat ei ole) saab vaikeväärtuse. */
  assert.equal(preserveServiceProviderChildStatus(null, 'PUBLISHED'), 'PUBLISHED');
});

test('teenuse normaliseerija: vormis valitud „Avaldatud" jõuab salvestusse', () => {
  const published = { status: 'PUBLISHED' };
  const service = (input, existing) => normalizeServiceProviderServiceInput({ name: 'Koduteenus', ...input }, 0, published, existing);
  /* Kord avaldamata salvestatud teenus, mille inimene nüüd avaldab. */
  assert.equal(service({ status: 'PUBLISHED' }, { status: 'DRAFT' }).status, 'PUBLISHED');
  /* Päring ilma teenuse olekuta: avaldatud profiili vaikeväärtus ei avalda avaldamata teenust. */
  assert.equal(service({}, { status: 'DRAFT' }).status, 'DRAFT');
  assert.equal(service({ status: 'tundmatu' }, { status: 'DRAFT' }).status, 'DRAFT');
  /* Tagasivõtmine. */
  assert.equal(service({ status: 'DRAFT' }, { status: 'PUBLISHED' }).status, 'DRAFT');
  /* Uus teenus avaldatud profiilis saab profiili vaikeoleku. */
  assert.equal(service({}, null).status, 'PUBLISHED');
  assert.equal(normalizeServiceProviderServiceInput({ name: 'Koduteenus' }, 0, { status: 'DRAFT' }, null).status, 'DRAFT');
});

test('teeninduskoht ja teenus kasutavad sama reeglit sõnaselge märkega', () => {
  const source = fs.readFileSync(new URL('../lib/serviceProviderProfiles.js', import.meta.url), 'utf8');
  assert.equal(source.split('{ explicit: hasExplicitChildStatus(input.status) }').length - 1, 2);
  assert.equal(source.split('preserveServiceProviderChildStatus(').length - 1, 2, 'reeglit ei kutsuta kusagil ilma märketa');
  /* Vananenud vorm ei saa salvestada: reegel toetub sellele kaitsele. */
  assert.ok(source.includes('existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()'));
});
