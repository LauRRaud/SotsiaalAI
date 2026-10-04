import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStaffFromHtml, isSocialFieldStaff } from '../lib/serviceMap/kovStaffExtract.js';

// The staff list of a municipality's official page, read without knowing the people in advance. The markup below
// repeats the shapes of the real pages (the two shared site platforms, tables, Tartu, Tallinn's district pages);
// every name, address and number is fictional.
const rot13 = value => value.replace(/[a-z]/giu, letter => String.fromCharCode((letter <= 'Z' ? 65 : 97) + ((letter.charCodeAt(0) - (letter <= 'Z' ? 65 : 97) + 13) % 26)));
const cloudflare = email => `42${[...email].map(letter => (letter.charCodeAt(0) ^ 0x42).toString(16).padStart(2, '0')).join('')}`;
const page = body => `<html><head><title>Kontakt</title></head><body><nav><a href="mailto:menu@example.invalid">Menüü Kontakt</a></nav><main>${body}</main>
  <footer><p>Näidise Vallavalitsus <a href="mailto:vald@example.invalid">vald@example.invalid</a> 5550 0000</p></footer></body></html>`;
const one = html => { const { people } = extractStaffFromHtml(page(html)); assert.equal(people.length, 1, JSON.stringify(people)); return people[0]; };

test('a WordPress platform card: hidden e-mail, tel link, role under the name, department from the heading', () => {
  const person = one(`<h2 class="wp-block-heading">Sotsiaalosakond</h2>
    <div class="wp-block-columns kontaktimuster has-contrast-color"><div class="wp-block-column">
      <p class="has-text-align-left ankur notranslate has-medium-font-size">Mari Maasikas</p>
      <p class="has-text-align-left ankur has-small-font-size">lastekaitsespetsialist</p></div>
      <div class="wp-block-column"><p><a href="javascript:;" data-enc-email="${rot13('mari.maasikas[at]example.invalid')}" class="mail-link"><span id="eeb-1"></span>
        <script>document.getElementById("eeb-1").innerHTML = "x";</script><noscript>*protected email*</noscript></a></p>
      <p><a href="tel:55500001">5550 0001</a></p>
      <details><summary>tööülesanded, ametijuhend, vastuvõtt</summary><p>Abivajava lapse juhtumid</p></details></div></div>`);
  assert.deepEqual({ name: person.name, role: person.role, section: person.section, emails: person.emails, phones: person.phones },
    { name: 'Mari Maasikas', role: 'lastekaitsespetsialist', section: 'Sotsiaalosakond', emails: ['mari.maasikas@example.invalid'], phones: ['55500001'] });
  assert.equal(isSocialFieldStaff(person), true);
});

test('a card that shows neither e-mail nor phone is still a person', () => {
  const person = one(`<h2>Hooldekodu</h2><div class="wp-block-columns has-contrast-2-color"><div class="wp-block-column">
    <p class="ankur has-medium-font-size">Jaan Tamm</p><p class="ankur has-small-font-size">hooldustöötaja</p></div>
    <div class="wp-block-column"><p></p><p></p></div></div>`);
  assert.deepEqual([person.name, person.role, person.emails, person.phones], ['Jaan Tamm', 'hooldustöötaja', [], []]);
});

test('an e-mail written backwards in pieces with hidden filler is read', () => {
  const backwards = [...'kati.kask@example.invalid'].reverse().join('');
  const person = one(`<div class="wp-block-columns kontaktimuster"><p class="ankur">Kati Kask</p><p class="ankur">sotsiaaltööspetsialist</p>
    <p><a href="javascript:;" class="mail-link"><span class="eeb eeb-rtl"><span class="eeb-sd">${backwards.slice(0, 9)}</span><span class="eeb-nodis">1759561111</span><span class="eeb-sd">${backwards.slice(9)}</span><span class="eeb-nodis">1759562222</span></span></a></p></div>`);
  assert.deepEqual(person.emails, ['kati.kask@example.invalid']);
});

test('a card of the other shared platform with a Cloudflare-protected e-mail', () => {
  const { people } = extractStaffFromHtml(page(`<div class="js-unit-item"><h2>Sotsiaal- ja tervishoiuosakond</h2>
    ${['Peeter Paju|Osakonnajuhataja|5550 0002', 'Liis Lepp|Sekretär|+372 5550 0003'].map(row => { const [name, role, phone] = row.split('|'); return `
    <div class="vp-employee collapse-header-vp js-employee-item"><div class="vp-employee__name"><p class="mb-0 text-primary">${name}</p><p class="vp-employee__office">${role}</p></div>
      <div class="vp-employee__contact"><p><a href="/cdn-cgi/l/email-protection#${cloudflare(`${name.toLowerCase().replace(' ', '.')}@example.invalid`)}" class="vp-employee__email"><span class="__cf_email__" data-cfemail="${cloudflare(`${name.toLowerCase().replace(' ', '.')}@example.invalid`)}">[email&#160;protected]</span></a></p><p>${phone}</p></div></div>`; }).join('')}</div>`));
  assert.deepEqual(people.map(person => [person.name, person.role, person.emails[0], person.phones[0], person.section]), [
    ['Peeter Paju', 'Osakonnajuhataja', 'peeter.paju@example.invalid', '55500002', 'Sotsiaal- ja tervishoiuosakond'],
    ['Liis Lepp', 'Sekretär', 'liis.lepp@example.invalid', '55500003', 'Sotsiaal- ja tervishoiuosakond']]);
  // The department heading makes the secretary a social-field worker too.
  assert.deepEqual(people.map(isSocialFieldStaff), [true, true]);
});

test('a table row: the role may stand before the name, reception hours are not a role, a row without e-mail counts', () => {
  const { people } = extractStaffFromHtml(page(`<h3>Sotsiaalosakond</h3><table><tbody>
    <tr><th>Amet</th><th>Nimi</th><th>Telefon</th><th>E-post</th><th>Vastuvõtt</th></tr>
    <tr class="row-2"><td>Sotsiaaltööspetsialist</td><td>Anne Aas</td><td>5550 0004</td><td><a href="mailto:anne.aas@example.invalid">anne.aas@example.invalid</a></td><td>Veriora E 13-16</td></tr>
    <tr class="row-3"><td>Koduhooldustöötaja</td><td>Tiit Toom</td><td>5550 0005</td><td></td><td></td></tr></tbody></table>`));
  assert.deepEqual(people.map(person => [person.name, person.role, person.emails, person.phones]), [
    ['Anne Aas', 'Sotsiaaltööspetsialist', ['anne.aas@example.invalid'], ['55500004']], ['Tiit Toom', 'Koduhooldustöötaja', [], ['55500005']]]);
});

test('"name - role" in one heading (Tartu)', () => {
  const person = one(`<h2 class="underlined">Sotsiaaltööteenistus</h2><div class="entry-contact"><h2><a href="/isik/1">Mall Mets - sotsiaaltöö spetsialist</a></h2>
    <p>Nõustamine ja teenustele suunamine.</p><div class="row"><p><a href="/cdn-cgi/l/email-protection#${cloudflare('mall.mets@example.invalid')}">[email&#160;protected]</a></p><p>5550 0006</p><p>Näidise 10, ruum 2</p></div></div>`);
  assert.deepEqual([person.name, person.role, person.section, person.emails, person.phones],
    ['Mall Mets', 'sotsiaaltöö spetsialist', 'Sotsiaaltööteenistus', ['mall.mets@example.invalid'], ['55500006']]);
});

test('plain text, several people in one paragraph: a person runs from the name to the next name', () => {
  const { people } = extractStaffFromHtml(page(`<h1>Näidise linnaosa sotsiaalhoolekande osakond</h1><div class="node__content"><p>
    <strong>Osakonna juhataja</strong> Reet Rebane<br>Telefon 5550 0007<br>E-post <a href="mailto:reet.rebane@example.invalid">reet.rebane@example.invalid</a><br>
    <strong>Sotsiaaltöö spetsialist</strong> Ott Orav (Kadaka)<br>Telefon 5550 0008<br>E-post <a href="mailto:ott.orav@example.invalid">ott.orav@example.invalid</a><br>
    Teeninduspiirkond: Uus Maailm, Vana Turg<br>
    <strong>Vastuvõtt</strong><br>E 9.00–12.00</p></div>`));
  assert.deepEqual(people.map(person => [person.name, person.role, person.emails[0], person.phones[0]]), [
    ['Reet Rebane', 'Osakonna juhataja', 'reet.rebane@example.invalid', '55500007'], ['Ott Orav', 'Sotsiaaltöö spetsialist, Kadaka', 'ott.orav@example.invalid', '55500008']]);
  assert.deepEqual(people.map(isSocialFieldStaff), [true, true]);
});

test('"role - name" paragraphs, each with its own e-mail', () => {
  const { people } = extractStaffFromHtml(page(`<div class="node__content">
    <p><strong>Lastekaitse spetsialist</strong> - <strong>Epp Eha</strong><br>Telefon: 5550 0009<br>E-mail: <a href="mailto:epp.eha@example.invalid">epp.eha@example.invalid</a><br>Teeninduspiirkond: Uus Maailm</p>
    <p><strong>Eakate hoolekande spetsialist</strong> - <strong>Uku Urb</strong><br>Telefon: 5550 0010<br>E-mail: <a href="mailto:uku.urb@example.invalid">uku.urb@example.invalid</a></p></div>`));
  assert.deepEqual(people.map(person => [person.name, person.role]), [['Epp Eha', 'Lastekaitse spetsialist'], ['Uku Urb', 'Eakate hoolekande spetsialist']]);
});

test('a capitalised job title in front of the name is the role, not a first name', () => {
  const { people } = extractStaffFromHtml(page(`<h2>Sotsiaalhoolekanne</h2><div class="node__content">
    <p>Spetsialist Mari Maasikas<br>Telefon: 5550 0023<br><a href="mailto:mari.maasikas@example.invalid">mari.maasikas@example.invalid</a></p>
    <p>Juhataja Anna-Liisa Tuvi<br>Telefon: 5550 0024<br><a href="mailto:annaliisa.tuvi@example.invalid">annaliisa.tuvi@example.invalid</a></p>
    <p>Mari Liis Karst<br>Telefon: 5550 0025<br><a href="mailto:mari.karst@example.invalid">mari.karst@example.invalid</a></p></div>`));
  // A three-word name stays whole: "Karst" ends like "arst" and is a surname all the same.
  assert.deepEqual(people.map(person => [person.name, person.role]), [['Mari Maasikas', 'Spetsialist'], ['Anna-Liisa Tuvi', 'Juhataja'], ['Mari Liis Karst', null]]);
});

test('a one-person page laid out as a form: the role is the value of "Ametikoht", not a label or a link text', () => {
  const person = one(`<h1>Siim Saar</h1><table><tr><td>Eesnimi</td><td>Siim</td></tr><tr><td>Perekonnanimi</td><td>Saar</td></tr>
    <tr><td>Ametikoht</td><td>lapse heaolu spetsialist</td></tr><tr><td>E-post</td><td><a href="mailto:siim.saar@example.invalid">siim.saar@example.invalid</a></td></tr>
    <tr><td>Telefon</td><td>5550 0011</td></tr><tr><td><a href="/juhend.pdf">Ametijuhend</a></td><td></td></tr></table>`);
  assert.deepEqual([person.name, person.role, person.emails, person.phones], ['Siim Saar', 'lapse heaolu spetsialist', ['siim.saar@example.invalid'], ['55500011']]);
});

test('what is not a person: an office address, a department mailbox, the menu and the footer', () => {
  const { people, recordsWithoutName } = extractStaffFromHtml(page(`<h2>Sotsiaalosakond</h2>
    <p>Näidise Vallavalitsus, Pikk tn 1<br><a href="mailto:sotsiaal@example.invalid">sotsiaal@example.invalid</a></p>
    <ul><li>Näidise Päevakeskus <a href="mailto:keskus@example.invalid">keskus@example.invalid</a></li></ul>`));
  assert.deepEqual(people, []);
  assert.equal(recordsWithoutName, 2);
});

test('a social department page as Narva writes it: a vacant post and a service mailbox are not people, an absent worker is marked', () => {
  const card = (name, role, email, extra = '') => `<div class="vp-employee"><div class="vp-employee__name"><p>${name}</p><p class="vp-employee__office">${role}</p></div>
    <div class="vp-employee__contact"><p><a href="mailto:${email}" class="vp-employee__email">${email}</a></p><p>5550 0020</p></div><div>${extra}</div></div>`;
  const { people, recordsWithoutName } = extractStaffFromHtml(page(`<h2>Sotsiaalabiamet</h2>
    ${card('Tiina Teder', 'Direktor', 'tiina.teder@example.invalid', 'ametnik Näidise 5a Vastuvõtt: T 10.00-12.00')}
    ${card('Rein Rohi', 'Raamatupidaja', 'rein.rohi@example.invalid')}
    ${card('Spetsialist', 'Spetsialist', 'amet@example.invalid')}
    ${card('Eluruumi tagamise teenus', 'Eluruumi tagamise teenus', 'amet@example.invalid')}
    ${card('Leida Lill', 'Spetsialist', 'amet@example.invalid', 'ametnik töösuhe peatatud')}`));
  assert.deepEqual(people.map(person => [person.name, person.role, person.away, isSocialFieldStaff(person)]), [
    ['Tiina Teder', 'Direktor', false, true], ['Rein Rohi', 'Raamatupidaja', false, false], ['Leida Lill', 'Spetsialist', true, true]]);
  assert.equal(recordsWithoutName, 2);
});

test('what the reader sees wins over the link behind it: a card copied from another person keeps the old link targets', () => {
  const person = one(`<div class="wp-block-columns kontaktimuster"><div class="wp-block-column">
    <p class="ankur has-medium-font-size">Mari Maasikas</p><p class="ankur has-small-font-size">ennetustöö peaspetsialist</p></div>
    <div class="wp-block-column"><p><a href="mailto:teine.inimene@example.invalid">mari.maasikas@example.invalid</a></p>
    <p><a href="tel:55509999">5550 0001</a></p><p><a href="tel:55500002">Helista</a></p></div></div>`);
  assert.deepEqual([person.emails, [...person.phones].sort()], [['mari.maasikas@example.invalid'], ['55500001', '55500002']]);
});

test('paragraphs after a person\'s card belong to that person up to the next card (Tallinn district pages)', () => {
  const card = (name, role, phone) => `<span><article class="node"><h2 class="node__title"><span>${name}</span></h2><div class="node__content">
    <p>${role}</p><p>${phone}</p><a href="/cdn-cgi/l/email-protection#${cloudflare(`${name.toLowerCase().replace(' ', '.')}@example.invalid`)}"><span class="__cf_email__" data-cfemail="${cloudflare(`${name.toLowerCase().replace(' ', '.')}@example.invalid`)}">[email&#160;protected]</span></a></div>
    <div class="node__files"><a href="/juhend.rtf">Ametijuhend</a></div></article></span>`;
  const { people } = extractStaffFromHtml(page(`<h1>Näidise linnaosa sotsiaalhoolekande osakond</h1><div class="content">
    ${card('Sirje Sarv', 'sotsiaaltöö spetsialist', '5550 0031')}
    <p><br><span>Mobiiltelefon</span>: 55 500 032<br>Kabinet 108<br>Tegevusvaldkond: toimetulekutoetus, matusetoetus</p>
    ${card('Kalle Kuusk', 'sotsiaaltöö juhtivspetsialist', '5550 0033')}
    <p>Asendaja: Sirje Sarv</p></div>`));
  assert.deepEqual(people.map(person => [person.name, person.role, person.phones, person.notes]), [
    ['Sirje Sarv', 'sotsiaaltöö spetsialist', ['55500031', '55500032'], 'Tegevusvaldkond: toimetulekutoetus, matusetoetus'],
    ['Kalle Kuusk', 'sotsiaaltöö juhtivspetsialist', ['55500033'], null]]);
});

test('a protected e-mail that is itself percent-encoded', () => {
  const person = one(`<p><strong>Sotsiaaltöö spetsialist</strong> Ülle Õun<br>Telefon 5550 0034<br>
    <a href="/cdn-cgi/l/email-protection#${cloudflare('ylle.%c3%b5un@example.invalid')}"><span class="__cf_email__" data-cfemail="${cloudflare('ylle.%c3%b5un@example.invalid')}">[email&#160;protected]</span></a></p>`);
  assert.deepEqual([person.name, person.emails], ['Ülle Õun', ['ylle.õun@example.invalid']]);
});

test('an e-mail written with "(ät)" in the text of the card (Rapla)', () => {
  const person = one(`<h2 class="wp-block-heading">Sotsiaalosakond</h2><div class="wp-block-columns kontaktimuster"><div class="wp-block-column">
    <p class="ankur has-medium-font-size">Anna-Liisa Tuvi</p><p class="ankur has-small-font-size">eestkostespetsialist</p></div>
    <div class="wp-block-column"><p>annaliisa.tuvi(ät)example.invalid</p><p>5550 0021</p><details><summary>täiendav info</summary></details></div></div>`);
  assert.deepEqual([person.name, person.role, person.emails, person.phones], ['Anna-Liisa Tuvi', 'eestkostespetsialist', ['annaliisa.tuvi@example.invalid'], ['55500021']]);
  // The same in curly brackets (Haapsalu).
  const curly = one(`<div class="wp-block-columns kontaktimuster"><p class="ankur">Siim Saar</p><p class="ankur">sotsiaaltööspetsialist</p><p>siim.saar{ätt}example.invalid</p><p>5550 0022</p></div>`);
  assert.deepEqual([curly.emails, curly.phones], [['siim.saar@example.invalid'], ['55500022']]);
});

test('the social field is read from the role or from the department heading, not from look-alike words', () => {
  assert.equal(isSocialFieldStaff({ role: 'Sotsiaalabiameti raamatupidaja', section: 'Sotsiaalabiamet' }), false);
  for (const role of ['lastekaitsespetsialist', 'sotsiaaltöö peaspetsialist', 'eestkostespetsialist', 'koduhooldustöötaja', 'hooldusjuht', 'tugiisik', 'heaoluspetsialist', 'puuetega inimeste spetsialist'])
    assert.equal(isSocialFieldStaff({ role, section: 'Vallavalitsus' }), true, role);
  for (const role of ['teedehooldusspetsialist', 'heakorraspetsialist', 'ehitusnõunik', 'haridusspetsialist', 'vallasekretär'])
    assert.equal(isSocialFieldStaff({ role, section: 'Vallavalitsus' }), false, role);
  assert.equal(isSocialFieldStaff({ role: 'sekretär', section: 'Sotsiaal- ja tervishoiuosakond' }), true);
  assert.equal(isSocialFieldStaff({ role: null, section: null }), false);
  // Social media and a party are not the social field; a council committee and its members are not staff; a driver
  // of the social department is a support job.
  for (const role of ['sotsiaalmeedia spetsialist', 'Sotsiaaldemokraatliku Erakonna fraktsiooni nõunik', 'sotsiaal- ja tervishoiukomisjoni liige', 'volikogu liige, sotsiaalkomisjoni esimees',
    'linnavalitsuse liige (sotsiaaltöö)', 'sotsiaalteenistuse bussijuht'])
    assert.equal(isSocialFieldStaff({ role, section: 'Vallavalitsus' }), false, role);
  assert.equal(isSocialFieldStaff({ role: 'esimees', section: 'Sotsiaalkomisjon' }), false);
  assert.equal(isSocialFieldStaff({ role: 'sotsiaalmeedia ja sotsiaaltöö spetsialist', section: null }), true);
});
