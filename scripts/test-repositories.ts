import dotenv from "dotenv";
dotenv.config();

import { pool } from "../src/config/db";
import { ExamRepositorie } from "../src/Repositorie/ExamRepositorie";
import { QuestionRepositorie } from "../src/Repositorie/QuestionRepositorie";

 

const TEST_COURSE_ID = 1; // <-- ajustez selon l'id réel d'un cours existant chez vous

async function main() {
  console.log("=== Test ExamRepositorie + QuestionRepositorie ===\n");

  // ---------------------------------------------------------------------
  // 1. Vérifier que le cours de test existe (sinon le test n'a pas de sens)
  // ---------------------------------------------------------------------
  const courseExists = await ExamRepositorie.courseExists(TEST_COURSE_ID);
  console.log(`1. Cours id=${TEST_COURSE_ID} existe : ${courseExists}`);
  if (!courseExists) {
    console.error(
      `\n❌ ARRÊT : aucun cours avec l'id ${TEST_COURSE_ID} n'existe en base.\n` +
        `Insérez-en un manuellement (voir le commentaire en haut de ce fichier) ou changez TEST_COURSE_ID.`
    );
    process.exit(1);
  }

  // ---------------------------------------------------------------------
  // 2. Créer un examen
  // ---------------------------------------------------------------------
  const exam = await ExamRepositorie.create({
    courseId: TEST_COURSE_ID,
    title: "Examen de test BE2",
    description: "Créé par le script de vérification Repositorie.",
    startsAt: new Date("2026-01-01T08:00:00Z"),
    endsAt: new Date("2026-12-31T10:00:00Z"),
  });
  console.log("\n2. Examen créé :", exam);

  // ---------------------------------------------------------------------
  // 3. Le relire par id
  // ---------------------------------------------------------------------
  const foundExam = await ExamRepositorie.findById(exam.id);
  console.log("\n3. Examen relu par id :", foundExam);
  assertEqual(foundExam?.title, exam.title, "Le titre relu doit correspondre à celui créé");

  // ---------------------------------------------------------------------
  // 4. Le lister (findAll, avec et sans filtre)
  // ---------------------------------------------------------------------
  const allExams = await ExamRepositorie.findAll();
  console.log(`\n4a. Nombre total d'examens en base : ${allExams.length}`);
  assertTrue(
    allExams.some((e) => e.id === exam.id),
    "L'examen créé doit apparaître dans findAll() sans filtre"
  );

  const filteredExams = await ExamRepositorie.findAll(TEST_COURSE_ID);
  console.log(`4b. Nombre d'examens pour le cours ${TEST_COURSE_ID} : ${filteredExams.length}`);
  assertTrue(
    filteredExams.every((e) => e.courseId === TEST_COURSE_ID),
    "findAll(courseId) ne doit renvoyer que des examens de ce cours"
  );

  // ---------------------------------------------------------------------
  // 5. Le modifier (mise à jour partielle)
  // ---------------------------------------------------------------------
  const updatedExam = await ExamRepositorie.update(exam.id, { title: "Titre modifié" });
  console.log("\n5. Examen après update partiel (titre seul) :", updatedExam);
  assertEqual(updatedExam?.title, "Titre modifié", "Le titre doit être mis à jour");
  assertEqual(
    updatedExam?.description,
    exam.description,
    "La description ne doit PAS avoir changé (update partiel)"
  );

  // ---------------------------------------------------------------------
  // 6. hasAttempts doit être false (aucune tentative sur ce nouvel examen)
  // ---------------------------------------------------------------------
  const hasAttempts = await ExamRepositorie.hasAttempts(exam.id);
  console.log(`\n6. hasAttempts (doit être false) : ${hasAttempts}`);
  assertEqual(hasAttempts, false, "Un examen tout juste créé ne doit avoir aucune tentative");

  // ---------------------------------------------------------------------
  // 7. Créer une question avec 3 choix, dont 1 correct (RG-04 respecté)
  // ---------------------------------------------------------------------
  const question = await QuestionRepositorie.create(exam.id, {
    text: "2 + 2 = ?",
    points: 5,
    choices: [
      { text: "3", correct: false },
      { text: "4", correct: true },
      { text: "5", correct: false },
    ],
  });
  console.log("\n7. Question créée avec ses choix :", JSON.stringify(question, null, 2));
  assertEqual(question.choices.length, 3, "La question doit avoir exactement 3 choix");
  assertEqual(
    question.choices.filter((c) => c.correct).length,
    1,
    "Exactement un choix doit être marqué correct"
  );

  // ---------------------------------------------------------------------
  // 8. La relire par examId (findByExamId, teste le JOIN + regroupement)
  // ---------------------------------------------------------------------
  const questionsForExam = await QuestionRepositorie.findByExamId(exam.id);
  console.log(`\n8. Questions relues pour l'examen (findByExamId) : ${questionsForExam.length} question(s)`);
  assertEqual(questionsForExam.length, 1, "Un seul question doit exister pour cet examen");
  assertEqual(questionsForExam[0].choices.length, 3, "Le JOIN doit bien ramener les 3 choix");

  // ---------------------------------------------------------------------
  // 9. La relire par id (findById, teste aussi le JOIN)
  // ---------------------------------------------------------------------
  const foundQuestion = await QuestionRepositorie.findById(question.id);
  console.log("\n9. Question relue par id :", foundQuestion?.text);
  assertEqual(foundQuestion?.choices.length, 3, "findById doit aussi ramener les 3 choix");

  // ---------------------------------------------------------------------
  // 10. La modifier en remplaçant tous les choix (teste la transaction update)
  // ---------------------------------------------------------------------
  const updatedQuestion = await QuestionRepositorie.update(question.id, {
    choices: [
      { text: "Vrai", correct: true },
      { text: "Faux", correct: false },
    ],
  });
  console.log("\n10. Question après remplacement des choix :", JSON.stringify(updatedQuestion, null, 2));
  assertEqual(updatedQuestion?.choices.length, 2, "Les choix doivent être remplacés (2 au lieu de 3)");
  assertEqual(updatedQuestion?.text, question.text, "Le texte ne doit pas changer (non fourni dans l'update)");

  // ---------------------------------------------------------------------
  // 11. findExamIdByQuestionId (utile pour RG-08 dans le futur Service)
  // ---------------------------------------------------------------------
  const foundExamId = await QuestionRepositorie.findExamIdByQuestionId(question.id);
  console.log(`\n11. examId retrouvé depuis la question : ${foundExamId}`);
  assertEqual(foundExamId, exam.id, "L'examId retrouvé doit correspondre à l'examen parent");

  // ---------------------------------------------------------------------
  // 12. Nettoyage : supprimer la question, puis l'examen créés par ce test
  // ---------------------------------------------------------------------
  const questionDeleted = await QuestionRepositorie.delete(question.id);
  console.log(`\n12a. Question supprimée : ${questionDeleted}`);
  assertEqual(questionDeleted, true, "La suppression de la question doit réussir");

  const examDeleted = await ExamRepositorie.delete(exam.id);
  console.log(`12b. Examen supprimé : ${examDeleted}`);
  assertEqual(examDeleted, true, "La suppression de l'examen doit réussir (plus de tentatives ni questions dessus)");

  console.log("\n Tous les tests sont passés avec succès.");
}

// ----------------------------- Petits assert maison ---------------------

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    console.error(`\n ÉCHEC : ${message}`);
    console.error(`   attendu : ${JSON.stringify(expected)}`);
    console.error(`   obtenu  : ${JSON.stringify(actual)}`);
    process.exitCode = 1;
    throw new Error(message);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`\n ÉCHEC : ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
}

// ----------------------------- Exécution ---------------------------------

main()
  .catch((err) => {
    console.error("\n Le script a échoué :", err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end(); // ferme proprement le pool pg, sinon le process reste bloqué
  });
