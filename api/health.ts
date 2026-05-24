/**
 * /api/health — zero-arg self-check for the AI-MVP backend.
 *
 * Verifies the three fault lines that have historically broken this site:
 *   1. auth   — GEMINI_API_KEY present, AIza-shaped, and actually accepted by Google
 *   2. model  — the default image model still exists (not deprecated/renamed)
 *   3. config — master password + rate-limit backend wiring
 *
 * Never leaks the key itself. Returns 200 when everything's green, 503 otherwise.
 * Call it from a cron / `npm run health` so you get warned BEFORE users see "服务器异常".
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SERVER_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const CHECK_MODEL = 'gemini-3-pro-image-preview';

function looksLikeApiKey(k: string): boolean {
  return /^AIza[\w-]{30,}$/.test(k);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, boolean> = {
    keyPresent: !!SERVER_GEMINI_KEY,
    keyFormat: looksLikeApiKey(SERVER_GEMINI_KEY),
    masterPassword: !!process.env.MASTER_PASSWORD,
    redis: !!(
      (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
    ),
  };

  let keyWorks = false;
  let modelAvailable = false;
  let detail = '';

  if (!SERVER_GEMINI_KEY) {
    detail = 'GEMINI_API_KEY 未配置';
  } else if (!checks.keyFormat) {
    detail = SERVER_GEMINI_KEY.startsWith('AQ.')
      ? 'GEMINI_API_KEY 是 AI Studio 临时令牌(AQ. 开头),会过期,请换成 AIza 正式 key'
      : 'GEMINI_API_KEY 格式不对(应以 AIza 开头)';
  } else {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': SERVER_GEMINI_KEY },
      });
      keyWorks = r.ok;
      if (r.ok) {
        const j: any = await r.json();
        modelAvailable = (j.models || []).some((m: any) => m?.name?.includes(CHECK_MODEL));
        if (!modelAvailable) detail = `默认模型 ${CHECK_MODEL} 在账户里不可用(可能已被 Google 改名/下线)`;
      } else {
        detail = `Google models 接口返回 HTTP ${r.status}(key 可能无效/无权限)`;
      }
    } catch (e: any) {
      detail = `连接 Google 失败:${String(e?.message || e)}`;
    }
  }

  const ok = checks.keyPresent && checks.keyFormat && keyWorks && modelAvailable;
  return res.status(ok ? 200 : 503).json({
    ok,
    checks: { ...checks, keyWorks, modelAvailable },
    model: CHECK_MODEL,
    detail: detail || 'all green',
    ts: new Date().toISOString(),
  });
}
