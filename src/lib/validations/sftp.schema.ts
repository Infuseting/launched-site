import { v } from './validator';

export const updatePasswordSchema = v.object({
  password: v.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères').optional(),
});
