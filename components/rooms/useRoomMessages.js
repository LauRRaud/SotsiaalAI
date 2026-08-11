"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  EMPTY_ROOM_META,
  createRoomMessageSession,
  mergeById
} from "@/lib/rooms/roomMessageSession";

/**
 * Kest ümber `createRoomMessageSession`-i (SOL-ROOM-02, SOL-ROOM-03).
 *
 * Kogu ajastus — abort, põlvkond, taimerid, SSE elutsükkel ja terminaalne 401/403 — elab
 * seansis, mis on Reactist väljas ja seetõttu tõendatav. Siin jääb ainult kaks asja:
 * seansi elu seotakse RUUMI IDENTITEEDIGA (mitte muutuva olekuga, mis lammutas varem just
 * avatud ühenduse) ja seisupilt peegeldatakse Reacti.
 */
export function useRoomMessages(roomId, pollMs = 3000, options = {}) {
  const initialIsHelpMatchRoom = options.initialIsHelpMatchRoom === true;
  const [snapshot, setSnapshot] = useState(() => ({
    messages: [],
    blocked: false,
    authRequired: false,
    useSse: false,
    meta: {
      ...EMPTY_ROOM_META,
      roomId: String(roomId || ""),
      isHelpMatchRoom: initialIsHelpMatchRoom
    }
  }));
  const sessionRef = useRef(null);

  useEffect(() => {
    setSnapshot({
      messages: [],
      blocked: false,
      authRequired: false,
      useSse: false,
      meta: {
        ...EMPTY_ROOM_META,
        roomId: String(roomId || ""),
        isHelpMatchRoom: initialIsHelpMatchRoom
      }
    });

    if (!roomId) {
      sessionRef.current = null;
      return undefined;
    }

    const session = createRoomMessageSession({
      roomId,
      pollMs,
      initialIsHelpMatchRoom,
      onChange: (next) => setSnapshot(next)
    });
    sessionRef.current = session;
    session.start();

    return () => {
      session.close();
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // AINULT ruumi identiteet ja seaded. Muutuv olek elab seansis — vastasel juhul
    // lammutaks iga olekumuutus just avatud ühenduse (SOL-ROOM-03).
  }, [roomId, pollMs, initialIsHelpMatchRoom]);

  const reload = useCallback(() => sessionRef.current?.reload(), []);

  // Optimistlik lisamine jääb kliendi käes: seanss ühendab ta järgmisel laadimisel oma
  // loendiga sama `mergeById` reegli järgi.
  const setMessages = useCallback(updater => {
    setSnapshot(prev => {
      const nextMessages = typeof updater === "function" ? updater(prev.messages) : updater;
      return { ...prev, messages: mergeById([], nextMessages) };
    });
  }, []);

  const metaMatchesRoom = snapshot.meta.roomId === String(roomId || "");
  return {
    messages: snapshot.messages,
    blocked: snapshot.blocked,
    authRequired: snapshot.authRequired,
    roomTitle: metaMatchesRoom ? snapshot.meta.roomTitle : "",
    roomRole: metaMatchesRoom ? snapshot.meta.roomRole : "",
    isHelpMatchRoom: metaMatchesRoom ? snapshot.meta.isHelpMatchRoom : initialIsHelpMatchRoom,
    roomOrigin: metaMatchesRoom ? snapshot.meta.roomOrigin : null,
    summaryApprovals: metaMatchesRoom ? snapshot.meta.summaryApprovals : [],
    reload,
    setMessages,
    useSse: snapshot.useSse
  };
}
