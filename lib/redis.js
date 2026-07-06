import Redis from "ioredis";
let pub = null;
let sub = null;
export function getRedisClients() {
  const url = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || process.env.UPSTASH_REDIS_URL;
  if (!url) return {
    pub: null,
    sub: null
  };
  if (!pub) {
    pub = new Redis(url, {
      lazyConnect: true
    });
    sub = new Redis(url, {
      lazyConnect: true
    });
    pub.on("error", err => console.error("[redis pub] error", err));
    sub.on("error", err => console.error("[redis sub] error", err));
    pub.connect().catch(() => {});
    sub.connect().catch(() => {});
  }
  return {
    pub,
    sub
  };
}