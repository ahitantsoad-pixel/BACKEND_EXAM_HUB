// scripts/test-exam-controller-http.ts
import "dotenv/config";
import { signToken } from "../src/Security/jwt";

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
const token = signToken({ id: 1, role: "admin" });

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

let courseId: number;
let examId: number;
let questionId: number;

async function main() {
  console.log("=== Test HTTP ExamController + QuestionController ===\n");

  // Setup : un cours de test, en direct via pool (pas d'endpoint /courses dispo)
  const { pool } = await import("../src/config/db");
  const courseRes = await pool.query(
    `INSERT INTO courses (code, name, description) VALUES ($1,$2,$3) RETURNING id`,
    ["TESTCTRL", "Cours test Controller", ""]
  );
  courseId = courseRes.rows[0].id;
  console.log(`Setup : cours id=${courseId} créé`);

  // 1. POST /api/exams -- création
  let res = await request("POST", "/exams", {
    courseId,
    title: "Examen HTTP test",
    description: "Créé par le script de test Controller.",
    startsAt: "2026-01-01T08:00:00Z",
    endsAt: "2026-12-31T10:00:00Z",
  });
  console.log("1. POST /exams ->", res.status, res.body);
  if (res.status !== 201) throw new Error("Échec création examen");
  examId = res.body.id;

  // 2. GET /api/exams -- liste
  res = await request("GET", "/exams");
  console.log("2. GET /exams ->", res.status, `(${res.body.length} examen(s))`);

  // 3. GET /api/exams/:id
  res = await request("GET", `/exams/${examId}`);
  console.log("3. GET /exams/:id ->", res.status, res.body.title);

  // 4. PUT /api/exams/:id -- update partiel
  res = await request("PUT", `/exams/${examId}`, { title: "Titre modifié via HTTP" });
  console.log("4. PUT /exams/:id ->", res.status, res.body.title);

  // 5. POST /api/exams/:id/questions -- création question valide
  res = await request("POST", `/exams/${examId}/questions`, {
    text: "2 + 2 = ?",
    points: 5,
    choices: [
      { text: "3", correct: false },
      { text: "4", correct: true },
    ],
  });
  console.log("5. POST /exams/:id/questions ->", res.status, `(${res.body.choices?.length} choix)`);
  if (res.status !== 201) throw new Error("Échec création question");
  questionId = res.body.id;

  // 6. POST question invalide -- RG-04, doit renvoyer 400
  res = await request("POST", `/exams/${examId}/questions`, {
    text: "Invalide",
    points: 5,
    choices: [{ text: "a", correct: true }], // 1 seul choix
  });
  console.log("6. POST question invalide (1 choix) ->", res.status, res.body.message);
  if (res.status !== 400) throw new Error("RG-04 pas appliquée correctement");

  // 7. GET /api/exams/:id/questions
  res = await request("GET", `/exams/${examId}/questions`);
  console.log("7. GET /exams/:id/questions ->", res.status, `(${res.body.length} question(s))`);

  // 8. PUT /api/questions/:id
  res = await request("PUT", `/questions/${questionId}`, { points: 10 });
  console.log("8. PUT /questions/:id ->", res.status, `points=${res.body.points}`);

  // 9. Sans token -- doit être 401
  const resNoAuth = await fetch(`${BASE_URL}/exams`);
  console.log("9. GET /exams sans token ->", resNoAuth.status);
  if (resNoAuth.status !== 401) throw new Error("requireAuth ne bloque pas correctement");

  // 10. DELETE /api/questions/:id -- nettoyage
  res = await request("DELETE", `/questions/${questionId}`);
  console.log("10. DELETE /questions/:id ->", res.status, res.body);

  // 11. DELETE /api/exams/:id -- nettoyage
  res = await request("DELETE", `/exams/${examId}`);
  console.log("11. DELETE /exams/:id ->", res.status, res.body);

  // Nettoyage du cours de test
  await pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);
  await pool.end();

  console.log("\n Tous les tests HTTP sont passés avec succès.");
}

main().catch((err) => {
  console.error("\n Échec :", err.message ?? err);
  process.exit(1);
});