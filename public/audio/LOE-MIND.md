# Taustamuusika failipesa

Neli rahulikku instrumentaal-lugu (päris MP3-failid) mängivad platvormil,
valik "Keel ja ligipääsetavus" modaalis (Vaikus + Meloodia I–IV).
Mootor: `components/room/AmbientAudio.jsx` (kaardistus `FILE_SRC`-is).

## Kaardistus (mode → fail → menüünimi)

| mode | fail (`public/audio/…`) | Menüü (ET) | allikas |
|------|--------------------------|------------|---------|
| a | `atlasaudio-ambient-cinematic-510518.mp3` | Meloodia I — Hämarik | Pixabay |
| b | `atlasaudio-cinematic-softness-511863.mp3` | Meloodia II — Pehmus | Pixabay |
| c | `the_mountain-delicate-cinematic-512628.mp3` | Meloodia III — Õrnus | Pixabay |

Nimed on esialgsed (pandud faili meeleolu järgi) — kuula üle ja ütle, kui
tahad neid muuta. Sildid: `messages/{et,en,ru}.json` →
`accessibility.options.ambient.{a,b,c,d}`. Helitase: `FILE_LEVELS`
AmbientAudio.jsx-is (praegu a=0.32, b/c/d=0.30).

## Loo vahetamine / lisamine

- **Muuda lugu:** asenda fail samas kaustas ja uuenda `FILE_SRC`-i
  baasnimi (ilma `.mp3` laiendita) `AmbientAudio.jsx`-is.
- **Failinimi ilma `.mp3`-ta** läheb `FILE_SRC`-i; MP3-st piisab
  (mängib kõigis brauserites, ka Safaris).
- Faili nõuded: rahulik instrumentaal-**loop**, ~1–4 MB, ilma järsu
  alguse/lõputa (mängitakse silmusena), vaikne tase.

## Litsents (AVALIK sait!)

Kõik neli on **Pixabaylt** — [Pixabay Content License](https://pixabay.com/service/license-summary/):
tasuta ka äriliselt, atributsioon EI ole nõutud. Uusi lugusid lisades
kasuta ainult lugu, mille avalikuks esitamiseks on õigus (Pixabay / CC0 /
ostetud litsents).

## Tagavara

Kui mõne mode'i fail puudub või ei lae, mängib WebAudio-süntees
(a = lounge-klaver, b/c/d = pehmed padjad) — nii ei jää platvorm tummaks.
Süntees EI mängi enam faili laadimise ajal "sillana" (kuni fail laeb, on
lühike vaikus).
