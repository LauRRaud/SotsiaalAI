import test from 'node:test';
import assert from 'node:assert/strict';
import { pointChanges, decidePoints, refreshedPointPages } from '../lib/rag-v2/assistive-refresh.js';
import { pointSources } from '../lib/rag-v2/assistive-points.js';

// ADR-098: the monthly refresh of the assistive device information. The rule for collected data (owner, 04.10.2026):
// a change is applied on the second reading that shows it, and nothing is deleted by itself.
const tartu = { id: 'tartu_linn', name: 'Tartu linn' }, elva = { id: 'elva_vald', name: 'Elva vald' };
const point = (name, municipality, extra = {}) => ({ key: `${name.toLowerCase()}|tn 1|58.3,26.7`, name, address: 'Tn 1', lat: 58.3, lon: 26.7, website: null, phone: '55550001', email: null,
  municipalities: [municipality], counties: ['Tartu maakond'], offers: [{ category: 'Liikumisabivahendid', service: 'müük' }], ...extra });
const accepted = [point('Abipood', tartu), point('Kuulmiskeskus', tartu, { offers: [{ category: 'Kuulmisabivahendid', service: 'müük' }] }), point('Vana pood', elva)];

test('a reading\'s changes: a new point, a changed one, one that is gone; the same values in another order are no change', () => {
  const read = [point('Abipood', tartu, { phone: '55550009' }), { ...point('Kuulmiskeskus', tartu, { offers: [{ category: 'Kuulmisabivahendid', service: 'müük' }] }), counties: ['Tartu maakond'] }, point('Uus pood', elva)];
  const changes = pointChanges(accepted, read);
  assert.deepEqual(changes.map(change => [change.kind, change.name, change.where]), [['changed', 'Abipood', 'Tartu linn'], ['added', 'Uus pood', 'Elva vald'], ['removed', 'Vana pood', 'Elva vald']]);
  assert.deepEqual(pointChanges(accepted, accepted.map(item => ({ ...item, offers: [...item.offers].reverse() }))), []);
  // What a change leads to is part of what it is: another new value is another change.
  assert.notEqual(changes[0].hash, pointChanges(accepted, [point('Abipood', tartu, { phone: '55550008' }), ...read.slice(1)])[0].hash);
});

test('a change is proposed by the first reading that shows it and applied by the second; a removal waits for a person', () => {
  const read = [point('Abipood', tartu, { phone: '55550009' }), accepted[1], point('Uus pood', elva)];
  const first = decidePoints({ accepted, read });
  assert.deepEqual([first.applied.length, first.proposed.map(change => change.kind), first.removalsWaiting.length, first.points], [0, ['changed', 'added', 'removed'], 0, [...accepted].sort((a, b) => a.key.localeCompare(b.key))]);
  // The second reading says the same: the new and the changed point are in; the one that is gone stays and is named.
  const second = decidePoints({ accepted, read, pending: first.proposed });
  assert.deepEqual(second.applied.map(change => `${change.kind} ${change.name}`), ['changed Abipood', 'added Uus pood']);
  assert.deepEqual(second.removalsWaiting.map(change => change.name), ['Vana pood']);
  assert.deepEqual(second.points.map(item => [item.name, item.phone]), [['Abipood', '55550009'], ['Kuulmiskeskus', '55550001'], ['Uus pood', '55550001'], ['Vana pood', '55550001']]);
  assert.deepEqual(second.proposed.map(change => change.kind), ['removed'], 'the removal is carried to the next reading');
  // With the person's approval of that key it goes.
  const approved = decidePoints({ accepted: second.points, read, pending: second.proposed, approveRemovals: ['vana pood|tn 1|58.3,26.7'] });
  assert.deepEqual([approved.applied.map(change => change.kind), approved.points.map(item => item.name), approved.removalsWaiting], [['removed'], ['Abipood', 'Kuulmiskeskus', 'Uus pood'], []]);
  // An approval alone does not remove a point the readings have not shown gone twice.
  assert.equal(decidePoints({ accepted, read, approveRemovals: ['vana pood|tn 1|58.3,26.7'] }).points.length, 3);
  // A change that the second reading shows differently starts again as a proposal.
  const other = decidePoints({ accepted, read: [point('Abipood', tartu, { phone: '55550007' }), accepted[1], accepted[2]], pending: first.proposed });
  assert.deepEqual([other.applied, other.proposed.map(change => change.kind)], [[], ['changed']]);
  // A reading that says what is accepted changes nothing and proposes nothing.
  assert.deepEqual((({ applied, proposed, removalsWaiting }) => [applied, proposed, removalsWaiting])(decidePoints({ accepted, read: accepted, pending: first.proposed })), [[], [], []]);
});

test('the points\' pages are made again only where the points changed, not for the day of the reading alone', () => {
  const municipalities = [{ ...tartu, county: 'Tartumaa' }, { ...elva, county: 'Tartumaa' }];
  const ingested = new Map(pointSources(accepted, { municipalities, readAt: '2026-10-06T11:59:14.896Z' }).map(page => [page.path, page.html]));
  const same = refreshedPointPages({ points: accepted, municipalities, readAt: '2026-11-06T09:00:00.000Z', ingested });
  assert.deepEqual([same.changed, same.unchanged, same.gone], [[], 3, []]);
  // A changed phone number in Tartu: Tartu's page only (the county's overview names no phone).
  const changed = refreshedPointPages({ points: [point('Abipood', tartu, { phone: '55550009' }), accepted[1], accepted[2]], municipalities, readAt: '2026-11-06T09:00:00.000Z', ingested });
  assert.deepEqual(changed.changed.map(page => [page.state, page.path]), [['changed', 'abivahendid/kov/tartu_linn.html']]);
  assert(changed.changed[0].html.includes('loetud 06.11.2026') && changed.changed[0].html.includes('Telefon: 55550009'));
  assert.equal(changed.unchanged, 2);
  // A point in a municipality that had none: its own page changes and the county's overview too.
  const added = refreshedPointPages({ points: [...accepted, point('Uus pood', { id: 'kastre_vald', name: 'Kastre vald' })], municipalities: [...municipalities, { id: 'kastre_vald', name: 'Kastre vald', county: 'Tartumaa' }],
    readAt: '2026-11-06T09:00:00.000Z', ingested });
  assert.deepEqual(added.changed.map(page => [page.state, page.path]).sort(), [['changed', 'abivahendid/maakond/tartu-maakond.html'], ['new', 'abivahendid/kov/kastre_vald.html']]);
});
