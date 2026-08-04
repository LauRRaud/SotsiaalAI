// SK-V1 E4 — „mis lauad on minu omad".
//
// Laudade nimekiri tuleb LIIKMELISUSEST, mitte päringust: töötaja ei pea laua
// ID-d teadma ega saa teda ka ära arvata. Omanik loeb siin mehitajaks, sama
// reegel mis `isDeskStaff`-is — muidu jääks laud oma omanikule nähtamatuks.

/**
 * Lauad, mille taga see inimene istub.
 *
 * NB: siin ei kontrollita valmidust. Suletud laud jääb oma töötajale nähtavaks
 * — ta peab nägema, et piirkond on kinni, ja nägema seal seisvaid vanu
 * pöördumisi. Valmidus otsustab ainult selle, kas UUS pöördumine saab tekkida.
 */
export async function listMyUrgentDesks({ prisma, userId }) {
  const id = String(userId || "").trim();
  if (!id) return [];

  const [memberships, owned] = await Promise.all([
    prisma.urgentDeskMember.findMany({ where: { userId: id, isActive: true }, take: 100 }),
    prisma.urgentDesk.findMany({ where: { ownerUserId: id }, take: 100 })
  ]);

  const deskIds = new Set([...memberships.map((row) => row.deskId), ...owned.map((row) => row.id)]);
  const desks = [];
  for (const deskId of deskIds) {
    const desk = await prisma.urgentDesk.findFirst({ where: { id: deskId } });
    if (!desk) continue;
    const municipality = await prisma.municipality.findFirst({ where: { id: desk.municipalityId } });
    desks.push({
      id: desk.id,
      publicName: desk.publicName,
      municipalityId: desk.municipalityId,
      municipalityName: municipality?.displayName || desk.municipalityId,
      recipientType: desk.recipientType,
      isActive: desk.isActive === true,
      readingTimePromise: desk.readingTimePromise
    });
  }
  return desks.sort((a, b) => String(a.publicName).localeCompare(String(b.publicName)));
}
