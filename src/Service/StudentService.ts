import { UserRepositorie } from "../Repositorie/UserRepositorie";
import { hashPassword, generateRandomPassword } from "../Security/password";
import { toPublicUser, PublicUser } from "../Model/User";
import { ApiError } from "../Security/ApiError";

interface CreatedStudent extends PublicUser {
  initialPassword: string;
}

export const StudentService = {
  async getAll(): Promise<PublicUser[]> {
    const users = await UserRepositorie.findAllStudents();
    return users.map(toPublicUser);
  },

  async create(data: { name: string; email: string }): Promise<CreatedStudent> {
    if (!data.name || !data.email) {
      throw new ApiError(400, "Le nom et l'email sont requis.");
    }

    const existing = await UserRepositorie.findByEmail(data.email);
    if (existing) {
      throw new ApiError(400, "Cet email est déjà utilisé.");
    }

    const initialPassword = generateRandomPassword();
    const passwordHash = await hashPassword(initialPassword);

    const user = await UserRepositorie.create({
      name: data.name,
      email: data.email,
      password_hash: passwordHash,
      role: "student",
    });

    return {
      ...toPublicUser(user),
      initialPassword,
    };
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

  async resetPassword(id: number): Promise<CreatedStudent> {
    const user = await UserRepositorie.findById(id);
    if (!user || user.role !== "student") {
      throw new ApiError(404, "Étudiant introuvable.");
    }

    const newPassword = generateRandomPassword();
    const passwordHash = await hashPassword(newPassword);
    await UserRepositorie.updatePasswordHash(id, passwordHash);

    const updatedUser = await UserRepositorie.findById(id);

    return {
      ...toPublicUser(updatedUser!),
      initialPassword: newPassword,
    };
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