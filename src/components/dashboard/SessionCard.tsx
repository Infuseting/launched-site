import React from 'react';
import { Edit3, Users, Trash2, Play, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionData } from '@/types/dashboard';

interface SessionCardProps {
  session: SessionData;
  onEdit: (session: SessionData) => void;
  onOpenCollaborators: (session: SessionData) => void;
  onDelete: (session: SessionData) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onEdit,
  onOpenCollaborators,
  onDelete,
}) => {
  const isOwner = session.myRole === 'OWNER';
  const loader = session.fabric
    ? `Fabric ${session.fabric}`
    : session.forge
      ? `Forge ${session.forge}`
      : session.neoforge
        ? `NeoForge ${session.neoforge}`
        : 'Vanilla';

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-white/20 transition">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">{session.name}</h3>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  isOwner
                    ? 'bg-white/5 text-zinc-300 border-white/10'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}
              >
                {isOwner ? 'Propriétaire' : 'Collaborateur'}
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-1">SFTP : /{session.slug}/</div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(session)}
              title="Modifier"
              aria-label={`Modifier : ${session.name}`}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenCollaborators(session)}
                  title="Collaborateurs"
                  aria-label={`Collaborateurs : ${session.name}`}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition relative cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  {session.members.length > 1 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] font-bold flex items-center justify-center text-white">
                      {session.members.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(session)}
                  title="Supprimer"
                  aria-label={`Supprimer : ${session.name}`}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
          <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded">
            {session.minecraft} · {loader}
          </span>
          {session.crack && (
            <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Offline / Crack</span>
          )}
          {session.hostname && (
            <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded">{session.hostname}</span>
          )}
        </div>

        {session.welcome && (
          <p className="text-xs text-zinc-400 mt-3 line-clamp-1 italic">
            &quot;{session.welcome}&quot;
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 font-mono">
        <span className="break-all">Sync : {session.syncDir}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span>RAM : {session.jvmArg}</span>
          <Button asChild size="sm" variant="ghost">
            <a
              href={`/launch/${encodeURIComponent(session.slug)}`}
              title="Lien web partageable pour ouvrir cette session dans Launched"
            >
              <LinkIcon data-icon="inline-start" aria-hidden="true" />
              Lien web
            </a>
          </Button>
          <a
            href={`launched://session/${encodeURIComponent(session.slug)}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition text-[11px] font-sans font-medium"
            title="Lancer cette session dans Launched"
          >
            <Play className="w-3 h-3 fill-current" />
            Lancer
          </a>
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
