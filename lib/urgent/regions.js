// SK-V1 E3 — avatud piirkondade loend.
//
// Siin ei ole „kõigi omavalitsuste nimekirja". Inimene saab valida AINULT
// piirkondade vahel, kus rada päriselt olemas on — ja see ei ole mugavus, vaid
// sama lukk teisest otsast: kui ükski laud ei ole valmis, ei ole ka valikut,
// vormi ega nuppu.
//
// Tagajärg on see, mida leping ptk 5 haru B nõuab: kiireloomulise abi nupp ei
// tekita muljet öisest vastuvõtust seal, kus tegelikku mehitatud saajat ei ole.

import { deskReadiness, publicDeskProjection } from "@/lib/urgent/desk";

/**
 * Piirkonnad, kus rada on täna avatud.
 *
 * Valmiduse otsustab `deskReadiness` — sama funktsioon, mis lubab pöördumist
 * luua. Kaks eraldi reeglit läheksid ühel päeval lahku ja valik jääks alles
 * pärast seda, kui laud kinni pandi.
 */
export async function listOpenUrgentRegions({ prisma, now = () => new Date() }) {
  const at = now();
  // Eelfilter on ainult jõudluse pärast; õige vastuse annab `deskReadiness`.
  const desks = await prisma.urgentDesk.findMany({
    where: { isActive: true },
    orderBy: { publicName: "asc" },
    take: 500
  });

  const regions = [];
  for (const desk of desks) {
    const activeMemberCount = await prisma.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    if (!deskReadiness(desk, { now: at, activeMemberCount }).ready) continue;

    const municipality = await prisma.municipality.findFirst({ where: { id: desk.municipalityId } });
    regions.push({
      municipalityId: desk.municipalityId,
      municipalityName: municipality?.displayName || desk.municipalityId,
      desk: publicDeskProjection(desk)
    });
  }
  return regions;
}
