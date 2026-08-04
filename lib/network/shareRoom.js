// COLLAB-P4 — kirjaliku ruumi avamine kliendi kinnitatud võrgustikujagamisest.
//
// Ruum avaneb SAATMISEL, mitte mustandi loomisel: kinnitamata jagamisel ei tohi
// olla ühtki pinda, kuhu keegi saaks midagi kirjutada.
//
// KES ON RUUMI LIIGE — otsustatud (omanik 04.08): **kui kliendil on konto, on ta
// ruumis; kui ei ole, on ruumis töötaja ja saaja.**
//
// Kontoga klient lisatakse, sest ruum sündis tema enda eelpöördumisest ja tema
// kinnitatud kokkuvõttest — „mitte midagi minu kohta ilma minuta". Ta on tavaline
// `MEMBER`, mitte vaataja (`RoomRole` on `OWNER`/`MODERATOR`/`MEMBER`,
// vaatajarolli ei ole). Kirjutamisõigus on tahtlik: inimene, kes näeb enda kohta
// käivat arutelu, peab saama ka parandada.
//
// Kontota klienti EI SAA lisada — teda ei ole platvormil olemas. See ei ole
// lubaduse pehmendus, vaid tema enda info liigub temani töötaja kaudu, nagu ta
// liigub täna. Teadlik hind: kontota kliendi puhul ei ole see ruum tema jaoks
// läbipaistev, ja see on üks põhjus, miks konto pakkumine on väärt tegemist.

import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildRoomOrigin, ROOM_ORIGIN_TYPES } from "@/lib/rooms/origin";

function roomTitle(share, { purposeFallback = "Võrgustikutöö" } = {}) {
  const purpose = String(share?.purpose || "").replace(/\s+/g, " ").trim();
  if (!purpose) return purposeFallback;
  return purpose.length > 80 ? `${purpose.slice(0, 77)}…` : purpose;
}

/**
 * Loob (või tagastab olemasoleva) ruumi jagamise jaoks.
 *
 * Liikmed: koostanud töötaja (omanik), saaja ja — kui tal on konto — klient.
 * Kõik lisatavad on olemasolevad kasutajad; seda tagab juba `createNetworkShare`
 * ja siin ainult ei laiendata seda.
 */
export async function createRoomForNetworkShare({ share, db = defaultPrisma }) {
  if (!share?.id) throw new Error("network_share.not_found");
  if (share.roomId) {
    const existing = await db.room.findFirst({
      where: { id: share.roomId },
      select: { id: true, title: true }
    });
    if (existing) return existing;
  }

  // Klient esimesena, sest ruum on tema loo ümber — aga ainult siis, kui tal on
  // konto. `filter(Boolean)` viskab välise kliendi `null`-i välja. Set kaitseb
  // juhu eest, kus mõni roll kattub.
  const members = [...new Set([share.clientUserId, share.workerId, share.recipientUserId].filter(Boolean))];
  // Töötaja ja saaja on alati kaks eri inimest; klient on kolmas, kui on.
  if (members.length < 2) throw new Error("network_share.room_requires_two_parties");

  return db.room.create({
    data: {
      ownerId: share.workerId,
      title: roomTitle(share),
      // Kirjeldusse EI panda kokkuvõtte teksti — ruumi metaandmed on nähtavad
      // laiemalt kui jagatud sisu ja kokkuvõte peab jääma jagamise sisse.
      description: `networkShare:${share.id}`,
      ...buildRoomOrigin({
        originType: ROOM_ORIGIN_TYPES.NETWORK_SHARE,
        originId: share.id,
        originMeta: {
          // Jagamispiir käib ruumiga kaasas, et ta oleks arutelu ajal nähtav.
          sharingBoundary: String(share.sharingBoundary || "").slice(0, 500),
          participationEndsOn: share.participationEndsOn
            ? new Date(share.participationEndsOn).toISOString().slice(0, 10)
            : null
        }
      }),
      members: {
        create: members.map((memberId) => ({
          userId: memberId,
          role: memberId === share.workerId ? "OWNER" : "MEMBER",
          billingSource: "SELF"
        }))
      }
    },
    select: { id: true, title: true }
  });
}
