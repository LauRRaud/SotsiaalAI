// T03 E3: kasutaja nähtava sõnumi piir. Klient-ohutu (ilma serverimportideta), et sama
// väärtust saaks kasutada nii komposeri loendur kui ka serveri 413-värav.
export const MAX_USER_MESSAGE_CHARS = 4000;

// Millal näidata loendurit (piirile lähenedes), et see ei segaks tavakasutust.
export const MESSAGE_COUNTER_VISIBLE_FROM = MAX_USER_MESSAGE_CHARS - 300;
