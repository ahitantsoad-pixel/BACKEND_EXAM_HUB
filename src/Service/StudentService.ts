import { UserRepositorie } from "../Repositorie/UserRepositorie";
import { hashPassword } from "../Security/password";
import { toPublicUser, PublicUser } from "../Model/User";
import { ApiError } from "../Security/ApiError";

export const StudentService = {
  async getAll(): Promise<PublicUser[]> {
    const users = await UserRepositorie.findAllStudents();
    return users.map(toPublicUser);
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<PublicUser> {
    if (!data.name || !data.email || !data.password) {
      throw new ApiError(400, "Le nom, l'email et le mot de passe sont requis.");
    }

    if (data.password.length < 8) {
      throw new ApiError(
        400,
        "Le mot de passe doit contenir au moins 8 caractères."
      );
    }

    const existing = await UserRepositorie.findByEmail(data.email);
    if (existing) {
      throw new ApiError(400, "Cet email est déjà utilisé.");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await UserRepositorie.create({
      name: data.name,
      email: data.email,
      password_hash: passwordHash,
      role: "student",
    });

    return toPublicUser(user);
  },

  async update(
    id: number,
    data: Partial<{ name: string; email: string }>
  ): Promise<PublicUser> {
    const user = await UserRepositorie.findById(id);
    if (!user || user.role !== "student") {
      throw new ApiError(404, "Étudiant introuvable.");
    }

    if (data.email && data.email !== user.email) {
      const existing = await UserRepositorie.findByEmail(data.email);
      if (existing) {
        throw new ApiError(400, "Cet email est déjà utilisé.");
      }
    }

    const updated = await UserRepositorie.update(id, data);
    return toPublicUser(updated!);
  },

  async resetPassword(id: number, newPassword: string): Promise<PublicUser> {
    const user = await UserRepositorie.findById(id);
    if (!user || user.role !== "student") {
      throw new ApiError(404, "Étudiant introuvable.");
    }

    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(
        400,
        "Le mot de passe doit contenir au moins 8 caractères."
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await UserRepositorie.updatePasswordHash(id, passwordHash);

    const updatedUser = await UserRepositorie.findById(id);
    return toPublicUser(updatedUser!);
  },

  async deactivate(id: number): Promise<PublicUser> {
    const user = await UserRepositorie.findById(id);
    if (!user || user.role !== "student") {
      throw new ApiError(404, "Étudiant introuvable.");
    }

    const updated = await UserRepositorie.setActive(id, false);
    return toPublicUser(updated!);
  },
};