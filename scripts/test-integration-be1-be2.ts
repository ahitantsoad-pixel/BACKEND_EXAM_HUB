// scripts/test-integration-be1-be2.ts
import "dotenv/config";

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

async function request(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function main() {
  console.log("=== Test intégration BE1 (auth) + BE2 (exams/questions) ===\n");

  // 1. Vrai login, via le vrai AuthController/AuthService de BE1
  const loginRes = await request("POST", "/auth/login", undefined, {
    email: "admin@examhub.io",
    password: "admin123",
  });
  console.log("1. POST /auth/login ->", loginRes.status, loginRes.body?.user);
  if (loginRes.status !== 200) throw new Error("Login échoué");
  const token = loginRes.body.token;

  // 2. Utiliser ce vrai token sur une route BE2 protégée
  const examsRes = await request("GET", "/exams", token);
  console.log("2. GET /exams (avec vrai token admin) ->", examsRes.status);
  if (examsRes.status !== 200) throw new Error("requireRole a rejeté un vrai token admin -- bug d'intégration");

  // 3. Créer un vrai cours via BE1 (CourseController), puis un examen dessus via BE2
  const courseRes = await request("POST", "/courses", token, {
    code: "INTTEST",
    name: "Cours test intégration",
    description: "Créé pour valider BE1+BE2 ensemble",
  });
  console.log("3. POST /courses (BE1) ->", courseRes.status, courseRes.body);
  if (courseRes.status !== 201) throw new Error("Création cours BE1 échouée");

  const examRes = await request("POST", "/exams", token, {
    courseId: courseRes.body.id,
    title: "Examen intégration",
    description: "Test croisé BE1+BE2",
    startsAt: "2026-01-01T08:00:00Z",
    endsAt: "2026-12-31T10:00:00Z",
  });
  console.log("4. POST /exams (BE2, sur cours créé par BE1) ->", examRes.status, examRes.body);
  if (examRes.status !== 201) throw new Error("Création examen BE2 échouée");

  // 5. Test négatif : mauvais mot de passe -> 401 générique (RG-11)
  const badLoginRes = await request("POST", "/auth/login", undefined, {
    email: "admin@examhub.io",
    password: "mauvais-mot-de-passe",
  });
  console.log("5. POST /auth/login (mauvais mdp) ->", badLoginRes.status, badLoginRes.body?.message);
  if (badLoginRes.status !== 401) throw new Error("RG-11 (401 générique) non respectée");

  // Nettoyage
  await request("DELETE", `/exams/${examRes.body.id}`, token);
  await request("DELETE", `/courses/${courseRes.body.id}`, token);
  console.log("\n✅ Intégration BE1 + BE2 validée (login réel, token réel, cours réel, examen réel).");
}

main().catch((err) => {
  console.error("\n❌ Échec :", err.message ?? err);
  process.exit(1);
});