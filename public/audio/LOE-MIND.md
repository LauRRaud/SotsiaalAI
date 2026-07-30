# Taustamuusika failipesa

Viis rahulikku instrumentaal-lugu (päris MP3-failid) mängivad platvormil,
valik "Keel ja ligipääsetavus" modaalis (Vaikus + Meloodia I–V).
Mootor: `components/room/AmbientAudio.jsx` (kaardistus `FILE_SRC`-is).

## Kaardistus (mode → fail → menüünimi)

| mode | fail (`public/audio/…`) | Menüü (ET) | kestus | allikas |
|------|--------------------------|------------|--------|---------|
| a | `atlasaudio-ambient-cinematic-510518.mp3` | Meloodia I — Hämarik | 2:04 | Pixabay |
| b | `atlasaudio-cinematic-softness-511863.mp3` | Meloodia II — Pehmus | 2:00 | Pixabay |
| c | `the_mountain-delicate-cinematic-512628.mp3` | Meloodia III — Õrnus | 2:06 | Pixabay |
| d | `satie-gymnopedie-1-alciatore-pd.mp3` | Meloodia IV — Satie, Gymnopédie nr 1 | 3:04 | Wikimedia Commons |
| e | `bach-wtc1-prelude-bwv846-ishizaka-cc0.mp3` | Meloodia V — Bach, prelüüd C-duur | 2:43 | Internet Archive |

a–c nimed on meeleolu järgi pandud; d–e kannavad teose päris nime, sest
konkreetset kompositsiooni ei tohi meeleolusõna taha peita. Sildid:
`messages/{et,en,ru}.json` → `accessibility.options.ambient.{a..e}`.
Helitase: `FILE_LEVELS` AmbientAudio.jsx-is (a=0.32, b/c=0.30, d/e=0.40).

**d/e helitase on esialgne.** Klaverisalvestise keskmine valjus on madalam
kui toodetud ambientil, aga LUFS-mõõtu siin masinal tehtud ei ole (ffmpeg
puudub) — 0.40 on hinnang, mis vajab kõrvaga ülekuulamist a–c kõrval.

## Litsents (AVALIK sait!)

Klassika juures kehtib reegel, mis ei ole ilmselge: **teos ja salvestis on
eraldi õigused.** Satie (1925), Bach — teosed on ammu avalikus omandis, aga
iga konkreetne esitus kannab esitaja ja fonogrammitootja õigusi (EL-is 70
aastat avaldamisest). "Helilooja on avalikus omandis" ei tee ühtki juhuslikku
salvestist vabaks. Allpool on iga faili päritolu jälgitav.

| mode | litsents | esitaja | tõend |
|------|----------|---------|-------|
| a–c | [Pixabay Content License](https://pixabay.com/service/license-summary/) | — | tasuta ka äriliselt, atributsioon ei ole nõutud |
| d | avalik omand (autoriõiguse omaja loovutus) | Robin Alciatore | [Wikimedia Commons failileht](https://commons.wikimedia.org/wiki/File:Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg), algallikas Musopen |
| e | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Kimiko Ishizaka | [Internet Archive](https://archive.org/details/bach-well-tempered-clavier-book-1), projekt [welltemperedclavier.org](https://welltemperedclavier.org/) |

`d` on Commonsi MP3-transkood Ogg Vorbis originaalist (originaal 3,53 MB ogg;
Safari ei mängi Oggi, seepärast transkood). `e` on Ishizaka *Open
Well-Tempered Clavier* — Kickstarteril rahastatud just selleks, et CC0 alla
lasta; salvestatud Bösendorfer 280-l Teldexi stuudios Berliinis.

Uusi lugusid lisades kasuta ainult salvestist, mille avalikuks esitamiseks on
õigus (Pixabay / CC0 / avalik omand / ostetud litsents). **CC BY-SA ja CC
BY-NC-ND ei kõlba** — share-alike nõuab litsentsi edasikandmist ja NC välistab
ärilise kasutuse. Nii kukkus välja nt Commonsi `Erik Satie - Gnossienne no
1.ogg` (CC BY-SA 3.0 + tuvastamata esitaja).

## Loo vahetamine / lisamine

- **Muuda lugu:** asenda fail samas kaustas ja uuenda `FILE_SRC`-i
  baasnimi (ilma `.mp3` laiendita) `AmbientAudio.jsx`-is.
- **Lisa lugu:** fail kausta + kirje `FILE_SRC`-i + täht `AMBIENT_MODES`-i +
  tase `FILE_LEVELS`-i + sildid kolme keelefaili. Modaal ja kõnni-lüliti
  tuletavad valikud `AMBIENT_MODES`-ist, neid eraldi puutuda ei ole vaja.
- **Failinimi ilma `.mp3`-ta** läheb `FILE_SRC`-i; MP3-st piisab
  (mängib kõigis brauserites, ka Safaris).
- Faili nõuded: rahulik instrumentaal-**loop**, ~1–4 MB, ilma järsu
  alguse/lõputa (mängitakse silmusena), vaikne tase. Kestus peab olema
  vähemalt ~8 s, muidu crossfade-silmus ei käivitu (`XFADE + 3`).

## Tagavara

Kui mõne mode'i fail puudub või ei lae, mängib WebAudio-süntees
(a = lounge-klaver, b–e = pehmed padjad) — nii ei jää platvorm tummaks.
Süntees EI mängi enam faili laadimise ajal "sillana" (kuni fail laeb, on
lühike vaikus). d/e süntees ei jäljenda Satiet ega Bachi, vaid hoiab ainult
loo helistikku (d = G-duur, e = C-duur).
