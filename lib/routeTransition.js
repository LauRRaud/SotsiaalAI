// Route-üleminek (visuaalne animatsioon + navigatsiooni-viivitus) on eemaldatud —
// see oli osa vanast kujundusest (Fable 5 teeb uue). Funktsioonid on säilitatud
// õhukeste navigatsiooni-mähistena, et kõik call-saidid töötaksid muutmata.
// Kolmas argument (options) on tahtlikult ignoreeritud (varem viivitus/üleminek).

export function pushWithTransition(router, href) {
  router.push(href);
}

export function backWithTransition(router) {
  router.back();
}
