// scripts/test-edge-cases.ts
//
// Complète test-final-e2e.ts (chemin heureux) avec les cas limites et RG
// non couverts là-bas : RG-03 (fenêtre), RG-05 (soumission partielle),
// isolation entre étudiants, RG-10 (résultats consultables après
// désactivation), bornes exactes RG-04 (2 et 6 choix), et 404 génériques.
//
// Indépendant de test-final-e2e.ts : crée son propre cours/étudiants/examens
// et nettoie tout en fin d'exécution, pour pouvoir tourner seul ou après
// l'autre script sans collision de données.

import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/config/db";

const app = createApp();

let adminToken: string;

// Étudiant A : utilisé pour RG-03, RG-05, RG-10
let studentAToken: string;
let studentAId: number;

// Étudiant B : utilisé uniquement pour tester l'isolation (accès à la tentative de A)
let studentBToken: string;
let studentBId: number;

let courseId: number;

// Examen dont la fenêtre n'est pas encore ouverte (RG-03)
let futureExamId: number;
// Examen dont la fenêtre est déjà fermée (RG-03)
let pastExamId: number;
// Examen ouvert, utilisé pour RG-05 (soumission partielle) et l'isolation
let openExamId: number;

let q1Id: number; // répondue correctement
let q2Id: number; // laissée sans réponse (RG-05)
let choiceQ1CorrectId: number;
let choiceQ2CorrectId: number;

let openExamAttemptId: number; // tentative de l'étudiant A sur openExam

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
  const examIds = [futureExamId, pastExamId, openExamId].filter(Boolean);

  await pool.query(
    `DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id = ANY($1))`,
    [examIds]
  );
  await pool.query(`DELETE FROM attempts WHERE exam_id = ANY($1)`, [examIds]);
  for (const id of examIds) {
    await pool.query(`DELETE FROM questions WHERE exam_id = $1`, [id]); // choices en CASCADE
  }
  for (const id of examIds) {
    await pool.query(`DELETE FROM exams WHERE id = $1`, [id]);
  }
  if (courseId) await pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);
  if (studentAId) await pool.query(`DELETE FROM users WHERE id = $1`, [studentAId]);
  if (studentBId) await pool.query(`DELETE FROM users WHERE id = $1`, [studentBId]);
}

async function main() {
  try {
    // =========================================================
    // SETUP — admin, cours, 2 étudiants
    // =========================================================
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@examhub.io", password: "admin123" });
    check("setup. Login admin -> 200", adminLogin.status === 200, adminLogin.body);
    adminToken = adminLogin.body.token;

    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "EDGECASE", name: "Cours Edge Cases", description: "Tests limites" });
    check("setup. Création cours -> 201", courseRes.status === 201, courseRes.body);
    courseId = courseRes.body.id;

    const studentARes = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Étudiant A", email: "etudiant.a.edge@examhub.io", password: "password123" });
    check("setup. Création étudiant A -> 201", studentARes.status === 201, studentARes.body);
    studentAId = studentARes.body.id;

    const studentBRes = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Étudiant B", email: "etudiant.b.edge@examhub.io", password: "password123" });
    check("setup. Création étudiant B -> 201", studentBRes.status === 201, studentBRes.body);
    studentBId = studentBRes.body.id;

    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ email: "etudiant.a.edge@examhub.io", password: "password123" });
    studentAToken = loginA.body.token;

    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ email: "etudiant.b.edge@examhub.io", password: "password123" });
    studentBToken = loginB.body.token;
    check("setup. Login étudiant A et B -> 200", loginA.status === 200 && loginB.status === 200);

    // =========================================================
    // RG-03 — Fenêtre de disponibilité
    // =========================================================
    const now = new Date();

    // Examen futur : commence dans 1h, finit dans 2h
    const futureRes = await request(app)
      .post("/api/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        title: "Examen futur",
        description: "Pas encore ouvert",
        startsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      });
    futureExamId = futureRes.body.id;

    // Examen passé : commencé il y a 2h, fini il y a 1h
    const pastRes = await request(app)
      .post("/api/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        title: "Examen passé",
        description: "Fenêtre fermée",
        startsAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      });
    pastExamId = pastRes.body.id;

    // Examen ouvert, pour RG-05 et l'isolation
    const openRes = await request(app)
      .post("/api/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        title: "Examen ouvert",
        description: "Pour RG-05 et isolation",
        startsAt: new Date(now.getTime() - 60 * 1000).toISOString(),
        endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });
    openExamId = openRes.body.id;

    check(
      "RG-03. 3 examens créés (futur/passé/ouvert) -> 201",
      futureRes.status === 201 && pastRes.status === 201 && openRes.status === 201
    );

    // Ni le futur ni le passé ne doivent apparaître dans /api/my/exams
    const availableList = await request(app)
      .get("/api/my/exams")
      .set("Authorization", `Bearer ${studentAToken}`);
    const futureListed = availableList.body.some((e: { id: number }) => e.id === futureExamId);
    const pastListed = availableList.body.some((e: { id: number }) => e.id === pastExamId);
    check("RG-03a. Examen futur absent de /my/exams", !futureListed, availableList.body);
    check("RG-03b. Examen passé absent de /my/exams", !pastListed, availableList.body);

    // Accès direct à un examen futur -> 403 (hors fenêtre), pas juste absent de la liste
    const getFuture = await request(app)
      .get(`/api/my/exams/${futureExamId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    check("RG-03c. GET /my/exams/:id sur examen futur -> 403", getFuture.status === 403, getFuture.body);

    const getPast = await request(app)
      .get(`/api/my/exams/${pastExamId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    check("RG-03d. GET /my/exams/:id sur examen passé -> 403", getPast.status === 403, getPast.body);

    // Soumission directe sur un examen hors fenêtre -> 403, vérifié aussi côté submit
    const submitFuture = await request(app)
      .post(`/api/my/exams/${futureExamId}/submit`)
      .set("Authorization", `Bearer ${studentAToken}`)
      .send({ answers: [] });
    check(
      "RG-03e. Soumission sur examen futur -> 403 (vérifié à la soumission, pas juste à l'affichage)",
      submitFuture.status === 403,
      submitFuture.body
    );

    const submitPast = await request(app)
      .post(`/api/my/exams/${pastExamId}/submit`)
      .set("Authorization", `Bearer ${studentAToken}`)
      .send({ answers: [] });
    check("RG-03f. Soumission sur examen passé -> 403", submitPast.status === 403, submitPast.body);

    // =========================================================
    // RG-04 — Bornes exactes (2 min, 6 max) sur l'examen "ouvert"
    // =========================================================
    const q1Res = await request(app)
      .post(`/api/exams/${openExamId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "Question 1 (répondue correctement)",
        points: 6,
        choices: [
          { text: "Bon choix", correct: true },
          { text: "Mauvais choix", correct: false },
        ],
      });
    check("RG-04a. Question avec 2 choix (borne min) -> 201", q1Res.status === 201, q1Res.body);
    q1Id = q1Res.body.id;
    choiceQ1CorrectId = q1Res.body.choices.find((c: { correct: boolean }) => c.correct).id;

    const q2Res = await request(app)
      .post(`/api/exams/${openExamId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "Question 2 (laissée sans réponse)",
        points: 4,
        choices: [
          { text: "a", correct: false },
          { text: "b", correct: false },
          { text: "c", correct: true },
          { text: "d", correct: false },
          { text: "e", correct: false },
          { text: "f", correct: false },
        ],
      });
    check("RG-04b. Question avec 6 choix (borne max) -> 201", q2Res.status === 201, q2Res.body);
    q2Id = q2Res.body.id;
    choiceQ2CorrectId = q2Res.body.choices.find((c: { correct: boolean }) => c.correct).id;

    const q7ChoicesRes = await request(app)
      .post(`/api/exams/${openExamId}/questions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        text: "7 choix, doit être rejetée",
        points: 1,
        choices: [
          { text: "a", correct: true },
          { text: "b", correct: false },
          { text: "c", correct: false },
          { text: "d", correct: false },
          { text: "e", correct: false },
          { text: "f", correct: false },
          { text: "g", correct: false },
        ],
      });
    check(
      "RG-04c. 7 choix (au-delà de la borne max) -> 400",
      q7ChoicesRes.status === 400,
      q7ChoicesRes.body
    );

    // =========================================================
    // RG-05 — Soumission partielle : Q1 répondue, Q2 laissée vide
    // =========================================================
    const partialSubmit = await request(app)
      .post(`/api/my/exams/${openExamId}/submit`)
      .set("Authorization", `Bearer ${studentAToken}`)
      .send({
        answers: [
          { questionId: q1Id, choiceId: choiceQ1CorrectId },
          { questionId: q2Id, choiceId: null },
        ],
      });
    check("RG-05a. Soumission partielle acceptée -> 201", partialSubmit.status === 201, partialSubmit.body);
    check(
      "RG-05b. Score = seulement les points de Q1 (6), Q2 vaut 0",
      partialSubmit.body.score === 6,
      partialSubmit.body
    );
    const q2Answer = partialSubmit.body.answers.find((a: { questionId: number }) => a.questionId === q2Id);
    check("RG-05c. Q2 non répondue -> isCorrect false", q2Answer?.isCorrect === false, q2Answer);
    check("RG-05d. Q2 non répondue -> choiceId null dans la correction", q2Answer?.choiceId === null, q2Answer);
    openExamAttemptId = partialSubmit.body.attemptId;

    // =========================================================
    // Isolation entre étudiants — B ne peut pas voir la tentative de A
    // =========================================================
    const crossAccess = await request(app)
      .get(`/api/my/results/${openExamAttemptId}`)
      .set("Authorization", `Bearer ${studentBToken}`);
    check(
      "ISO-a. Étudiant B sur la tentative de A -> 403 (pas 404, pas les données)",
      crossAccess.status === 403,
      crossAccess.body
    );

    // A, lui, peut bien la voir
    const ownAccess = await request(app)
      .get(`/api/my/results/${openExamAttemptId}`)
      .set("Authorization", `Bearer ${studentAToken}`);
    check("ISO-b. Étudiant A sur sa propre tentative -> 200", ownAccess.status === 200, ownAccess.body);

    // B tente aussi de soumettre l'examen déjà passé par A -> doit fonctionner pour B
    // (RG-02 est par étudiant, pas par examen global) puis retenter -> 409
    const bFirstSubmit = await request(app)
      .post(`/api/my/exams/${openExamId}/submit`)
      .set("Authorization", `Bearer ${studentBToken}`)
      .send({ answers: [{ questionId: q1Id, choiceId: choiceQ1CorrectId }] });
    check(
      "ISO-c. RG-02 est par étudiant : B peut passer l'examen même si A l'a déjà passé -> 201",
      bFirstSubmit.status === 201,
      bFirstSubmit.body
    );

    const bSecondSubmit = await request(app)
      .post(`/api/my/exams/${openExamId}/submit`)
      .set("Authorization", `Bearer ${studentBToken}`)
      .send({ answers: [{ questionId: q1Id, choiceId: choiceQ1CorrectId }] });
    check("ISO-d. RG-02 : B ne peut pas repasser -> 409", bSecondSubmit.status === 409, bSecondSubmit.body);

    // =========================================================
    // RG-10 — Résultats consultables par l'admin après désactivation
    // =========================================================
    const deactivateA = await request(app)
      .delete(`/api/students/${studentAId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    check("RG-10a. Désactivation étudiant A -> 200", deactivateA.status === 200, deactivateA.body);

    const resultsAfterDeactivation = await request(app)
      .get(`/api/exams/${openExamId}/results`)
      .set("Authorization", `Bearer ${adminToken}`);
    check(
      "RG-10b. GET /api/exams/:id/results -> 200 après désactivation d'un participant",
      resultsAfterDeactivation.status === 200,
      resultsAfterDeactivation.body
    );
    const aStillInResults = resultsAfterDeactivation.body.results?.some(
      (r: { studentId: number }) => r.studentId === studentAId
    );
    check(
      "RG-10c. Résultat de l'étudiant A désactivé toujours visible par l'admin",
      aStillInResults === true,
      resultsAfterDeactivation.body
    );

    // A désactivé ne peut plus se connecter (déjà couvert par test-final-e2e,
    // revérifié ici car c'est la même action RG-10/RG-11 qu'on vient de déclencher)
    const loginDeactivatedA = await request(app)
      .post("/api/auth/login")
      .send({ email: "etudiant.a.edge@examhub.io", password: "password123" });
    check(
      "RG-10d. Login étudiant A désactivé -> 403",
      loginDeactivatedA.status === 403,
      loginDeactivatedA.body
    );

    // =========================================================
    // 404 génériques — ressources inexistantes
    // =========================================================
    const notFoundExam = await request(app)
      .get("/api/exams/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    check("404a. GET /api/exams/:id inexistant -> 404", notFoundExam.status === 404, notFoundExam.body);

    const notFoundQuestionUpdate = await request(app)
      .put("/api/questions/999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ points: 5 });
    check(
      "404b. PUT /api/questions/:id inexistant -> 404",
      notFoundQuestionUpdate.status === 404,
      notFoundQuestionUpdate.body
    );

    const notFoundQuestionDelete = await request(app)
      .delete("/api/questions/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    check(
      "404c. DELETE /api/questions/:id inexistant -> 404",
      notFoundQuestionDelete.status === 404,
      notFoundQuestionDelete.body
    );

    const notFoundStudent = await request(app)
      .put("/api/students/999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fantôme" });
    check("404d. PUT /api/students/:id inexistant -> 404", notFoundStudent.status === 404, notFoundStudent.body);

    const notFoundCourse = await request(app)
      .delete("/api/courses/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    check("404e. DELETE /api/courses/:id inexistant -> 404", notFoundCourse.status === 404, notFoundCourse.body);

    const notFoundResults = await request(app)
      .get("/api/exams/999999/results")
      .set("Authorization", `Bearer ${adminToken}`);
    check(
      "404f. GET /api/exams/:id/results sur examen inexistant -> 404",
      notFoundResults.status === 404,
      notFoundResults.body
    );

    const notFoundAttemptDetail = await request(app)
      .get("/api/my/results/999999")
      .set("Authorization", `Bearer ${studentBToken}`);
    check(
      "404g. GET /api/my/results/:attemptId inexistant -> 404",
      notFoundAttemptDetail.status === 404,
      notFoundAttemptDetail.body
    );

    console.log(
      failed
        ? "\n Au moins un test edge-case a échoué — voir ci-dessus."
        : "\n Tous les tests edge-cases sont passés."
    );
  } finally {
    await cleanup();
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch((err) => {
  console.error("Erreur fatale du test edge-cases :", err);
  process.exit(1);
});