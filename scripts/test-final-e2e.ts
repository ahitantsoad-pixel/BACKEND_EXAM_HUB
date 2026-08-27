// scripts/test-final-e2e.ts
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/config/db";

const app = createApp();

// --- État partagé entre les étapes du scénario ---
let adminToken: string;
let studentToken: string;
let courseId: number;
let examId: number; // examen utilisé pour le cycle complet (passera par une tentative)
let questionId: number;
let choiceCorrectId: number;
let choiceWrongId: number;
let studentId: number;
let attemptId: number;

let failed = false;

function check(label: string, condition: boolean, extra?: unknown) {
  if (condition) {
    console.log(` ${label}`);
  } else {
    console.error(` ${label}`, extra ?? "");
    failed = true;
  }
}

async function cleanup() {
  // Ordre inverse des FK : answers -> attempts -> questions(+choices cascade) -> exams -> courses -> users
  await pool.query(`DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id = ANY($1))`, [
    [examId].filter(Boolean),
  ]);
  await pool.query(`DELETE FROM attempts WHERE exam_id = ANY($1)`, [[examId].filter(Boolean)]);
  if (examId) await pool.query(`DELETE FROM questions WHERE exam_id = $1`, [examId]); // choices en CASCADE
  if (examId) await pool.query(`DELETE FROM exams WHERE id = $1`, [examId]);
  if (courseId) await pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);
  if (studentId) await pool.query(`DELETE FROM users WHERE id = $1`, [studentId]);
}

async function main() {
  try {
    // =========================================================
    // ÉTAPE 1 — Login admin (RG-11)
    // =========================================================
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@examhub.io", password: "admin123" });
    check("1a. Login admin renvoie 200", adminLogin.status === 200, adminLogin.body);
    check("1b. Login admin renvoie un token", typeof adminLogin.body.token === "string");
    adminToken = adminLogin.body.token;

    const badLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@examhub.io", password: "mauvais-mdp" });
    check("1c. Mauvais mot de passe -> 401", badLogin.status === 401, badLogin.body);
    check("1d. Format erreur RG-13 respecté", typeof badLogin.body.message === "string", badLogin.body);

    // =========================================================
    // ÉTAPE 2 — Création d'un cours (admin)
    // =========================================================
    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "TESTE2E", name: "Cours Test E2E", description: "Créé par le test final" });
    check("2a. Création cours -> 201", courseRes.status === 201, courseRes.body);
    courseId = courseRes.body.id;

    const courseNoAuth = await request(app).post("/api/courses").send({ code: "X", name: "X" });
    check("2b. Création cours sans token -> 401", courseNoAuth.status === 401, courseNoAuth.body);

    // =========================================================
    // ÉTAPE 3 — Création d'un étudiant (admin)
    // =========================================================
    const studentRes = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Étudiant E2E", email: "etudiant.e2e@examhub.io", password: "password123" });
    check("3a. Création étudiant -> 201", studentRes.status === 201, studentRes.body);
    studentId = studentRes.body.id;

    // =========================================================
    // ÉTAPE 4 — Login étudiant
    // =========================================================
    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "etudiant.e2e@examhub.io", password: "password123" });
    check("4a. Login étudiant -> 200", studentLogin.status === 200, studentLogin.body);
    studentToken = studentLogin.body.token;

    // Étudiant qui tente une route admin -> 403 (authentifié mais mauvais rôle)
    const studentOnAdminRoute = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${studentToken}`);
    check("4b. Étudiant sur route admin -> 403", studentOnAdminRoute.status === 403, studentOnAdminRoute.body);

    // =========================================================
    // ÉTAPE 5 — Création d'un examen (fenêtre ouverte maintenant, RG-03)
    // =========================================================
    const now = new Date();
    const startsAt = new Date(now.getTime() - 60 * 1000); // -1 min
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000); // +1h

    const examRes = await request(app)
      .post("/api/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        title: "Examen E2E",
        description: "Cycle complet",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    check("5a. Création examen -> 201", examRes.status === 201, examRes.body);
    examId = examRes.body.id;

    const examBadDates = await request(app)
      .post("/api/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        title: "Examen dates invalides",
        description: "x",
        startsAt: endsAt.toISOString(),
        endsAt: startsAt.toISOString(),
      });
    check("5b. endsAt <= startsAt -> 400", examBadDates.status === 400, examBadDates.body);

    // =========================================================
    // ÉTAPE 6 — Création de questions (RG-04)
    // =========================================================
    const qRes = await request(app)
      .post(`/api/exams/${examId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "2 + 2 = ?",
        points: 10,
        choices: [
          { text: "3", correct: false },
          { text: "4", correct: true },
        ],
      });
    check("6a. Création question valide -> 201", qRes.status === 201, qRes.body);
    questionId = qRes.body.id;
    choiceCorrectId = qRes.body.choices.find((c: { correct: boolean }) => c.correct).id;
    choiceWrongId = qRes.body.choices.find((c: { correct: boolean }) => !c.correct).id;

    const qBadChoices = await request(app)
      .post(`/api/exams/${examId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ text: "1 seul choix", points: 5, choices: [{ text: "a", correct: true }] });
    check("6b. 1 seul choix -> 400 (RG-04)", qBadChoices.status === 400, qBadChoices.body);

    const qTwoCorrect = await request(app)
      .post(`/api/exams/${examId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "2 corrects",
        points: 5,
        choices: [
          { text: "a", correct: true },
          { text: "b", correct: true },
        ],
      });
    check("6c. 2 choix corrects -> 400 (RG-04)", qTwoCorrect.status === 400, qTwoCorrect.body);

    // =========================================================
    // ÉTAPE 7 — RG-07 : l'étudiant ne voit jamais "correct"
    // =========================================================
    const examForStudent = await request(app)
      .get(`/api/my/exams/${examId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    check("7a. GET /my/exams/:id -> 200", examForStudent.status === 200, examForStudent.body);
    const anyChoiceHasCorrectField = examForStudent.body.questions.some((q: { choices: object[] }) =>
      q.choices.some((c) => Object.prototype.hasOwnProperty.call(c, "correct"))
    );
    check("7b. RG-07 : aucun choix n'expose 'correct'", !anyChoiceHasCorrectField, examForStudent.body);

    // =========================================================
    // ÉTAPE 8 — Liste des examens disponibles (RG-03 fenêtre ouverte)
    // =========================================================
    const availableRes = await request(app)
      .get("/api/my/exams")
      .set("Authorization", `Bearer ${studentToken}`);
    check("8a. GET /my/exams -> 200", availableRes.status === 200, availableRes.body);
    const examIsListed = availableRes.body.some((e: { id: number }) => e.id === examId);
    check("8b. Examen dans la fenêtre est bien listé", examIsListed, availableRes.body);

    // =========================================================
    // ÉTAPE 9 — Soumission (RG-02, RG-05, RG-06, RG-12)
    // =========================================================
    const submitRes = await request(app)
      .post(`/api/my/exams/${examId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId, choiceId: choiceCorrectId }] });
    check("9a. Soumission -> 201", submitRes.status === 201, submitRes.body);
    check("9b. RG-06 : score correct calculé serveur (10 pts)", submitRes.body.score === 10, submitRes.body);
    attemptId = submitRes.body.attemptId;

    // RG-02 : deuxième soumission refusée
    const secondSubmit = await request(app)
      .post(`/api/my/exams/${examId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId, choiceId: choiceCorrectId }] });
    check("9c. RG-02 : double soumission -> 409", secondSubmit.status === 409, secondSubmit.body);

    // Examen disparaît de la liste dispo une fois passé
    const availableAfter = await request(app)
      .get("/api/my/exams")
      .set("Authorization", `Bearer ${studentToken}`);
    const stillListed = availableAfter.body.some((e: { id: number }) => e.id === examId);
    check("9d. Examen passé disparaît de /my/exams", !stillListed, availableAfter.body);

    // =========================================================
    // ÉTAPE 10 — Correction immédiate (RG-12)
    // =========================================================
    check("10a. RG-12 : correction incluse dans la réponse de soumission", Array.isArray(submitRes.body.answers), submitRes.body);
    const correctionRow = submitRes.body.answers.find((a: { questionId: number }) => a.questionId === questionId);
    check("10b. Correction montre le bon choix", correctionRow?.correctChoiceId === choiceCorrectId, correctionRow);
    check("10c. Correction indique isCorrect true", correctionRow?.isCorrect === true, correctionRow);

    const myResultDetail = await request(app)
      .get(`/api/my/results/${attemptId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    check("10d. GET /my/results/:attemptId -> 200", myResultDetail.status === 200, myResultDetail.body);

    // Un autre étudiant ne peut pas voir cette tentative (403, pas 404)
    // -> nécessite un 2e compte, testé seulement si le temps le permet ; ignoré ici pour rester focalisé RG-08

    // =========================================================
    // ÉTAPE 11 — RG-08 : verrouillage croisé après tentative
    // =========================================================
    const lockedUpdate = await request(app)
      .put(`/api/questions/${questionId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ points: 99 });
    check("11a. RG-08 : modif question verrouillée -> 403", lockedUpdate.status === 403, lockedUpdate.body);

    const lockedDelete = await request(app)
      .delete(`/api/questions/${questionId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("11b. RG-08 : suppression question verrouillée -> 403", lockedDelete.status === 403, lockedDelete.body);

    const lockedCreate = await request(app)
      .post(`/api/exams/${examId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "Nouvelle question après tentative",
        points: 5,
        choices: [
          { text: "a", correct: true },
          { text: "b", correct: false },
        ],
      });
    check("11c. RG-08 étendu : création après tentative -> 403", lockedCreate.status === 403, lockedCreate.body);

    const lockedExamUpdate = await request(app)
      .put(`/api/exams/${examId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Nouveau titre" });
    check("11d. RG-08 : modif examen verrouillé -> 403", lockedExamUpdate.status === 403, lockedExamUpdate.body);

    const examDeleteWithAttempts = await request(app)
      .delete(`/api/exams/${examId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("11e. RG-09 : suppression examen avec tentatives -> 409", examDeleteWithAttempts.status === 409, examDeleteWithAttempts.body);

    // =========================================================
    // ÉTAPE 12 — Résultats admin (moyenne, etc.)
    // =========================================================
    const resultsRes = await request(app)
      .get(`/api/exams/${examId}/results`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("12a. GET /api/exams/:id/results -> 200", resultsRes.status === 200, resultsRes.body);
    check("12b. Résultats contient 1 tentative", resultsRes.body.results?.length === 1, resultsRes.body);
    check("12c. Moyenne = 10", resultsRes.body.average === 10, resultsRes.body);

    // =========================================================
    // ÉTAPE 13 — Cours avec examens ne peut pas être supprimé (RG-09)
    // =========================================================
    const courseDeleteBlocked = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("13a. RG-09 : suppression cours avec examens -> 409", courseDeleteBlocked.status === 409, courseDeleteBlocked.body);

    // =========================================================
    // ÉTAPE 14 — Désactivation étudiant (RG-10, RG-11)
    // =========================================================
    const deactivate = await request(app)
      .delete(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("14a. Désactivation étudiant -> 200", deactivate.status === 200, deactivate.body);

    const loginAfterDeactivation = await request(app)
      .post("/api/auth/login")
      .send({ email: "etudiant.e2e@examhub.io", password: "password123" });
    check("14b. RG-11 : login compte désactivé -> 403 (distinct de 401)", loginAfterDeactivation.status === 403, loginAfterDeactivation.body);

    console.log(failed ? "\n Au moins un test a échoué — voir ci-dessus." : "\n Tous les tests du cycle E2E sont passés.");
  } finally {
    await cleanup();
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch((err) => {
  console.error("Erreur fatale du test E2E :", err);
  process.exit(1);
});