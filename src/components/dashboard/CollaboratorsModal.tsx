import { DashboardModal, DashboardModalTitle } from './DashboardModal';
import Image from 'next/image';
import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { SessionData } from '@/types/dashboard';

interface CollaboratorsModalProps {
  session: SessionData | null;
  collabUsername: string;
  collabError: string | null;
  transferUserId: string;
  onUsernameChange: (name: string) => void;
  onTransferUserIdChange: (userId: string) => void;
  onAddCollaborator: (e: React.FormEvent) => Promise<void>;
  onRemoveCollaborator: (userId: string) => Promise<void>;
  onTransferOwnership: () => Promise<void>;
  onClose: () => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({
  session,
  collabUsername,
  collabError,
  transferUserId,
  onUsernameChange,
  onTransferUserIdChange,
  onAddCollaborator,
  onRemoveCollaborator,
  onTransferOwnership,
  onClose,
}) => {
  if (!session) return null;

  return (
    <DashboardModal
      open={Boolean(session)}
      onClose={onClose}
      className="bg-zinc-950 border border-white/10 rounded-xl max-w-md w-full p-6 space-y-5 text-xs"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <DashboardModalTitle className="text-base font-bold text-white">
          Collaborateurs : {session.name}
        </DashboardModalTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-zinc-500 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={onAddCollaborator} className="space-y-2">
        <label htmlFor="collaborator-name" className="block text-zinc-400 font-medium">
          Inviter un membre (pseudo Discord)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Pseudo Discord..."
            id="collaborator-name"
            value={collabUsername}
            onChange={(e) => onUsernameChange(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg cursor-pointer"
          >
            Ajouter
          </button>
        </div>
        {collabError && (
          <p role="alert" className="text-red-400">
            {collabError}
          </p>
        )}
      </form>

      <div className="space-y-2">
        <p className="block text-zinc-400 font-medium">Membres ({session.members.length})</p>
        <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden bg-white/[0.02]">
          {session.members.map((m) => (
            <div key={m.user.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {m.user.avatar && (
                  <Image
                    src={m.user.avatar}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <div>
                  <div className="font-semibold text-white">{m.user.username}</div>
                  <div className="text-[10px] text-zinc-500">
                    {m.role === 'OWNER' ? 'Propriétaire' : 'Collaborateur (accès SFTP)'}
                  </div>
                </div>
              </div>

              {m.role !== 'OWNER' && (
                <button
                  type="button"
                  onClick={() => void onRemoveCollaborator(m.user.id)}
                  className="text-[11px] text-zinc-500 hover:text-red-400 cursor-pointer"
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Transfer of Ownership */}
      <div className="border-t border-white/10 pt-4 space-y-2">
        <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Transférer la possession</span>
        </div>
        <p className="text-[11px] text-zinc-500">
          La session sera décomptée du quota du destinataire. Vous deviendrez collaborateur.
        </p>
        <div className="flex gap-2">
          <select
            aria-label="Nouveau propriétaire"
            value={transferUserId}
            onChange={(e) => onTransferUserIdChange(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
          >
            <option value="">Choisir un collaborateur...</option>
            {session.members
              .filter((m) => m.role !== 'OWNER')
              .map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.username}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => void onTransferOwnership()}
            disabled={!transferUserId}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Transférer
          </button>
        </div>
      </div>
    </DashboardModal>
  );
};

export default CollaboratorsModal;
