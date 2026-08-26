import { UserRepositorie } from "../Repositorie/UserRepositorie";
import { comparePassword } from "../Security/password";
import { signToken } from "../Security/jwt";
import { toPublicUser, PublicUser } from "../Model/User";
import { ApiError } from "../Security/ApiError";

interface LoginResult {
  token: string;
  user: PublicUser;
}

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new ApiError(400, "Email et mot de passe requis.");
    }

    const user = await UserRepositorie.findByEmail(email);

    // RG-11 : message générique si compte introuvable OU mauvais mot de passe
    if (!user) {
      throw new ApiError(401, "Identifiants invalides.");
    }

    const passwordOk = await comparePassword(password, user.password_hash);
    if (!passwordOk) {
      throw new ApiError(401, "Identifiants invalides.");
    }

    // RG-11 : compte désactivé -> 403, distinct du 401
    if (!user.is_active) {
      throw new ApiError(403, "Ce compte a été désactivé.");
    }

    const token = signToken({ id: user.id, role: user.role });

    return {
      token,
      user: toPublicUser(user),
    };
  },
};