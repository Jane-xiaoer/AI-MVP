import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export type Exhibit = 'frame' | 'upscale';

interface HallProps {
  onPick: (e: Exhibit) => void;
}

// 主角:两个 AI 小工具。一暖一冷撞色,图在上、带色标题条在下。
const TOOLS: Array<{
  key: Exhibit; img: string; titleKey: string; taglineKey: string;
  footer: string; title: string; link: string;
}> = [
  { key: 'frame', img: '/tools/hangart.jpg', titleKey: 'hall_frame_title', taglineKey: 'tool_frame_tagline',
    footer: 'bg-[#fbece1]/70', title: 'text-[#9c4a2c]', link: 'text-[#c85d34]' },
  { key: 'upscale', img: '/tools/upscale.jpg', titleKey: 'hall_upscale_title', taglineKey: 'tool_upscale_tagline',
    footer: 'bg-[#dbece8]/80', title: 'text-[#1f5c56]', link: 'text-[#2c847b]' },
];

// 次级:两间 3D 房间,去逛着玩儿
const ROOMS = [
  { tag: 'v1', img: '/rooms/abigail.png', href: 'https://xiaoer-3d-portfolio-abigail.vercel.app', nameKey: 'room_v1_name' },
  { tag: 'v2', img: '/rooms/sooah.webp', href: 'https://xiaoer-3d-portfolio-sooah.vercel.app', nameKey: 'room_v2_name' },
] as const;

export const Hall: React.FC<HallProps> = ({ onPick }) => {
  const t = useTranslation();

  return (
    <div className="w-full max-w-4xl flex flex-col items-center text-center">
      {/* ── Hero ── */}
      <p className="font-accent italic text-lg sm:text-xl text-slate-400 tracking-[0.22em]">
        Xiaoer&rsquo;s Home Pavilion
      </p>
      <h1 className="mt-2 font-serif text-5xl sm:text-6xl font-extrabold text-slate-800 tracking-tight">
        {t('hall_title')}
      </h1>
      <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-xl leading-relaxed">
        {t('hall_subtitle')}
      </p>

      {/* ── 主角:两个 AI 工具 ── */}
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-7 w-full">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            onClick={() => onPick(tool.key)}
            className="group rounded-[26px] overflow-hidden bg-white/55 border border-white/60 shadow-[0_14px_40px_-18px_rgba(80,70,90,0.45)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_26px_58px_-22px_rgba(80,70,90,0.55)]"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={tool.img}
                alt={t(tool.titleKey)}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
              />
            </div>
            <div className={`p-6 text-left ${tool.footer}`}>
              <h2 className={`font-serif text-2xl font-bold ${tool.title}`}>{t(tool.titleKey)}</h2>
              <p className="mt-1.5 text-sm text-slate-500 leading-snug">{t(tool.taglineKey)}</p>
              <span className={`mt-3.5 inline-flex items-center gap-1.5 text-sm font-medium ${tool.link} group-hover:gap-2.5 transition-all`}>
                {t('hall_enter')} <ArrowRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ── 次级:去逛小耳的房间 ── */}
      <div className="mt-16 w-full flex flex-col items-center">
        <p className="text-xs tracking-[0.28em] text-slate-400 uppercase">{t('rooms_label')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-4">
          {ROOMS.map((r) => (
            <a
              key={r.tag}
              href={r.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3.5 pr-5 rounded-2xl bg-white/45 hover:bg-white/80 border border-white/60 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
            >
              <img src={r.img} alt={t(r.nameKey)} loading="lazy" className="w-16 h-16 object-cover" />
              <span className="font-serif font-semibold text-slate-700">{t(r.nameKey)}</span>
              <span className="font-accent italic text-xs text-slate-400">{r.tag}</span>
              <ArrowUpRight size={15} className="text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
