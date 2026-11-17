import React from 'react';
import { Plus } from 'lucide-react';
import type { DashboardUser } from '@/types/dashboard';

interface DashboardStatsCardProps {
  user: DashboardUser;
  canCreateSession: boolean;
  quotaGb: string;
  onOpenCreate: () => void;
}

export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  user,
  canCreateSession,
  quotaGb,
  onOpenCreate,
}) => {
  return (
    <>
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vos Sessions</h1>
          <div className="flex items-center gap-6 mt-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Sessions :</span>
              <span className="font-semibold text-white">
                {user.ownedSessionsCount} / {user.sessionLimit}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Stockage :</span>
              <span className="font-semibold text-white">{quotaGb} Go alloués</span>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={onOpenCreate}
            disabled={!canCreateSession}
            className={`px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              canCreateSession
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                : 'bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle session</span>
          </button>
        </div>
      </section>

      {user.sessionLimit === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300">
          Votre compte n'a pas encore de quota de sessions. Contactez un administrateur pour l'activer.
        </div>
      )}
    </>
  );
};

export default DashboardStatsCard;
