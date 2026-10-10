// Term sets of the server's own morphology (EstNLTK 1.7.5, Vabamorf, through lib/rag-v2/search/estnltk-worker.py), recorded
// on the server on 10.10.2026 for ADR-127: for each word exactly what the analyzer returns for it, lowercase and without
// the "vmet" prefix: the word as written, its lemmas and, for a compound, its root tokens ("Raekülas": rae and küla beside
// raeküla). Only the words the tests of tests/rag-v2-compound-parts.test.mjs read by their terms; nothing here is made up
// or corrected by hand, and the runtime has no such list. This machine has no EstNLTK: the sentences that read the
// morphology alone run against the real analyzer in tests/rag-v2-record-scope.test.mjs, on the server.
export const RECORDED_TERMS = Object.freeze({
  Raekülas: ['küla', 'rae', 'raeküla', 'raekülas'], Raekülla: ['küla', 'küll', 'rae', 'raeküla', 'raeküll', 'raekülla'], raekojas: ['koda', 'rae', 'raekoda', 'raekojas'],
  Raekoja: ['koda', 'rae', 'raekoda', 'raekoja'], Järvamaal: ['järva', 'järvamaa', 'järvamaal', 'maa'], Pärnumaal: ['maa', 'pärnu', 'pärnumaa', 'pärnumaal'], Pärnumaa: ['maa', 'pärnu', 'pärnumaa'],
  Tartumaal: ['maa', 'tartu', 'tartumaa', 'tartumaal'], Raplamaal: ['maa', 'rapla', 'raplamaa', 'raplamaal'], Võrumaal: ['maa', 'võru', 'võrumaa', 'võrumaal'],
  Viljandimaal: ['maa', 'viljandi', 'viljandimaa', 'viljandimaal'], Valgamaal: ['maa', 'valga', 'valgamaa', 'valgamaal'], Põlvamaal: ['maa', 'põlva', 'põlvamaa', 'põlvamaal'],
  Jõgevamaal: ['jõgeva', 'jõgevamaa', 'jõgevamaal', 'maa'], Mulgimaal: ['maa', 'mulgi', 'mulgimaa', 'mulgimaal'], tõrvalill: ['lill', 'tõrva', 'tõrvalill'],
  tõrvapapp: ['papp', 'tõrva', 'tõrvapapp'], kanepiõli: ['kanepi', 'kanepiõli', 'õli'], Kosejõe: ['jõgi', 'kose', 'kosejõe', 'kosejõgi'], kosekülas: ['kose', 'koseküla', 'kosekülas', 'küla'],
  Jürikooli: ['jüri', 'jürikool', 'jürikooli', 'kool'], Hiiumaal: ['hiiu', 'hiiumaa', 'hiiumaal', 'maa'], Saaremaal: ['maa', 'saare', 'saaremaa', 'saaremaal'],
  Setomaal: ['maa', 'seto', 'setomaa', 'setomaal'], Märjamaal: ['maa', 'märja', 'märjamaa', 'märjamaal'], Põltsamaal: ['maa', 'põltsa', 'põltsamaa', 'põltsamaal'],
  Sillamäel: ['mäe', 'silla', 'sillamäe', 'sillamäel'], Mustvees: ['must', 'mustvee', 'mustvees', 'vee'], Haapsalus: ['haap', 'haapsalu', 'haapsalus', 'salu'],
  Kuusalus: ['kuu', 'kuusalu', 'kuusalus', 'salu'], Jõelähtmel: ['jõe', 'jõelähtme', 'jõelähtmel', 'lähtme'], Häädemeestel: ['hääde', 'häädemeeste', 'häädemeestel', 'meeste'],
  Alutagusel: ['alu', 'alutaguse', 'alutagusel', 'taguse'], Peipsiääres: ['peipsi', 'peipsiääre', 'peipsiääres', 'ääre'], Rakveres: ['rak', 'rakvere', 'rakveres', 'vere'],
  'Põhja-Pärnumaal': ['maa', 'pärnu', 'pärnumaa', 'pärnumaal', 'põhja', 'põhja-pärnumaa', 'põhja-pärnumaal'],
  'Narva-Jõesuus': ['jõe', 'jõesuu', 'jõesuus', 'narva', 'narva-jõesuu', 'narva-jõesuus', 'suu'], Rae: ['raad', 'rae'], Raes: ['raad', 'rae', 'raes'], Raele: ['raad', 'rae', 'raele'],
  Tapale: ['tapa', 'tapale', 'tapp'], tappa: ['tap', 'tapma', 'tapp', 'tappa'], Tõrvas: ['tõrv', 'tõrva', 'tõrvama', 'tõrvas'], Kosel: ['kose', 'kosel', 'kosk'],
  Kanepis: ['kanep', 'kanepi', 'kanepis'], kanepi: ['kanep', 'kanepi'], Pärnus: ['pärnu', 'pärnus'], Tartus: ['tartu', 'tartus'], Järvas: ['järva', 'järvas'], Järva: ['järva'], Türi: ['türi'],
  Nõos: ['nõbu', 'nõgu', 'nõo', 'nõos'], vallas: ['vald', 'vallas'], Annelinnas: ['anne', 'annelinn', 'annelinnas', 'linn'], Kesklinnas: ['kesk', 'kesklinn', 'kesklinnas', 'linn'],
  Sauevallas: ['saue', 'sauevald', 'sauevallas', 'vald'], Tartuvallas: ['tartu', 'tartuvald', 'tartuvallas', 'vald'], Koselinnas: ['kose', 'koselinn', 'koselinnas', 'linn'],
  vallavalitsus: ['valitsus', 'valla', 'vallavalitsus'], linnavalitsusest: ['linna', 'linnavalitsus', 'linnavalitsusest', 'valitsus'],
  Mustamäel: ['musta', 'mustamäe', 'mustamäel', 'mustamägi', 'mägi'], 'Tartu-Tallinna': ['linn', 'tal', 'tallinn', 'tartu', 'tartu-tallinn', 'tartu-tallinna'],
  Tabasalus: ['salu', 'taba', 'tabasalu', 'tabasalus'], 'Keila-Joal': ['joa', 'joal', 'keila', 'keila-joa', 'keila-joal'], Keilas: ['keila', 'keilas'], Narvas: ['narva', 'narvas'],
  // The words of the second recording of that day (the ones the first lacked: an island named as a land, settlements that
  // begin with a municipality's name, common words that hold "vald" or "linn", case forms the sweep did not make), and the
  // words of the turns that name a town with its district.
  Raeküla: ['küla', 'rae', 'raeküla'], Harjumaal: ['harju', 'harjumaa', 'harjumaal', 'maa'], Harjumaa: ['harju', 'harjumaa', 'maa'], Virumaal: ['maa', 'viru', 'virumaa', 'virumaal'], Viljandis: ['viljandi', 'viljandis'], Muhus: ['muhk', 'muhu', 'muhus'], Kihnus: ['kihn', 'kihnu', 'kihnus'],
  Muhumaal: ['maa', 'muhu', 'muhumaa', 'muhumaal'], Kihnumaal: ['kihnu', 'kihnumaa', 'kihnumaal', 'maa'], Järvakandis: ['järva', 'järvakandi', 'järvakandis', 'kandi'], Türisalus: ['salu', 'türi', 'türisalu', 'türisalus'],
  Võrumõisas: ['mõis', 'võru', 'võrumõis', 'võrumõisas'], Tallinnas: ['tallinn', 'tallinnas'], tapamaja: ['maja', 'tapa', 'tapamaja'], võrukael: ['kael', 'võru', 'võrukael'],
  mulgikapsad: ['kapsas', 'mulgi', 'mulgikapsad', 'mulgikapsas'], Tartuni: ['tartu', 'tartuni'], Tartuna: ['tartu', 'tartuna'], Tartuks: ['tartu', 'tartuks'], Tartuta: ['tartu', 'tartuta'], Tartuski: ['tartu', 'tartuski'],
  valdkonnas: ['valdkond', 'valdkonnas'], sotsiaalvaldkonnas: ['sotsiaal', 'sotsiaalvaldkond', 'sotsiaalvaldkonnas', 'valdkond'], naabervallas: ['naaber', 'naabervald', 'naabervallas', 'vald'],
  lähivallas: ['lähi', 'lähivald', 'lähivallas', 'vald'], kesklinnas: ['kesk', 'kesklinn', 'kesklinnas', 'linn'], vanalinnas: ['linn', 'vana', 'vanalinn', 'vanalinnas'], pealinnas: ['linn', 'pea', 'pealinn', 'pealinnas'],
  koduvallas: ['kodu', 'koduvald', 'koduvallas', 'vald'], vallavalitsuses: ['valitsus', 'valla', 'vallavalitsus', 'vallavalitsuses'], Annelinn: ['anne', 'annelinn', 'linn'], Supilinnas: ['linn', 'supi', 'supilinn', 'supilinnas'],
  Tammelinnas: ['linn', 'tamme', 'tammelinn', 'tammelinnas'], Karlovas: ['karlova', 'karlovas'], Tähtveres: ['täht', 'tähtvere', 'tähtveres', 'vere'], Ülejõel: ['jõgi', 'üle', 'ülejõe', 'ülejõel', 'ülejõgi'],
  Ihastes: ['ihane', 'ihaste', 'ihastes'], Raadil: ['raad', 'raadi', 'raadil'],
});
// A stand-in for EstNLTK with the recorded readings. A word that is not recorded reads as itself only, as in the other
// stand-ins ("Elan", "on"): no test may depend on such a word's lemma.
export const recordedAnalyzer = { analyze: async words => words.map(word => (RECORDED_TERMS[word] || [word.toLowerCase()]).map(term => `vmet${term}`).join(' ')) };
