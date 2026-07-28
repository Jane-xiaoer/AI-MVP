/**
 * /api/visit — 居家馆访客计数(低调版)
 * 复用 ai-mvp 已配的 Upstash KV。每访客每天只算一次(SET seen NX EX)。
 *   POST → 记一次(新访客才 +1),返回 { total, today }
 *   GET  → 只读 { total, today }
 * 键空间加 home: 前缀,与弹药库/超分限流不撞。没配 KV 时优雅返回 0。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFingerprint } from '../lib/ratelimit.js';

const UPSTASH_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!UPSTASH_URL && !!UPSTASH_TOKEN;

const NS = 'home';
const TOTAL_KEY = `${NS}:visits:total`;

function todayStr(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 中国时区
  return d.toISOString().slice(0, 10);
}

async function kv(path: string): Promise<any> {
  const r = await fetch(`${UPSTASH_URL}/${path}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return (await r.json()) as { result?: any };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!HAS_REDIS) {
    return res.status(200).json({ total: 0, today: 0 });
  }

  const day = todayStr();
  const todayKey = `${NS}:visits:${day}`;

  try {
    if (req.method === 'POST') {
      const fp = getFingerprint(req);
      const seenKey = encodeURIComponent(`${NS}:seen:${day}:${fp}`);
      // 今日该访客只算一次:SET seen 1 EX 90000 NX(存在则返回 null,不重复计)
      const setRes = await kv(`set/${seenKey}/1/EX/90000/NX`);
      if (setRes?.result === 'OK') {
        await kv(`incr/${encodeURIComponent(TOTAL_KEY)}`);
        await kv(`incr/${encodeURIComponent(todayKey)}`);
        await kv(`expire/${encodeURIComponent(todayKey)}/172800`); // 当日键留 48h
      }
    }

    const g = async (k: string) => Number((await kv(`get/${encodeURIComponent(k)}`))?.result || 0);
    const [total, today, upTotal, upToday, u2k, u4k, u8k] = await Promise.all([
      g(TOTAL_KEY),
      g(todayKey),
      g(`${NS}:upscale:total`),
      g(`${NS}:upscale:${day}`),
      g(`${NS}:upscale:2k:${day}`),
      g(`${NS}:upscale:4k:${day}`),
      g(`${NS}:upscale:8k:${day}`),
    ]);
    return res.status(200).json({
      total, // 累计访客
      today, // 今日访客
      upscales: upTotal, // 累计超分
      upscalesToday: upToday, // 今日超分
      tiersToday: { '2k': u2k, '4k': u4k, '8k': u8k }, // 今日各档
    });
  } catch (e) {
    console.error('visit error:', e);
    return res.status(200).json({ total: 0, today: 0 });
  }
}
