// COLLAB-P4 — kirjaliku ruumi avamine kliendi kinnitatud võrgustikujagamisest.
//
// Ruum avaneb SAATMISEL, mitte mustandi loomisel: kinnitamata jagamisel ei tohi
// olla ühtki pinda, kuhu keegi saaks midagi kirjutada.
//
// LAHTINE TOOTEOTSUS — kes on ruumi liige.
// Praegu: **töötaja + saaja**. Klient EI ole ruumi liige, vaid näeb jagamist ja
// selle olekut oma jagamiste vaates ning saab ta lõpetada.
// Põhjus: klient kinnitas KOKKUVÕTTE, mitte kogu edasise erialase arutelu, ja
// vaikiv kaasamine tähendaks, et ta loeb vestlust, millega ta ei nõustunud.
// Vastuargument on sama kaalukas („mitte midagi minu kohta ilma minuta") ja see
// otsus vajab omaniku sõna — kuni selleni on valitud kitsam variant, sest
// liikme LISAMINE on hiljem lihtne, eemaldamine mitte.

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
 * Liikmed on TÄPSELT kaks: koostanud töötaja ja saaja. Mõlemad on
 * olemasolevad kasutajad — see on juba `createNetworkShare` väravaga tagatud,
 * siin ainult ei laiendata seda.
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

  const members = [...new Set([share.workerId, share.recipientUserId].filter(Boolean))];
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
