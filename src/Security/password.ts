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