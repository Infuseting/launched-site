import { DashboardModal, DashboardModalHeader } from './DashboardModal';
import React from 'react';
import { Key, RefreshCw } from 'lucide-react';

interface SftpPasswordModalProps {
  isOpen: boolean;
  newSftpPassword: string;
  passwordLoading: boolean;
  passwordError: string | null;
  onPasswordChange: (value: string) => void;
  onGenerateRandom: () => void;
  onSubmit: (e?: React.FormEvent) => Promise<void>;
  onClose: () => void;
}

export const SftpPasswordModal: React.FC<SftpPasswordModalProps> = ({
  isOpen,
  newSftpPassword,
  passwordLoading,
  passwordError,
  onPasswordChange,
  onGenerateRandom,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <DashboardModal
      open={isOpen}
      onClose={onClose}
      className="bg-zinc-950 border border-white/10 rounded-xl max-w-md w-full p-6 space-y-4 text-xs"
    >
      <DashboardModalHeader
        title="Mot de passe SFTP"
        icon={<Key className="w-4 h-4 text-blue-500" />}
        onClose={onClose}
      />

      <p className="text-zinc-400 leading-relaxed">
        Définissez un mot de passe personnalisé pour vos connexions SFTP (minimum 6 caractères) ou
        générez-en un automatiquement.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="sftp-password" className="block text-zinc-400 font-medium mb-1.5">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <input
              type="text"
              id="sftp-password"
              autoComplete="new-password"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'sftp-password-error' : undefined}
              value={newSftpPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Entrez un mot de passe ou laissez vide pour auto-générer..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500 pr-10"
            />
            {newSftpPassword && (
              <button
                type="button"
                aria-label="Effacer le mot de passe"
                onClick={() => onPasswordChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onGenerateRandom}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition font-sans cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Générer un mot de passe aléatoire</span>
          </button>
        </div>

        {passwordError && (
          <div
            id="sftp-password-error"
            role="alert"
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
          >
            {passwordError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="px-4 py-2 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={passwordLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {passwordLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{newSftpPassword.trim() ? 'Enregistrer' : 'Générer automatiquement'}</span>
          </button>
        </div>
      </form>
    </DashboardModal>
  );
};

export default SftpPasswordModal;
