import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

/** Hash un mot de passe en clair. Utilisé à la création/reset d'un compte. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare un mot de passe en clair (saisi au login) avec le hash stocké
 * en base. Ne jamais essayer de "déchiffrer" un hash bcrypt -- ce n'est
 * pas du chiffrement réversible, c'est un hash à sens unique.
 */
export async function comparePassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Génère un mot de passe initial lisible pour un étudiant fraîchement créé
 * ou dont le mot de passe est réinitialisé (POST /students, reset-password).
 * Exclut les caractères ambigus (0/O, 1/l/I) pour limiter les erreurs de
 * saisie quand l'admin le transmet à l'étudiant.
 */
export function generateRandomPassword(length = 8): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}