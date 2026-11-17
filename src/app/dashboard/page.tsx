'use client';

import React from 'react';
import { RefreshCw, AlertCircle, Server } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardStatsCard } from '@/components/dashboard/DashboardStatsCard';
import { SftpCredentialsCard } from '@/components/dashboard/SftpCredentialsCard';
import { SessionCard } from '@/components/dashboard/SessionCard';
import { CreateOrEditSessionModal } from '@/components/dashboard/CreateOrEditSessionModal';
import { CollaboratorsModal } from '@/components/dashboard/CollaboratorsModal';
import { SftpPasswordModal } from '@/components/dashboard/SftpPasswordModal';

export default function DashboardPage() {
  const {
    data,
    loading,
    error,
    authError,
    showPassword,
    setShowPassword,
    copiedKey,
    copyToClipboard,
    handleCopyAllSftp,
    passwordModalOpen,
    setPasswordModalOpen,
    newSftpPassword,
    setNewSftpPassword,
    passwordLoading,
    passwordError,
    passwordSuccessToast,
    generateRandomPassword,
    handleUpdatePassword,
    createModalOpen,
    setCreateModalOpen,
    editSession,
    setEditSession,
    collaboratorSession,
    setCollaboratorSession,
    formData,
    setFormData,
    collabUsername,
    setCollabUsername,
    collabError,
    transferUserId,
    setTransferUserId,
    handleSaveSession,
    handleDeleteSession,
    handleAddCollaborator,
    handleRemoveCollaborator,
    handleTransferOwnership,
    openEdit,
    openCreate,
  } = useDashboardData();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>Chargement de votre espace...</span>
        </div>
      </div>
    );
  }

  if (authError === 'not_in_guild') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center mb-5 text-[#5865F2]">
          <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Rejoignez notre Discord</h1>
        <p className="text-zinc-400 text-sm mb-6 max-w-md">
          L'accès à l'espace créateur est réservé aux membres du serveur Discord officiel de Launched. Rejoignez le serveur pour pouvoir créer et gérer vos sessions.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <a
            href="https://discord.gg/kfzyScBSqS"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold rounded-lg transition"
          >
            Rejoindre le serveur Discord
          </a>
          <a
            href="/api/auth/discord/login"
            className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-sm font-semibold rounded-lg transition"
          >
            J'ai rejoint, se connecter
          </a>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-zinc-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Authentification requise</h1>
        <p className="text-zinc-500 text-sm mb-6 max-w-sm">Connectez-vous avec votre compte Discord pour accéder à votre espace créateur.</p>
        <a
          href="/api/auth/discord/login"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
        >
          Se connecter avec Discord
        </a>
      </div>
    );
  }

  const { user, sessions } = data;
  const canCreateSession = user.ownedSessionsCount < user.sessionLimit;
  const quotaGb = (user.diskQuotaBytes / (1024 ** 3)).toFixed(0);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <DashboardHeader user={user} />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <DashboardStatsCard
          user={user}
          canCreateSession={canCreateSession}
          quotaGb={quotaGb}
          onOpenCreate={openCreate}
        />

        <SftpCredentialsCard
          user={user}
          showPassword={showPassword}
          copiedKey={copiedKey}
          passwordSuccessToast={passwordSuccessToast}
          onCopyAll={handleCopyAllSftp}
          onCopyText={copyToClipboard}
          onToggleShowPassword={() => setShowPassword(!showPassword)}
          onOpenPasswordModal={() => {
            setNewSftpPassword('');
            setPasswordModalOpen(true);
          }}
          onDismissToast={() => {}}
        />

        <section className="space-y-4">
          {sessions.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-12 text-center">
              <Server className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-300">Aucune session configurée</p>
              <p className="text-xs text-zinc-500 mt-1">Créez votre première session pour commencer à synchroniser vos fichiers.</p>
              {canCreateSession && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Créer une session
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onEdit={openEdit}
                  onOpenCollaborators={setCollaboratorSession}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateOrEditSessionModal
        isOpen={createModalOpen || Boolean(editSession)}
        editSession={editSession}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSaveSession}
        onClose={() => {
          setCreateModalOpen(false);
          setEditSession(null);
        }}
        searchUsers={async (query, signal) => {
          const res = await fetch(`/api/dashboard/users?q=${encodeURIComponent(query)}`, {
            signal,
            credentials: 'include',
            headers: typeof window !== 'undefined' && localStorage.getItem('launched_token')
              ? { Authorization: `Bearer ${localStorage.getItem('launched_token')}` }
              : {},
          });
          if (!res.ok) throw new Error('Recherche indisponible');
          return res.json();
        }}
      />

      <CollaboratorsModal
        session={collaboratorSession}
        collabUsername={collabUsername}
        collabError={collabError}
        transferUserId={transferUserId}
        onUsernameChange={setCollabUsername}
        onTransferUserIdChange={setTransferUserId}
        onAddCollaborator={handleAddCollaborator}
        onRemoveCollaborator={handleRemoveCollaborator}
        onTransferOwnership={handleTransferOwnership}
        onClose={() => setCollaboratorSession(null)}
      />

      <SftpPasswordModal
        isOpen={passwordModalOpen}
        newSftpPassword={newSftpPassword}
        passwordLoading={passwordLoading}
        passwordError={passwordError}
        onPasswordChange={setNewSftpPassword}
        onGenerateRandom={generateRandomPassword}
        onSubmit={handleUpdatePassword}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}
