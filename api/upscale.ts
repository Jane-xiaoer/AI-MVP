/**
 * /api/upscale — Vercel serverless function (居家馆 · AI 超分展品)
 *
 * 公开免费超分，算力走 Replicate，Jane 预付 credit 硬封顶。三档:
 *   2K / 4K → nightmareai/real-esrgan  (快、便宜 ~$0.002、保真)
 *   8K      → philz1337x/clarity-upscaler (能出大图 ~$0.02、创意增强，参数已调偏保真)
 *
 * 护栏:
 *   1. 只收图片      —— image 必须是 data:image/(png|jpeg|webp);base64,...
 *   2. 单张大小上限  —— 解码后 > MAX_INPUT_BYTES 直接拒
 *   3. 每 IP 每日限量 —— 总 5 张/IP/天(任意档);其中 8K 最多 2 张/IP/天
 *   4. 全站月度封顶  —— KV 加权计数(8K 计 8 单位),超 UPSCALE_MONTHLY_CAP 停免费
 *      (真正的硬闸是 Replicate 账号里预付的 credit;这里是 App 层第二道保险)
 *
 * 图片不落 Jane 的机器:浏览器 → 本函数 → Replicate → 返回 Replicate CDN 链接(24h 过期)。
 *
 * Env(在 Vercel 项目 ai-mvp 里配):
 *   REPLICATE_API_TOKEN       — 必填(r8_...)
 *   UPSCALE_FREE_DAILY_LIMIT  — 每 IP 每日总张数,默认 5
 *   UPSCALE_8K_DAILY_LIMIT    — 其中 8K 每 IP 每日上限,默认 2
 *   UPSCALE_MONTHLY_CAP       — 全站月度"单位"上限,默认 800(8K 计 8 单位)
 *   KV_REST_API_URL / _TOKEN  — Upstash Redis(跨实例限流 + 月度计数)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getFingerprint } from '../lib/ratelimit.js';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const TOTAL_DAILY = Number(process.env.UPSCALE_FREE_DAILY_LIMIT || 6);
const EIGHTK_DAILY = Number(process.env.UPSCALE_8K_DAILY_LIMIT || 2);
const MONTHLY_CAP = Number(process.env.UPSCALE_MONTHLY_CAP || 800);
const MAX_INPUT_BYTES = Number(process.env.UPSCALE_MAX_INPUT_BYTES || 10 * 1024 * 1024);

// 档位 → 引擎 / 模型 / 倍数 / 月度权重(≈相对成本)
const TIERS: Record<
  string,
  { engine: 'esrgan' | 'clarity'; model: string; scale: number; weight: number }
> = {
  '2k': { engine: 'esrgan', model: 'nightmareai/real-esrgan', scale: 2, weight: 1 },
  '4k': { engine: 'esrgan', model: 'nightmareai/real-esrgan', scale: 4, weight: 1 },
  '8k': { engine: 'clarity', model: 'philz1337x/clarity-upscaler', scale: 4, weight: 8 },
};

const UPSTASH_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!UPSTASH_URL && !!UPSTASH_TOKEN;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 各模型最新 version 缓存(避免写死会过期的 hash)
const versionCache: Record<string, string> = {};
async function latestVersion(model: string, token: string): Promise<string> {
  if (versionCache[model]) return versionCache[model];
  const r = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`replicate model lookup ${model} ${r.status}`);
  const data = (await r.json()) as { latest_version?: { id?: string } };
  const id = data.latest_version?.id;
  if (!id) throw new Error('replicate: no latest_version for ' + model);
  versionCache[model] = id;
  return id;
}

// 月度全站加权计数(仅配了 KV 时生效;成功计费才加)
function monthKey(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 中国时区
  return `upscale:runs:${d.toISOString().slice(0, 7)}`; // YYYY-MM
}
async function monthlyCount(): Promise<number> {
  if (!HAS_REDIS) return 0;
  try {
    const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(monthKey())}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = (await r.json()) as { result?: number | string };
    return Number(data.result || 0);
  } catch {
    return 0;
  }
}
async function monthlyIncrBy(n: number): Promise<void> {
  if (!HAS_REDIS) return;
  try {
    await fetch(`${UPSTASH_URL}/incrby/${encodeURIComponent(monthKey())}/${n}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  } catch {
    /* best-effort */
  }
}

// 统一调 Replicate:创建预测(Prefer: wait)→ 轮询到终态。返回最终 prediction 对象
// (可能是错误对象,如 402 余额不足:{status:<number>, detail, title})。
async function runReplicate(version: string, input: Record<string, unknown>): Promise<any> {
  let pred = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ version, input }),
  }).then((r) => r.json() as Promise<any>);

  if (typeof pred?.status === 'number' || pred?.detail) return pred; // HTTP 错误对象

  const deadline = Date.now() + 270_000;
  while (
    pred?.status &&
    !['succeeded', 'failed', 'canceled'].includes(pred.status) &&
    Date.now() < deadline &&
    pred?.urls?.get
  ) {
    await sleep(1500);
    pred = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    }).then((r) => r.json() as Promise<any>);
  }
  return pred;
}

type UpscalePayload = { image?: string; tier?: string; scale?: number; scaleFactor?: number; faceEnhance?: boolean };

const DATA_URI_RE = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!REPLICATE_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: 'server_misconfigured',
      message: '超分服务未配置(缺 REPLICATE_API_TOKEN)。',
    });
  }

  // ───── 状态轮询:GET /api/upscale?id=<predictionId> ─────
  // 每次请求都很短(<2s),前端每隔几秒查一次,直到出结果——避免长连接被掐(NetworkError)。
  if (req.method === 'GET') {
    const id = String((req.query?.id as string) || '');
    if (!/^[\w-]+$/.test(id)) {
      return res.status(400).json({ ok: false, error: 'bad_id' });
    }
    try {
      const pred = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
      }).then((r) => r.json() as Promise<any>);

      if (pred?.status === 'succeeded') {
        const out = pred.output;
        const url = Array.isArray(out) ? out[0] : out;
        if (!url || typeof url !== 'string') {
          return res.status(200).json({ ok: false, done: true, message: '超分未返回结果，请重试。' });
        }
        return res.status(200).json({ ok: true, done: true, image: url });
      }
      if (pred?.status === 'failed' || pred?.status === 'canceled') {
        const raw = String(pred?.error || pred?.status || 'failed');
        console.error('upscale prediction failed:', raw);
        const oom = /out of memory|cuda|memory/i.test(raw);
        return res.status(200).json({
          ok: false,
          done: true,
          message: oom
            ? '这张图太大，放大后超出显存了~换张小一点的原图,或选低一档再试。'
            : '超分失败了，请重试或换张图。',
        });
      }
      // 还在跑(starting / processing)
      return res.status(200).json({ ok: true, done: false, status: pred?.status || 'processing' });
    } catch {
      // 轮询这次网络抖动 → 当作"还没好",前端会继续查
      return res.status(200).json({ ok: true, done: false, status: 'processing' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body: UpscalePayload;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  // ───── 护栏 1:只收图片 ─────
  const image = (body.image || '').trim();
  const m = DATA_URI_RE.exec(image);
  if (!m) {
    return res.status(400).json({ ok: false, error: 'bad_image', message: '请上传 PNG / JPG / WEBP 图片。' });
  }

  // ───── 护栏 2:单张大小上限 ─────
  const approxBytes = Math.floor(m[2].length * 0.75);
  if (approxBytes > MAX_INPUT_BYTES) {
    return res.status(413).json({
      ok: false,
      error: 'too_large',
      message: `图片太大了(上限 ${Math.round(MAX_INPUT_BYTES / 1024 / 1024)}MB),换张小一点的原图。`,
    });
  }

  // 兼容旧 payload:没传 tier 时按 scale 猜(2→2k,其余→4k)
  const tierKey =
    body.tier && TIERS[body.tier] ? body.tier : body.scale === 2 ? '2k' : '4k';
  const cfg = TIERS[tierKey];
  const faceEnhance = !!body.faceEnhance;

  // ───── 护栏 4:全站月度封顶(先查) ─────
  if (MONTHLY_CAP > 0 && (await monthlyCount()) >= MONTHLY_CAP) {
    return res.status(503).json({
      ok: false,
      error: 'monthly_cap',
      message: '本月的免费超分额度用满啦，下个月再来~(小耳自掏腰包，额度有限)。',
    });
  }

  // ───── 护栏 3:每 IP 每日限量 ─────
  // 总 5 张/IP/天(任意档);其中 8K 最多 2 张/IP/天。共用弹药库 Upstash,键加前缀防撞。
  const ipfp = getFingerprint(req);
  if (tierKey === '8k') {
    const r8 = await checkRateLimit('upscale8k:' + ipfp, EIGHTK_DAILY);
    if (!r8.allowed) {
      return res.status(429).json({
        ok: false,
        error: 'rate_limit_8k',
        message: `8K 今天最多 ${EIGHTK_DAILY} 张(它成本高)，试试 2K / 4K，或明天再来~`,
        remaining: r8.remaining,
        reset: r8.reset,
      });
    }
  }
  const rt = await checkRateLimit('upscale:' + ipfp, TOTAL_DAILY);
  if (!rt.allowed) {
    return res.status(429).json({
      ok: false,
      error: 'rate_limit',
      message: `今天的免费超分次数用完了(每日 ${TOTAL_DAILY} 张)，明天再来吧~`,
      remaining: rt.remaining,
      reset: rt.reset,
    });
  }

  // ───── 组装引擎入参 ─────
  const input: Record<string, unknown> =
    cfg.engine === 'clarity'
      ? {
          image,
          // 8K 用前端按图算的动态倍数直冲 ~7680(夹在 2–8),不再固定 ×4 和 4K 撞
          scale_factor: Math.min(8, Math.max(2, Number(body.scaleFactor) || cfg.scale)),
          creativity: 0.25, // 低=少脑补,偏保真
          resemblance: 1.5, // 高=更贴近原图
          dynamic: 6,
          num_inference_steps: 18, // 异步后不赶超时,用默认步数保质量
          sharpen: 0,
        }
      : { image, scale: cfg.scale, face_enhance: faceEnhance };

  // ───── 创建 Replicate 任务(不等它跑完!立刻返回任务号,前端轮询 GET 拿结果) ─────
  // 8K 要 ~2-3 分钟。若在这里同步死等,长连接会被浏览器/手机网络掐断 → NetworkError。
  try {
    const version = await latestVersion(cfg.model, REPLICATE_TOKEN);
    const pred = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version, input }),
    }).then((r) => r.json() as Promise<any>);

    // 创建即错误(如 402 余额不足):{status:<number>, detail, title}
    if (!pred?.id || typeof pred?.status === 'number' || pred?.detail) {
      const code = typeof pred?.status === 'number' ? pred.status : 0;
      console.error('replicate create error:', code, pred?.detail || pred?.title);
      if (code === 402) {
        return res.status(503).json({
          ok: false,
          error: 'out_of_credit',
          message: '今天的免费超分额度用完啦，明天再来~(小耳自掏腰包，额度有限)。',
        });
      }
      return res.status(502).json({ ok: false, error: 'upscale_failed', message: '超分服务繁忙，请稍后再试。' });
    }

    await monthlyIncrBy(cfg.weight); // 已创建 = 会计费,记月度账
    return res.status(200).json({
      ok: true,
      id: pred.id,
      status: pred.status,
      tier: tierKey,
      remaining: Math.max(0, rt.remaining), // 剩余总张数
    });
  } catch (e: any) {
    console.error('upscale create error:', e);
    return res.status(502).json({
      ok: false,
      error: 'upscale_failed',
      message: e?.message ? `超分失败:${e.message}` : '超分失败,请稍后重试。',
    });
  }
}
