// Function words and help-request generics carry no retrieval signal, yet in the OR-combined
// lexical query they match nearly every unit and push the vector channel's real hits down
// (ADR-024). They are removed from the QUERY only, per profile; indexes never change.
export const QUERY_STOPWORDS_VERSION = 'rag-v2/query-stopwords-1';

const STOPWORDS = new Set(`
ja ning ka ega ehk või aga kuid vaid et kui sest kuna nagu siis ent ometi
ei pole polnud ära on oli olid ole olen oled oleme olete olin olime olnud oleks oleksin olla olema saa
ma mina mu minu mind mulle mul minult minuga sa sina su sinu sind sulle sul sinuga
ta tema teda talle tal temal temaga me meie meid meile meil meiega te teie teid teile teil teiega
nad nemad neid neile neil nendega see seda selle sellel sellele selles sellest sellega need nende
oma enda end ennast endale ise
kes kelle keda kellele kellel kellega kellelt mis mida mille millele millega kus kuhu kust kuidas miks millal kas kumb
milline millise millist millised milliseid millistel millisel millisele millistele millistest mitu
veel enam juba ainult väga nii siin seal praegu nüüd alati kohe üldse isegi küll ju vist just samuti ikka jälle
saan saab saame saate saavad saaks saaksin saada võin võib võiks võime pean peab peaks peame tuleb
tahan tahaks tahaksin soovin sooviksin palun abi vaja vajan vajame vajab vajaks
kohta jaoks pärast poolt järgi vastu üle ees taga juures koos vahel sees peale kaudu üks ühe
i me my mine you your he she it we they them their a an the and or but to for of at in on by with from
is am are was were be been do does did can could would should will how what who where when which that this
there here need needs please help get
я мне меня мой моя моё мое мои ты тебе он она оно мы нам нас вы вам они им и или но а в во на с со к по для из у о от до за
не ни как что кто где когда какой какая это то нужна нужно нужен нужны помощь пожалуйста
`.trim().split(/\s+/));

/** Keeps every other word, number and hyphenated name in order; punctuation never reaches tsquery. */
export function withoutStopwords(text) {
  return (text.normalize('NFC').match(/[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu) || [])
    .filter(word => !STOPWORDS.has(word.toLowerCase())).join(' ');
}
