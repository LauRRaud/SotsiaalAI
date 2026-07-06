import crypto from "node:crypto";
import { getRedisClients } from "./redis";
const subscribers = new Map();
const nodeId = crypto.randomUUID();
const CHANNEL = "room-events";
const {
  pub: redisPub,
  sub: redisSub
} = getRedisClients();
if (redisSub) {
  redisSub.on("message", (_channel, payload) => {
    try {
      const {
        roomId,
        event,
        node
      } = JSON.parse(payload);
      if (node && node === nodeId) return;
      emitLocal(roomId, event);
    } catch (err) {
      console.error("[roomStream] parse error", err);
    }
  });
  redisSub.subscribe(CHANNEL).catch(err => console.error("[roomStream] subscribe failed", err));
}
function emitLocal(roomId, event) {
  const set = subscribers.get(String(roomId));
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch {}
  }
}
export function publishRoomEvent(roomId, event) {
  emitLocal(roomId, event);
  if (redisPub) {
    redisPub.publish(CHANNEL, JSON.stringify({
      roomId,
      event,
      node: nodeId
    })).catch(() => {});
  }
}
export function subscribeRoom(roomId, fn) {
  const key = String(roomId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  const set = subscribers.get(key);
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) subscribers.delete(key);
  };
}