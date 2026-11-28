import { v, type Schema, ValidationError } from './validator';

export interface SessionLinkInput {
  name: string;
  url: string;
  icon?: string;
}

const UNSAFE_JVM_FLAGS = [
  '-javaagent',
  '-agentlib',
  '-agentpath',
  '-xbootclasspath',
  '-xrun',
  '--patch-module',
  '-xx:onoutofmemoryerror',
  '-xx:onerror',
  '-xx:heapdumppath',
  '-xx:errorfile',
];

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function refinedString(
  base: Schema<string>,
  check: (value: string) => string | null,
): Schema<string> {
  return {
    safeParse(input: unknown) {
      const res = base.safeParse(input);
      if (!res.success) return res;
      const err = check(res.data);
      return err ? { success: false, error: err } : res;
    },
    parse(input: unknown) {
      const res = this.safeParse(input);
      if (!res.success) throw new ValidationError(res.error);
      return res.data;
    },
  };
}

function optionalRefinedString(
  base: Schema<string | undefined>,
  check: (value: string) => string | null,
): Schema<string | undefined> {
  return {
    safeParse(input: unknown) {
      const res = base.safeParse(input);
      if (!res.success || res.data === undefined) return res;
      const err = check(res.data);
      return err ? { success: false, error: err } : res;
    },
    parse(input: unknown) {
      const res = this.safeParse(input);
      if (!res.success) throw new ValidationError(res.error);
      return res.data;
    },
  };
}

function validateJvmArgString(value: string): string | null {
  for (const token of value.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();
    if (UNSAFE_JVM_FLAGS.some((flag) => lower.startsWith(flag))) {
      return `Argument JVM non autorisé : ${token}`;
    }
  }
  return null;
}

export const sessionLinkSchema = v.object({
  name: v.string().min(1, 'Le nom du lien est requis').trim(),
  url: refinedString(v.string().min(1, "L'URL du lien est requise").trim(), (url) =>
    isSafeHttpUrl(url) ? null : "L'URL du lien doit commencer par http:// ou https://",
  ),
  icon: optionalRefinedString(v.string().trim().optional(), (icon) =>
    !icon || icon.startsWith('/') || isSafeHttpUrl(icon)
      ? null
      : "L'icône du lien doit être une URL http(s) ou un chemin relatif",
  ),
});

export const createSessionSchema = v.object({
  name: v.string().min(1, 'Le nom de la session est requis').trim(),
  minecraft: v.string().min(1, 'La version Minecraft est requise').trim(),
  syncDir: v.string().default('mods,resourcepacks,shaderpacks'),
  welcome: v.string().default(''),
  jvmArg: refinedString(v.string().default('-Xmx4G'), validateJvmArgString),
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
  jvmArg: optionalRefinedString(v.string().trim().optional(), validateJvmArgString),
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
