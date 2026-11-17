import React from 'react';
import { Key, Copy, Check } from 'lucide-react';
import type { DashboardUser } from '@/types/dashboard';

interface SftpCredentialsCardProps {
  user: DashboardUser;
  showPassword: boolean;
  copiedKey: string | null;
  passwordSuccessToast: string | null;
  onCopyAll: () => void;
  onCopyText: (text: string, key: string) => void;
  onToggleShowPassword: () => void;
  onOpenPasswordModal: () => void;
  onDismissToast: () => void;
}

export const SftpCredentialsCard: React.FC<SftpCredentialsCardProps> = ({
  user,
  showPassword,
  copiedKey,
  passwordSuccessToast,
  onCopyAll,
  onCopyText,
  onToggleShowPassword,
  onOpenPasswordModal,
  onDismissToast,
}) => {
  const sftp = user.sftp;
  if (!sftp) return null;

  return (
    <section className="bg-zinc-950 border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Identifiants SFTP
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyAll}
            className="text-xs bg-white/5 hover:bg-white/10 text-zinc-300 px-3 py-1.5 rounded-md border border-white/5 flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedKey === 'all' ? (
              <Check className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>Copier tout</span>
          </button>
          <button
            type="button"
            onClick={onOpenPasswordModal}
            className="text-xs bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer"
            title="Modifier ou régénérer le mot de passe SFTP"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Modifier mot de passe</span>
          </button>
        </div>
      </div>

      {passwordSuccessToast && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{passwordSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={onDismissToast}
            className="text-blue-400 hover:text-white text-xs ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">
            Hôte
          </div>
          <div className="text-white mt-1 select-all">{sftp.host}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">
            Port
          </div>
          <div className="text-white mt-1 select-all">{sftp.port}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">
            Utilisateur
          </div>
          <div className="text-white mt-1 select-all">{sftp.username}</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">
              Mot de passe
            </div>
            <div className="text-white mt-1 select-all font-mono truncate">
              {showPassword ? sftp.password : '••••••••'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onCopyText(sftp.password, 'pwd')}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              title="Copier le mot de passe"
            >
              {copiedKey === 'pwd' ? (
                <Check className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="text-[10px] text-zinc-400 hover:text-white font-sans px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              {showPassword ? 'Masquer' : 'Voir'}
            </button>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 font-mono">
        Format FileZilla : <span className="text-zinc-400">sftp://{sftp.username}@{sftp.host}:{sftp.port}</span>
      </div>
    </section>
  );
};

export default SftpCredentialsCard;
