import React, { useCallback, useRef, useState } from 'react';
import { Sparkles, Download, ImageUp, Wand2, RotateCcw, ChevronsLeftRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

type Stage = 'input' | 'loading' | 'result';
type TierKey = '2k' | '4k' | '8k';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 三档。factor = 最大放大倍数,ceil = 输出长边上限,maxInput = 上传前输入缩到的长边。
//   2K/4K → real-esrgan(整数 ×2/×4,保真便宜)
//   8K    → clarity(动态倍数直冲 ~7680,创意增强大图)—— 不再和 4K 撞
const TIERS: Array<{ key: TierKey; label: string; factor: number; ceil: number; maxInput: number; clarity: boolean }> = [
  { key: '2k', label: '2K', factor: 2, ceil: 2048, maxInput: 1024, clarity: false },
  { key: '4k', label: '4K', factor: 4, ceil: 4096, maxInput: 1024, clarity: false },
  { key: '8k', label: '8K', factor: 8, ceil: 7680, maxInput: 2048, clarity: true },
];
const tierOf = (k: TierKey) => TIERS.find((t) => t.key === k)!;

// 给定原图尺寸 + 档位,算真实输出尺寸。
function outputFor(w: number, h: number, factor: number, ceil: number) {
  const longIn = Math.max(w, h) || 1;
  const longOut = Math.min(longIn * factor, ceil);
  const f = longOut / longIn;
  return { w: Math.round(w * f), h: Math.round(h * f), capped: longIn * factor > ceil };
}

// 上传前把超大图缩到 maxInput 长边(控 OOM / 成本 / 上传体积)。
// 返回缩放后的 dataURL + 长边(用于算 8K 的动态倍数)。小图原样送。
function prepareImage(dataUrl: string, maxInput: number): Promise<{ url: string; longIn: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const long = Math.max(img.width, img.height);
      if (long <= maxInput) { resolve({ url: dataUrl, longIn: long }); return; }
      const r = maxInput / long;
      const w = Math.max(1, Math.round(img.width * r));
      const h = Math.max(1, Math.round(img.height * r));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve({ url: dataUrl, longIn: long }); return; }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ url: canvas.toDataURL('image/png'), longIn: maxInput });
    };
    img.onerror = () => resolve({ url: dataUrl, longIn: maxInput });
    img.src = dataUrl;
  });
}

export const UpscaleStudio: React.FC = () => {
  const t = useTranslation();
  const [stage, setStage] = useState<Stage>('input');
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [tier, setTier] = useState<TierKey>('4k');
  const [faceEnhance, setFaceEnhance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [compare, setCompare] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const [sliding, setSliding] = useState(false);
  const moveCompare = (clientX: number) => {
    const el = compareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCompare(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  const loadFile = useCallback((file: File | null) => {
    setError(null);
    if (!file || !file.type.startsWith('image/')) {
      setError(t('upscale_err_not_image'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      const im = new Image();
      im.onload = () => setDims({ w: im.naturalWidth, h: im.naturalHeight });
      im.src = url;
      setSrc(url);
      setResult(null);
      setStage('input');
    };
    reader.readAsDataURL(file);
  }, [t]);

  const run = useCallback(async () => {
    if (!src) return;
    const cfg = tierOf(tier);
    setStage('loading');
    setError(null);
    try {
      const { url: prepared, longIn } = await prepareImage(src, cfg.maxInput);
      const payload: Record<string, unknown> = { image: prepared, tier, faceEnhance };
      if (cfg.clarity) {
        // 8K:按这张图算动态倍数,直冲 ceil(~7680),不再和 4K 撞
        const targetOut = Math.min(longIn * cfg.factor, cfg.ceil);
        payload.scaleFactor = Math.min(8, Math.max(2, targetOut / longIn));
      }
      // 1) 创建任务(很快返回任务号,不死等)
      const resp = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok || !data.id) {
        setError(data?.message || t('upscale_err_generic'));
        setStage('input');
        return;
      }
      if (typeof data.remaining === 'number') setRemaining(data.remaining);

      // 2) 每 3s 轮询一次结果,最多约 5 分钟;单次网络抖动忽略、继续查(绝不卡死)
      const id = data.id as string;
      const deadline = Date.now() + 300_000;
      while (Date.now() < deadline) {
        await sleep(3000);
        let s: any = null;
        try {
          s = await fetch(`/api/upscale?id=${encodeURIComponent(id)}`).then((r) => r.json());
        } catch {
          continue; // 网络抖一下,下一轮再查
        }
        if (s?.done) {
          if (s.ok && s.image) {
            setResult(s.image);
            setCompare(50);
            setStage('result');
          } else {
            setError(s?.message || t('upscale_err_generic'));
            setStage('input');
          }
          return;
        }
      }
      // 超时兜底:绝不无限卡,友好收场
      setError(t('upscale_err_slow'));
      setStage('input');
    } catch (e: any) {
      setError(e?.message || t('upscale_err_generic'));
      setStage('input');
    }
  }, [src, tier, faceEnhance, t]);

  const reset = () => {
    setStage('input');
    setSrc(null);
    setDims(null);
    setResult(null);
    setError(null);
  };

  const cfg = tierOf(tier);
  const sel = dims ? outputFor(dims.w, dims.h, cfg.factor, cfg.ceil) : null;

  const download = async () => {
    if (!result) return;
    try {
      const r = await fetch(result);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xiaoer-upscale-${tier}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(result, '_blank'); // 跨域下载失败就新窗口打开
    }
  };

  // ───────── 结果:原图 / 超分 拖动对比 ─────────
  if (stage === 'result' && result && src) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center">
        <h2 className="font-serif text-3xl font-bold text-slate-900">{t('upscale_result_title')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('upscale_compare_hint')}</p>

        <div
          ref={compareRef}
          className={`relative mt-6 w-full rounded-2xl overflow-hidden border border-white/60 shadow-xl bg-white/40 select-none touch-none ${sliding ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={(e) => { setSliding(true); moveCompare(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (sliding) moveCompare(e.clientX); }}
          onPointerUp={() => setSliding(false)}
          onPointerCancel={() => setSliding(false)}
        >
          <img src={result} alt="upscaled" className="block w-full h-auto pointer-events-none" draggable={false} />
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}>
            <img src={src} alt="original" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          </div>
          {/* 分隔线 + 中间可抓手柄(整图任意位置按住即可拖) */}
          <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${compare}%` }}>
            <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.35)]" />
            <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-slate-700">
              <ChevronsLeftRight size={18} />
            </div>
          </div>
          <span className="absolute top-3 left-3 text-[11px] font-semibold tracking-wide px-2 py-1 rounded-full bg-slate-900/55 text-white pointer-events-none">
            {t('upscale_before')}
          </span>
          <span className="absolute top-3 right-3 text-[11px] font-semibold tracking-wide px-2 py-1 rounded-full bg-emerald-500/80 text-white pointer-events-none">
            {t('upscale_after')} · {cfg.label}
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={download}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-8 rounded-full transition shadow-lg hover:scale-105"
          >
            <Download size={18} /> {t('upscale_download')}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-white/60 hover:bg-white/90 text-slate-700 font-medium py-3 px-6 rounded-full transition shadow-sm"
          >
            <RotateCcw size={18} /> {t('upscale_again')}
          </button>
        </div>
        {remaining !== null && (
          <p className="mt-4 text-xs text-slate-400">{t('upscale_remaining', { n: remaining })}</p>
        )}
      </div>
    );
  }

  // ───────── 输入 / 加载 ─────────
  const loading = stage === 'loading';
  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div
        className={`relative w-full aspect-[4/3] border rounded-2xl flex flex-col items-center justify-center transition-all duration-300 bg-white/50 overflow-hidden ${
          isDragging ? 'border-emerald-400 bg-white/70' : 'border-white/60 hover:border-white/90'
        } ${!src && !loading ? 'cursor-pointer' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); loadFile(e.dataTransfer.files?.[0] || null); }}
        onClick={() => { if (!src && !loading) fileRef.current?.click(); }}
      >
        <input
          ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => loadFile(e.target.files?.[0] || null)}
        />
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-emerald-500" />
            <p className="mt-4 text-slate-600 font-medium">{t('upscale_running')}</p>
            <p className="mt-1 text-xs text-slate-400">{tier === '8k' ? t('upscale_running_sub_8k') : t('upscale_running_sub')}</p>
          </div>
        )}
        {src ? (
          <img src={src} alt="input" className={`object-contain w-full h-full ${loading ? 'opacity-30' : ''}`} draggable={false} />
        ) : (
          <div className="text-center text-slate-600 p-6">
            <ImageUp className="mx-auto text-slate-400" size={40} />
            <p className="mt-3 font-medium">{t('upscale_upload_prompt')}</p>
            <p className="text-sm text-slate-400">{t('upscale_upload_formats')}</p>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-rose-600 text-center max-w-md">{error}</p>}

      {src && !loading && (
        <>
          {/* 清晰度档位(2K / 4K / 8K,括号 = 这张图的真实输出尺寸)+ 人脸增强 */}
          <div className="mt-6 flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-3">
              {TIERS.map((ti) => {
                const o = dims ? outputFor(dims.w, dims.h, ti.factor, ti.ceil) : null;
                const active = tier === ti.key;
                return (
                  <button
                    key={ti.key}
                    onClick={() => setTier(ti.key)}
                    className={`flex flex-col items-center px-6 py-2.5 rounded-2xl transition ${
                      active ? 'bg-emerald-500 text-white shadow' : 'bg-white/60 text-slate-600 hover:bg-white/90'
                    }`}
                  >
                    <span className="text-sm font-semibold">{ti.label}{t('upscale_word')}</span>
                    <span className={`text-[11px] mt-0.5 ${active ? 'text-white/85' : 'text-slate-400'}`}>
                      {o ? `${o.w}×${o.h}` : `≤ ${ti.ceil}px`}
                    </span>
                  </button>
                );
              })}
            </div>

            {tier !== '8k' && (
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={faceEnhance} onChange={(e) => setFaceEnhance(e.target.checked)} className="accent-emerald-500 w-4 h-4" />
                <Wand2 size={15} className="text-slate-400" /> {t('upscale_face_label')}
              </label>
            )}
            {tier === '8k' && (
              <p className="text-xs text-amber-600 text-center max-w-sm">{t('upscale_8k_note')}</p>
            )}
          </div>

          {dims && (
            <p className="mt-3 text-xs text-slate-400">
              {t('upscale_source', { iw: dims.w, ih: dims.h })}
              {sel?.capped && <span className="text-amber-600"> · {t('upscale_capped')}</span>}
            </p>
          )}

          <button
            onClick={run}
            className="mt-8 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium tracking-wide py-3 px-12 rounded-full transition shadow-lg hover:scale-105"
          >
            <Sparkles size={18} /> {t('upscale_run')}
          </button>
          <button onClick={reset} className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition">
            {t('upscale_change_image')}
          </button>
        </>
      )}

      {!src && !loading && (
        <p className="mt-5 text-xs text-slate-400">{t('upscale_free_note', { n: 6 })}</p>
      )}
    </div>
  );
};
