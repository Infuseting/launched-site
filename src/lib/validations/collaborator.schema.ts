import { v } from './validator';

export const addCollaboratorSchema = v.object({
  username: v.string().min(1, 'Le nom d\'utilisateur Discord est requis').trim(),
});

export const transferSessionSchema = v.object({
  username: v.string().min(1, 'Le pseudo Discord du nouveau propriétaire est requis').trim(),
});
