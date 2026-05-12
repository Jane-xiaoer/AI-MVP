import React, { useState } from 'react';
import { Key, X, Trash2 } from 'lucide-react';
import { saveSettings, type AccessMode } from '../lib/settings';

interface Props {
  open: boolean;
  initialMasterKey: string;
  initialUserApiKey: string;
  onClose: () => void;
  onSaved: (mode: AccessMode) => void;
}

export const SettingsModal: React.FC<Props> = ({
  open,
  initialMasterKey,
  initialUserApiKey,
  onClose,
  onSaved,
}) => {
  const [mk, setMk] = useState(initialMasterKey);
  const [uk, setUk] = useState(initialUserApiKey);

  if (!open) return null;

  const handleSave = () => {
    saveSettings(mk.trim(), uk.trim());
    const mode: AccessMode = mk.trim()
      ? 'master'
      : uk.trim().startsWith('AIza')
      ? 'byok'
      : 'free';
    onSaved(mode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#f4f4f0] shadow-2xl border border-white/60 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-serif font-black text-ink tracking-tight">访问设置</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="text-neutral-500 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-neutral-500 mb-5">
          每个 IP 每天可免费试用 3 次。要无限使用,以下二选一:
        </p>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-ink mb-1.5">
            🔑 主密码
            <span className="ml-2 text-[11px] font-normal text-neutral-500">
              (管理员 / 作者朋友)
            </span>
          </label>
          <input
            type="password"
            value={mk}
            onChange={(e) => setMk(e.target.value)}
            placeholder="输入主密码…"
            className="w-full rounded-lg bg-white border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-ink mb-1.5">
            🪙 你的 Gemini API Key
            <span className="ml-2 text-[11px] font-normal text-neutral-500">
              (用你自己的额度,免费版每天 1500 次)
            </span>
          </label>
          <input
            type="password"
            value={uk}
            onChange={(e) => setUk(e.target.value)}
            placeholder="AIza..."
            className="w-full rounded-lg bg-white border border-neutral-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
          />
          <p className="mt-1.5 text-[11px] text-neutral-500">
            到{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-amber-600 hover:text-amber-700"
            >
              aistudio.google.com/apikey
            </a>{' '}
            一分钟拿到 (Google 账号即可,免费)
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
          <button
            onClick={() => { setMk(''); setUk(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-ink transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            清空
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-neutral-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-ink text-white hover:opacity-90 transition-opacity"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
