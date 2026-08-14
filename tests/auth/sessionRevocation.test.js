import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SESSION_REVOKE_ALREADY_GONE,
  SESSION_REVOKE_FOREIGN,
  SESSION_REVOKE_OK,
  revokeTrackedSession
} from "../../lib/auth/sessionRevocation.js";

function makeDb(rows = [], { failDelete = false } = {}) {
  const state = rows.map((row) => ({ ...row }));
  const calls = { deletes: 0, reads: 0 };

  return {
    calls,
    rows: () => state.map((row) => ({ ...row })),
    session: {
      async deleteMany({ where }) {
        calls.deletes += 1;
        if (failDelete) throw new Error("db down");
        const before = state.length;
        for (let index = state.length - 1; index >= 0; index -= 1) {
          const row = state[index];
          if (row.id === where.id && (!where.userId || row.userId === where.userId)) {
            state.splice(index, 1);
          }
        }
        return { count: before - state.length };
      },
      async findUnique({ where }) {
        calls.reads += 1;
        const row = state.find((entry) => entry.id === where.id);
        return row ? { id: row.id } : null;
      }
    }
  };
}

test("õnnestunud tühistus kustutab täpselt oma rea", async () => {
  const db = makeDb([
    { id: "s1", userId: "u1" },
    { id: "s2", userId: "u1" },
    { id: "s3", userId: "u2" }
  ]);

  const result = await revokeTrackedSession({ db, userId: "u1", sessionRecordId: "s1" });

  assert.deepEqual(result, { ok: true, outcome: SESSION_REVOKE_OK });
  assert.deepEqual(
    db.rows().map((row) => row.id),
    ["s2", "s3"],
    "teise seadme ja teise kasutaja read peavad alles jääma"
  );
});

test("juba kadunud rida on soovitud lõppseis, võõras rida EI OLE", async () => {
  const gone = makeDb([{ id: "s2", userId: "u1" }]);
  assert.deepEqual(await revokeTrackedSession({ db: gone, userId: "u1", sessionRecordId: "s1" }), {
    ok: true,
    outcome: SESSION_REVOKE_ALREADY_GONE
  });

  // Sama nähtav signaal (`count === 0`), täiesti vastupidine tähendus: rida on olemas,
  // aga kuulub kellelegi teisele — siis EI OLE me midagi tühistanud.
  const foreign = makeDb([{ id: "s1", userId: "u2" }]);
  const result = await revokeTrackedSession({ db: foreign, userId: "u1", sessionRecordId: "s1" });
  assert.deepEqual(result, { ok: false, reason: SESSION_REVOKE_FOREIGN });
  assert.equal(foreign.rows().length, 1, "võõrast rida ei tohi kustutada");
});

test("andmebaasi viga EI TOHI paista õnnestumisena", async () => {
  const db = makeDb([{ id: "s1", userId: "u1" }], { failDelete: true });

  await assert.rejects(
    () => revokeTrackedSession({ db, userId: "u1", sessionRecordId: "s1" }),
    /db down/u,
    "viga peab kutsujani jõudma — vana rada neelas ta ja väljalogimine lõppes eduga"
  );
  assert.equal(db.rows().length, 1, "rida jääb alles, seega sessioon on endiselt kehtiv");
});

test("puuduv viide ei anna vaikset õnnestumist", async () => {
  const db = makeDb([{ id: "s1", userId: "u1" }]);
  assert.deepEqual(await revokeTrackedSession({ db, userId: "u1", sessionRecordId: "" }), {
    ok: false,
    reason: "missing_session_reference"
  });
  assert.equal(db.calls.deletes, 0);
});

// === Marsruudi ja liidese leping ============================================

test("logout-marsruut võtab sessiooniviite TOKENIST, mitte kliendi kehast", async () => {
  const route = await readFile(new URL("../../app/api/profile/logout/route.js", import.meta.url), "utf8");

  assert.match(route, /getToken/u);
  assert.match(route, /token\?\.sessionRecordId/u);
  assert.doesNotMatch(
    route,
    /body\?\.sessionRecordId|body\.sessionRecordId/u,
    "kliendi antud sessiooni-ID oleks võõra sessiooni tühistamise tee"
  );
  assert.match(route, /revokeTrackedSession/u);
  // Tõrge peab jõudma kasutajani, mitte logisse.
  assert.match(route, /REVOKE_FAILED/u);
});

test("liides kutsub signOut'i ALLES pärast serveri kinnitust", async () => {
  const source = await readFile(new URL("../../components/alalehed/ProfiilBody.jsx", import.meta.url), "utf8");
  // Kommentaarid välja: nad NIMETAVAD `signOut()`-i enne kutset ja järjekorra mõõtmine
  // loeks siis kommentaari kutseks. (Esimene jooks kukkus täpselt selle peale.)
  const body = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");
  const start = body.indexOf("const handleLogout = async ()");
  const handler = body.slice(start, body.indexOf("const handleLogoutAll", start));

  assert.ok(start > -1 && handler.length > 0);
  const fetchAt = handler.indexOf("/api/profile/logout");
  const guardAt = handler.indexOf("if (!res.ok)");
  const signOutAt = handler.indexOf("signOut(");

  assert.ok(fetchAt > -1, "väljalogimine peab serverit küsima");
  assert.ok(guardAt > fetchAt && signOutAt > guardAt, "küpsis tohib kaduda alles pärast kinnitust");
});

test("ruumi kõik väljalogimised kasutavad revokatsioon-esmalt rada", async () => {
  const source = await readFile(new URL("../../components/room/RoomStage.jsx", import.meta.url), "utf8");
  const body = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");
  const start = body.indexOf("const powerOff = useCallback(");
  const handler = body.slice(start, body.indexOf("useEffect(", start));

  assert.ok(start > -1 && handler.length > 0);
  const fetchAt = handler.indexOf("/api/profile/logout");
  const guardAt = handler.indexOf("if (!res.ok)");
  const signOutAt = handler.indexOf("signOut(");
  assert.ok(fetchAt > -1, "ruumi väljalogimine peab serveris sessiooni tühistama");
  assert.ok(guardAt > fetchAt && signOutAt > guardAt, "küpsis tohib kaduda alles pärast edukat revokatsiooni");
  assert.equal(
    (body.match(/signOut\(/gu) || []).length,
    1,
    "RoomStage'is ei tohi olla revokatsioonirajast mööduvaid signOut-kutseid"
  );
});

test("NextAuth event ei teeskle best-effort revokatsiooni", async () => {
  const auth = await readFile(new URL("../../auth.js", import.meta.url), "utf8");
  assert.doesNotMatch(auth, /async signOut\(message\)/u);
  assert.doesNotMatch(auth, /tracked session cleanup failed/u);
});
