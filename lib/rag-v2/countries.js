// The register of the world's states by their Estonian names (ADR-143; owner 11.10.2026: "riigi nimed peaks olema mul
// kuskil ühenduses nii, et süsteem saaks aru, kas tegu on riigi nime või inimese nimega. ehk siis mingi register").
// A rule that takes two capitalised words for a person's name asks here first whether they are a state's: "Burkina Faso",
// "Sri Lanka", "Venemaa Föderatsiooni", a table row "Kasahstan Kasahstani". Until now each such pair was added by hand to
// the list of pairs that are not persons, one increment after another.
//
// One entry a state: its short name in the nominative, and after a slash the genitive where the rule below does not
// give it (a plural name, a name whose stem changes, a name of several words that all inflect). Other names a page may
// use for a listed state stand as entries of their own (Madalmaad, Myanmar, Cape Verde, Püha Tool). The list is a word
// list like a gazetteer's; what it lacks or misspells costs a paragraph, as before, never a person's privacy.
export const COUNTRY_NAMES = Object.freeze(`
Afganistan|Albaania|Alžeeria|Ameerika Ühendriigid/Ameerika Ühendriikide|Andorra|Angola|Antigua ja Barbuda|Araabia Ühendemiraadid/Araabia Ühendemiraatide|Argentina|Armeenia
Aserbaidžaan|Austraalia|Austria|Bahama|Bahrein|Bangladesh|Barbados|Belau|Belgia|Belize|Benin|Bhutan|Birma|Boliivia|Bosnia ja Hertsegoviina|Botswana|Brasiilia|Brunei|Bulgaaria
Burkina Faso|Burundi|Cabo Verde|Cape Verde|Colombia|Costa Rica|Djibouti|Dominica|Dominikaani Vabariik/Dominikaani Vabariigi|Ecuador|Eesti|Egiptus|Ekvatoriaal-Guinea|El Salvador
Elevandiluurannik/Elevandiluuranniku|Eritrea|Eswatini|Etioopia|Fidži|Filipiinid/Filipiinide|Gabon|Gambia|Ghana|Grenada|Gruusia|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|Hiina
Hispaania|Holland|Honduras|Hongkong|Horvaatia|Ida-Timor|Iirimaa|Iisrael|India|Indoneesia|Inglismaa|Iraak/Iraagi|Iraan|Island|Itaalia|Jaapan|Jamaica|Jeemen|Jordaania|Kambodža|Kamerun
Kanada|Kasahstan|Katar|Kenya|Kesk-Aafrika Vabariik/Kesk-Aafrika Vabariigi|Kiribati|Komoorid/Komooride|Kongo|Kongo Demokraatlik Vabariik/Kongo Demokraatliku Vabariigi|Korea|Kosovo|Kreeka
Kuuba|Kuveit/Kuveidi|Kõrgõzstan|Küpros|Laos|Leedu|Lesotho|Libeeria|Liechtenstein|Liibanon|Liibüa|Luksemburg|Lõuna-Aafrika Vabariik/Lõuna-Aafrika Vabariigi|Lõuna-Korea|Lõuna-Sudaan|Läti
Madagaskar|Madalmaad/Madalmaade|Makedoonia|Malaisia|Malawi|Maldiivid/Maldiivide|Mali|Malta|Maroko|Marshalli Saared/Marshalli Saarte|Mauritaania|Mauritius|Mehhiko|Mikroneesia|Moldova
Monaco|Mongoolia|Montenegro|Mosambiik/Mosambiigi|Myanmar|Namiibia|Nauru|Nepal|Nicaragua|Niger|Nigeeria|Norra|Omaan|Paapua Uus-Guinea|Pakistan|Palestiina|Panama|Paraguay|Peruu|Poola
Portugal|Prantsusmaa|Põhja-Korea|Põhja-Makedoonia|Püha Tool/Püha Tooli|Roheneemesaared/Roheneemesaarte|Rootsi|Rumeenia|Rwanda|Saalomoni Saared/Saalomoni Saarte|Saint Kitts ja Nevis
Saint Lucia|Saint Vincent ja Grenadiinid|Saksamaa|Sambia|Samoa|San Marino|São Tomé ja Príncipe|Saudi Araabia|Seišellid/Seišellide|Senegal|Serbia|Sierra Leone|Singapur|Slovakkia
Sloveenia|Somaalia|Soome|Sri Lanka|Sudaan|Suriname|Suurbritannia|Süüria|Šotimaa|Šveits|Zimbabwe|Taani|Tadžikistan|Tai|Taiwan|Tansaania|Togo|Tonga|Trinidad ja Tobago|Tšaad|Tšehhi
Tšiili|Tuneesia|Tuvalu|Türgi|Türkmenistan|Uganda|Ukraina|Ungari|Uruguay|Usbekistan|Uus-Meremaa|Valgevene|Vanuatu|Vatikan|Venemaa|Venezuela|Vietnam|Ühendkuningriik/Ühendkuningriigi
`.trim().split(/\s*[|\n]\s*/u).map(entry => { const [name, genitive = null] = entry.split('/'); return Object.freeze({ name, genitive }); }));

// The word for the form of a state, which stands beside its name ("Kasahstani Vabariik", "Venemaa Föderatsioon").
const STATE_WORDS = ['Vabariik/Vabariigi', 'Rahvavabariik/Rahvavabariigi', 'Liitvabariik/Liitvabariigi', 'Islamivabariik/Islamivabariigi', 'Föderatsioon', 'Konföderatsioon', 'Kuningriik/Kuningriigi',
  'Suurhertsogiriik/Suurhertsogiriigi', 'Vürstiriik/Vürstiriigi', 'Emiraat/Emiraadi', 'Sultanaat/Sultanaadi', 'Liit/Liidu', 'Ühendus/Ühenduse'];

// A word as it is compared: lower case, without marks. Both sides are read so, so "Sao Tome" is "São Tomé", and an
// Estonian letter loses its mark on both sides alike.
const plain = word => word.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '');
const ENDINGS = ['', 's', 'st', 'sse', 'l', 'lt', 'le', 'ga', 'ni', 'ks', 'na', 'ta', 't', 'd'];
// The forms a name's last word is written in. Without a given genitive a word that ends in a consonant takes -i or -e
// ("Kasahstani", "Egiptuse"): both are made, and a form nobody writes harms nothing, since a pair is a state's only
// when both of its words are accounted for.
function forms(word, genitive) {
  const stems = genitive ? [word, genitive] : /[aeiouõäöüy]$/iu.test(word) ? [word] : [word, `${word}i`, `${word}e`];
  return stems.flatMap(stem => ENDINGS.map(ending => plain(`${stem}${ending}`)));
}
const SINGLE = new Set(), STATE = new Set(), PAIRS = new Set();
for (const entry of STATE_WORDS) { const [word, genitive] = entry.split('/'); for (const form of forms(word, genitive)) STATE.add(form); }
for (const { name, genitive } of COUNTRY_NAMES) {
  const words = name.split(' '), inflected = genitive ? genitive.split(' ') : null;
  if (words.length === 1) { for (const form of forms(words[0], inflected?.[0])) SINGLE.add(form); continue; }
  // "X ja Y": each of the two is the state's name to a list that names them apart.
  if (words.length === 3 && words[1] === 'ja') for (const word of [words[0], words[2]]) for (const form of forms(word)) SINGLE.add(form);
  const at = index => (index === words.length - 1 ? forms(words[index], inflected?.[index]) : [plain(words[index]), ...(inflected ? [plain(inflected[index])] : [])]);
  for (let index = 0; index + 1 < words.length; index++) for (const first of at(index)) for (const second of at(index + 1)) PAIRS.add(`${first} ${second}`);
}

/** Whether a single word is a listed state's name in one of its case forms ("Soomes", "Kasahstani"). */
export const countryWord = word => SINGLE.has(plain(word));

/**
 * Whether two words in a row are a state's name and not a person's: two words of a listed name of several words
 * ("Burkina Faso", "Sri Lankas", "Püha Tooli"), two states' names ("Kasahstan Kasahstani"), or a state's name beside the
 * word for its form ("Venemaa Föderatsiooni", "Vabariik Kasahstan"). One word that is a state's name beside any other
 * word is not enough: a family name may be a country's ("Soome", "Holland").
 */
export function countryPair(first, second) {
  const a = plain(first), b = plain(second);
  if (PAIRS.has(`${a} ${b}`)) return true;
  return (SINGLE.has(a) || SINGLE.has(b)) && (SINGLE.has(a) || STATE.has(a)) && (SINGLE.has(b) || STATE.has(b));
}
