/* Avaliku registreerimise ÜKS tõeallikas (T10 E3).
   Teadlik launch-lukk: väärtus on kõvakodeeritud, MITTE env-ist loetav —
   vana deploy-keskkonna REGISTRATION_OPEN=true ei tohi platvormi enne
   avalikku avamist kogemata avada. Avamine = üks muudatus siin failis;
   server (app/api/register/route.js), registreerimisleht, LoginModal ja
   hinnastuse CTA-d loevad kõik sama konstanti. */
export const REGISTRATION_OPEN = false;
