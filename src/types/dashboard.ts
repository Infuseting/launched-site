import type { SessionPresence } from '@/lib/discord-presence';
import type { DiscordAccessUser } from '@/components/discord-user-select';

export interface LinkItem {
  name: string;
  url: string;
  icon: string;
}

export interface MemberInfo {
  role: 'OWNER' | 'COLLABORATOR';
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export interface SessionData {
  id: string;
  slug: string;
  name: string;
  minecraft: string;
  forge?: string | null;
  fabric?: string | null;
  neoforge?: string | null;
  syncDir: string;
  welcome: string;
  jvmArg: string;
  credits: string;
  hostname?: string | null;
  crack: boolean;
  publicAccess: boolean;
  discordPresence: SessionPresence | null;
  access: { identifier: string; discordId: string | null; user?: { username: string; avatar: string | null } | null }[];
  myRole: 'OWNER' | 'COLLABORATOR';
  links: LinkItem[];
  members: MemberInfo[];
}

export interface DashboardUser {
  id: string;
  username: string;
  avatar: string | null;
  role: string;
  sessionLimit: number;
  ownedSessionsCount: number;
  diskQuotaBytes: number;
  sftp: {
    host: string;
    port: string;
    username: string;
    password: string;
  } | null;
}

export interface DashboardFormData {
  name: string;
  minecraft: string;
  loaderType: string;
  loaderVersion: string;
  syncDir: string;
  welcome: string;
  jvmArg: string;
  credits: string;
  hostname: string;
  crack: boolean;
  publicAccess: boolean;
  discordPresence: ReturnType<typeof import('@/components/session-discord-presence').presenceFormValue>;
  allowedDiscordUsers: DiscordAccessUser[];
  links: LinkItem[];
}
