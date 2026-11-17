import { v } from './validator';

export interface SessionLinkInput {
  name: string;
  url: string;
  icon?: string;
}

export const sessionLinkSchema = v.object({
  name: v.string().min(1, 'Le nom du lien est requis').trim(),
  url: v.string().min(1, "L'URL du lien est requise").trim(),
  icon: v.string().optional(),
});

export const createSessionSchema = v.object({
  name: v.string().min(1, 'Le nom de la session est requis').trim(),
  minecraft: v.string().min(1, 'La version Minecraft est requise').trim(),
  syncDir: v.string().default('mods,resourcepacks,shaderpacks'),
  welcome: v.string().default(''),
  jvmArg: v.string().default('-Xmx4G'),
  credits: v.string().optional(),
  hostname: v.string().optional(),
  crack: v.boolean().default(false),
  links: v.array(sessionLinkSchema).max(3).default([]),
  forge: v.string().optional(),
  fabric: v.string().optional(),
  neoforge: v.string().optional(),
  publicAccess: v.boolean().default(true),
  discordPresence: v.any().optional(),
  access: v.any().optional(),
});

export const updateSessionSchema = v.object({
  name: v.string().min(1).trim().optional(),
  minecraft: v.string().min(1).trim().optional(),
  syncDir: v.string().trim().optional(),
  welcome: v.string().trim().optional(),
  jvmArg: v.string().trim().optional(),
  credits: v.string().trim().optional(),
  hostname: v.string().trim().optional(),
  crack: v.boolean().optional(),
  links: v.array(sessionLinkSchema).max(3).optional(),
  forge: v.string().optional(),
  fabric: v.string().optional(),
  neoforge: v.string().optional(),
  publicAccess: v.boolean().optional(),
  discordPresence: v.any().optional(),
  access: v.any().optional(),
});
