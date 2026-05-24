/**
 * /api/generate — Vercel serverless function
 *
 * Three-tier access:
 *   1. master  : caller sends correct master password → uses our GEMINI_API_KEY, unlimited
 *   2. byok    : caller sends a valid-looking Gemini API key → uses theirs, unlimited
 *   3. free    : neither → uses our key, IP+cookie rate-limited (default 3/day)
 *
 * Env vars (set in Vercel dashboard):
 *   GEMINI_API_KEY    — your Gemini key (required for master & free modes)
 *   MASTER_PASSWORD   — your admin password (required for master mode; set to "8005" or anything)
 *   KV_REST_API_URL   — optional: Upstash Redis URL for cross-instance rate limit
 *   KV_REST_API_TOKEN — optional: Upstash Redis token
 *
 * If Upstash isn't configured, falls back to in-memory counting (per serverless
 * instance) — inaccurate at scale but safe and zero-config.
 */
import { GoogleGenAI, Modality } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getFingerprint } from '../lib/ratelimit.js';

const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '';
const SERVER_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT || 3);

// A real Gemini API key looks like `AIzaSy...` (39 chars). Anything else —
// most notoriously an AI Studio *ephemeral token* (`AQ.Ab8...`) that expires
// in minutes — gets rejected by Google with a confusing 401
// ACCESS_TOKEN_TYPE_UNSUPPORTED. Catch that here and fail loudly instead.
function looksLikeApiKey(k: string): boolean {
  return /^AIza[\w-]{30,}$/.test(k);
}

// Whitelist of allowed Gemini image models. Same /api/generate can serve
// multiple frontends — headshot uses flash-image, camera museum uses
// 3-pro-image-preview. Include both `-preview` names and their stable
// counterparts so a Google rename doesn't take the whole site down.
const ALLOWED_MODELS = new Set<string>([
  'gemini-2.5-flash-image-preview',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
]);
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
// Stable, non-preview model we fall back to when the requested model has been
// deprecated/renamed by Google (the #2 historical failure mode of this site).
const STABLE_FALLBACK_MODEL = 'gemini-2.5-flash-image';

// Map a thrown Gemini/SDK error to a stable category + user-facing message, so
// the frontend (and our future selves) can tell *which* of the recurring fault
// lines fired instead of every failure just reading "服务器异常".
type ErrorType = 'auth' | 'quota' | 'model' | 'timeout' | 'unknown';
function classifyError(e: any): { type: ErrorType; http: number; message: string } {
  const msg = String(e?.message || e || '');
  if (/401|UNAUTHENTICATED|ACCESS_TOKEN|API key not valid|invalid authentication|PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return { type: 'auth', http: 502, message: 'Gemini 鉴权失败:服务器 API key 无效或已过期(需 AIza 开头的有效 key)' };
  }
  if (/quota|RESOURCE_EXHAUSTED|rate limit|\b429\b/i.test(msg)) {
    return { type: 'quota', http: 502, message: 'Gemini 配额用尽,请稍后再试或更换 key' };
  }
  if (/not found|NOT_FOUND|\b404\b|is not supported|does not exist|unsupported|deprecated/i.test(msg)) {
    return { type: 'model', http: 502, message: '图像模型不可用(可能已被 Google 下线或改名)' };
  }
  if (/timeout|deadline|ETIMEDOUT|aborted|FUNCTION_INVOCATION_TIMEOUT|\b504\b/i.test(msg)) {
    return { type: 'timeout', http: 504, message: '生成超时,图片可能过大或服务繁忙,请重试' };
  }
  return { type: 'unknown', http: 500, message: msg || '生成失败' };
}

// Two input shapes are accepted (mutually exclusive):
//   Simple:  { prompt, image: {base64, mimeType} }              ← legacy
//   Multi:   { parts: [{text}|{image:{base64,mimeType}}, ...] } ← AI-MVP / multi-image
type SimplePart = { text: string };
type ImagePart  = { image: { base64: string; mimeType: string } };
type AnyPart    = SimplePart | ImagePart;

type GeneratePayload = {
  prompt?: string;
  image?: { base64: string; mimeType: string };
  parts?: AnyPart[];
  model?: string;
  masterKey?: string;
  userApiKey?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body: GeneratePayload;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  // Build the Gemini parts array from whichever payload shape the caller used.
  let geminiParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (Array.isArray(body.parts) && body.parts.length) {
    for (const p of body.parts) {
      if ('text' in p && typeof p.text === 'string') {
        geminiParts.push({ text: p.text });
      } else if ('image' in p && p.image?.base64 && p.image?.mimeType) {
        geminiParts.push({ inlineData: { data: p.image.base64, mimeType: p.image.mimeType } });
      }
    }
  } else if (body.prompt && body.image?.base64 && body.image?.mimeType) {
    geminiParts = [
      { inlineData: { data: body.image.base64, mimeType: body.image.mimeType } },
      { text: body.prompt },
    ];
  }
  if (!geminiParts.length) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  // ───── three-tier auth ─────
  const masterKey =
    (req.headers['x-master-key'] as string) || body.masterKey || '';
  const userApiKey =
    (req.headers['x-user-api-key'] as string) || body.userApiKey || '';

  let geminiKey = '';
  let mode: 'master' | 'byok' | 'free' = 'free';

  if (MASTER_PASSWORD && masterKey === MASTER_PASSWORD) {
    if (!SERVER_GEMINI_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: 'server_misconfigured', message: 'GEMINI_API_KEY 未配置' });
    }
    geminiKey = SERVER_GEMINI_KEY;
    mode = 'master';
  } else if (userApiKey.startsWith('AIza') && userApiKey.length > 30) {
    geminiKey = userApiKey;
    mode = 'byok';
  } else {
    if (!SERVER_GEMINI_KEY) {
      return res
        .status(503)
        .json({
          ok: false,
          error: 'server_misconfigured',
          message: '免费体验未开放,请填主密码或自己的 Gemini API Key',
        });
    }
    const fp = getFingerprint(req);
    const { allowed, remaining, reset } = await checkRateLimit(fp, FREE_DAILY_LIMIT);
    if (!allowed) {
      return res.status(429).json({
        ok: false,
        error: 'rate_limit',
        message: `今天免费体验次数用完了(每日 ${FREE_DAILY_LIMIT} 次)。请填写主密码,或填你自己的 Gemini API Key。`,
        remaining,
        reset,
      });
    }
    geminiKey = SERVER_GEMINI_KEY;
    mode = 'free';
  }

  // ───── key sanity guard ─────
  // Fail loudly *before* hitting Google if the resolved key isn't a real API
  // key. Catches the recurring "AQ. ephemeral token in GEMINI_API_KEY" trap
  // that surfaces downstream as an opaque 401.
  if (!looksLikeApiKey(geminiKey)) {
    const isEphemeral = geminiKey.startsWith('AQ.');
    return res.status(mode === 'byok' ? 400 : 500).json({
      ok: false,
      error: 'invalid_key',
      errorType: 'auth',
      mode,
      message: isEphemeral
        ? (mode === 'byok'
            ? '你填的是 AI Studio 临时令牌(AQ. 开头),会很快过期。请到 aistudio.google.com/apikey 创建 AIza 开头的正式 key。'
            : '服务器 GEMINI_API_KEY 是临时令牌(AQ. 开头),已失效。请改为 AIza 开头的正式 key 并重新部署。')
        : (mode === 'byok'
            ? 'API Key 格式不对,Gemini key 应以 AIza 开头。'
            : '服务器 GEMINI_API_KEY 格式不对(应以 AIza 开头)。'),
    });
  }

  // ───── call Gemini (with stable-model fallback) ─────
  const requested = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  // Try the requested model first; if it 404s/deprecates, retry once on the
  // stable model so a Google rename can't take the whole site down.
  const modelChain = requested === STABLE_FALLBACK_MODEL
    ? [requested]
    : [requested, STABLE_FALLBACK_MODEL];

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  let lastErr: any;
  for (const model of modelChain) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: geminiParts },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return res.status(200).json({
            ok: true,
            mode,
            model,
            fallback: model !== requested,
            image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          });
        }
      }
      // 200 from Gemini but no image part — not a model problem, don't retry.
      return res
        .status(502)
        .json({ ok: false, error: 'no_image', errorType: 'unknown', mode, model, message: 'Gemini 未返回图像' });
    } catch (e: any) {
      lastErr = e;
      const { type } = classifyError(e);
      // Only a deprecated/renamed model is worth retrying on the fallback.
      if (type === 'model' && model !== modelChain[modelChain.length - 1]) {
        console.warn(`Model ${model} failed (${type}), falling back…`);
        continue;
      }
      break;
    }
  }

  console.error('Gemini error:', lastErr);
  const { type, http, message } = classifyError(lastErr);
  return res.status(http).json({
    ok: false,
    error: 'generation_failed',
    errorType: type,
    mode,
    message,
  });
}
