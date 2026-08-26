// scripts/test-question-service.ts
import { pool } from "../src/config/db";
import { QuestionService } from "../src/Service/QuestionService";
import { ApiError } from "../src/Security/ApiError";

async function expectApiError(fn: () => Promise<unknown>, expectedStatus: number, label: string) {
  try {
    await fn();
    console.error(` ${label} : aucune erreur levée (attendu ${expectedStatus})`);
    process.exitCode = 1;
  } catch (err) {
    if (err instanceof ApiError && err.status === expectedStatus) {
      console.log(` ${label} : ApiError ${err.status} — "${err.message}"`);
    } else {
      console.error(` ${label} : erreur inattendue`, err);
      process.exitCode = 1;
    }
  }
}

let courseId: number;
let examId: number;
let studentId: number;

async function cleanup() {
  // Ordre inverse des FK : answers -> attempts -> questions(+choices cascade) -> exams -> courses -> users
  if (examId) {
    await pool.query(`DELETE FROM attempts WHERE exam_id = $1`, [examId]);
    await pool.query(`DELETE FROM questions WHERE exam_id = $1`, [examId]); // choices en CASCADE
    await pool.query(`DELETE FROM exams WHERE id = $1`, [examId]);
  }
  if (courseId) {
    await pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);
  }
  if (studentId) {
    await pool.query(`DELETE FROM users WHERE id = $1`, [studentId]);
  }
}

async function main() {
  try {
    // --- Setup : cours + examen de test (committé directement via pool) ---
    const courseRes = await pool.query(
      `INSERT INTO courses (code, name, description) VALUES ($1,$2,$3) RETURNING id`,
      ["TESTQ", "Cours Test QuestionService", ""]
    );
    courseId = courseRes.rows[0].id;

    const examRes = await pool.query(
      `INSERT INTO exams (course_id, title, description, starts_at, ends_at)
       VALUES ($1,$2,$3, NOW(), NOW() + interval '1 hour') RETURNING id`,
      [courseId, "Examen Test", ""]
    );
    examId = examRes.rows[0].id;

    // --- 2. createQuestion valide ---
    const q = await QuestionService.createQuestion(examId, {
      text: "2 + 2 = ?",
      points: 10,
      choices: [
        { text: "3", correct: false },
        { text: "4", correct: true },
      ],
    });
    console.log(" createQuestion valide : id", q.id, "choices:", q.choices.length);

    // --- 3. 1 seul choix ---
    await expectApiError(
      () => QuestionService.createQuestion(examId, { text: "X", points: 5, choices: [{ text: "a", correct: true }] }),
      400,
      "1 seul choix"
    );

    // --- 4. 0 choix correct ---
    await expectApiError(
      () =>
        QuestionService.createQuestion(examId, {
          text: "X",
          points: 5,
          choices: [
            { text: "a", correct: false },
            { text: "b", correct: false },
          ],
        }),
      400,
      "0 choix correct"
    );

    // --- 5. 2 choix corrects ---
    await expectApiError(
      () =>
        QuestionService.createQuestion(examId, {
          text: "X",
          points: 5,
          choices: [
            { text: "a", correct: true },
            { text: "b", correct: true },
          ],
        }),
      400,
      "2 choix corrects"
    );

    // --- 6. 7 choix ---
    await expectApiError(
      () =>
        QuestionService.createQuestion(examId, {
          text: "X",
          points: 5,
          choices: Array.from({ length: 7 }, (_, i) => ({ text: `c${i}`, correct: i === 0 })),
        }),
      400,
      "7 choix"
    );

    // --- 7. examId inexistant ---
    await expectApiError(
      () =>
        QuestionService.createQuestion(999999, {
          text: "X",
          points: 5,
          choices: [
            { text: "a", correct: true },
            { text: "b", correct: false },
          ],
        }),
      404,
      "examId inexistant"
    );

    // --- 8. updateQuestion valide ---
    const updated = await QuestionService.updateQuestion(q.id, { points: 20 });
    console.log(" updateQuestion valide : points =", updated.points);

    // --- 9. deleteQuestion (question à part) ---
    const qToDelete = await QuestionService.createQuestion(examId, {
      text: "À supprimer",
      points: 1,
      choices: [
        { text: "a", correct: true },
        { text: "b", correct: false },
      ],
    });
    const del = await QuestionService.deleteQuestion(qToDelete.id);
    console.log(" deleteQuestion valide :", del);

    // --- 10. Verrouillage RG-08 : simuler une tentative ---
    const studentRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1,$2,$3,'student',TRUE) RETURNING id`,
      ["Étudiant Test", "etudiant.test.qservice@examhub.io", "hash-bidon"]
    );
    studentId = studentRes.rows[0].id;

    await pool.query(`INSERT INTO attempts (student_id, exam_id, score) VALUES ($1,$2,$3)`, [studentId, examId, 10]);

    await expectApiError(
      () =>
        QuestionService.createQuestion(examId, {
          text: "Après tentative",
          points: 5,
          choices: [
            { text: "a", correct: true },
            { text: "b", correct: false },
          ],
        }),
      403,
      "createQuestion après tentative (verrouillage étendu)"
    );

    await expectApiError(() => QuestionService.updateQuestion(q.id, { points: 99 }), 403, "updateQuestion après tentative");
    await expectApiError(() => QuestionService.deleteQuestion(q.id), 403, "deleteQuestion après tentative");

    console.log("\n--- Tous les tests sont passés ---");
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Erreur fatale du script de test :", err);
  process.exit(1);
});