"use client";

import { useRef } from "react";

/**
 * Lukk kirjutavale tegevusele: teine vajutus (või Enter) sama päringu ajal ei
 * saada teist päringut. Nuppu ennast välja ei lülitata (see viiks klaviatuuri
 * fookuse ära); vaade näitab, et päring on teel (`aria-busy`).
 *
 * Tagastab funktsiooni `once(send)`: kutsub `send` ja annab selle tulemuse;
 * kui eelmine saatmine on veel teel, ei kutsu ja annab `false`.
 */
export function useSendOnce() {
  const sending = useRef(false);
  return async (send) => {
    if (sending.current) return false;
    sending.current = true;
    try {
      return await send();
    } finally {
      sending.current = false;
    }
  };
}
