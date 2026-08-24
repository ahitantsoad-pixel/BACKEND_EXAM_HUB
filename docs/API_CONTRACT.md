Exam Hub — Contrat d'API complet
Basé sur la Section 5 du sujet officiel (routes imposées) et sur les décisions de conception
validées en équipe.
Conventions globales
- IDs : entiers auto-incrémentés
- Dates : ISO 8601 ("2026-08-24T10:00:00Z")
- Auth : Authorization: Bearer <token>
- Toutes les routes sauf /api/auth/login nécessitent un JWT valide (24h)
- Toutes les erreurs suivent RG-13 : { "message": "..." } avec le code HTTP
approprié (400/401/403/404/409)
- Le champ correct d'un Choice n'est jamais renvoyé aux routes /api/my/* (RG-07)
0. Erreurs communes (RG-13)
Toutes les routes ci-dessous peuvent renvoyer, en plus des codes spécifiques listés :
Code Cas
400 Corps de requête invalide (champ manquant,
type incorrect, contrainte métier violée)
401 Token absent, invalide ou expiré
403 Rôle insuffisant, ou compte désactivé
(RG-11), ou ressource verrouillée (RG-08)
404 Ressource introuvable
409 Conflit (ex : tentative déjà existante RG-02,
suppression bloquée RG-09)
Format uniforme :
{ "message": "Cours introuvable." }
1. Authentification
POST /api/auth/login
Public.
Body :
{
"email": "admin@examhub.io",
"password": "motdepasse123"
}
Réponse 200 :
{
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
"user": {
"id": 1,
"name": "Alice Admin",
"email": "admin@examhub.io",
"role": "admin"
}
}
Erreurs :
- 401 — email/mot de passe incorrect : { "message": "Identifiants
invalides." }
- 403 — compte désactivé (RG-11) : { "message": "Ce compte a été
désactivé." }
Le message 401 doit être générique (ne pas préciser si c'est l'email ou le mot de
passe qui est faux), et distinct du 403 compte désactivé — c'est explicitement
RG-11.
2. Étudiants (/api/students) — Admin uniquement
GET /api/students
Réponse 200 :
[
{
"id": 5,
"name": "Jean Rakoto",
"email": "jean.rakoto@examhub.io",
"isActive": true,
"createdAt": "2026-08-01T09:00:00Z"
}
]
POST /api/students
Body :
{
"name": "Jean Rakoto",
"email": "jean.rakoto@examhub.io"
}
Réponse 201 — le mot de passe généré est renvoyé une seule fois :
{
"id": 5,
"name": "Jean Rakoto",
"email": "jean.rakoto@examhub.io",
"isActive": true,
"createdAt": "2026-08-24T10:00:00Z",
"initialPassword": "x7Fk29pQ"
}
Erreurs : 400 si email déjà utilisé ou champs manquants.
PUT /api/students/:id
Body (tous les champs optionnels, mise à jour partielle) :
{
"name": "Jean Rakoto Andria",
"email": "jean.andria@examhub.io"
}
Réponse 200 : même forme que GET /api/students/:id (sans mot de passe).
POST /api/students/:id/reset-password
Route séparée du PUT de mise à jour de profil, car il s'agit d'une action à effet de bord
(génération d'un nouveau secret), pas d'une mise à jour de champ classique.
Pas de body.
Réponse 200 — le nouveau mot de passe est renvoyé une seule fois :
{
"id": 5,
"name": "Jean Rakoto",
"email": "jean.rakoto@examhub.io",
"isActive": true,
"initialPassword": "m3Wp81zR"
}
Erreurs : 404 si l'étudiant n'existe pas.
Extension au-delà de la liste stricte de la Section 5 (qui n'impose que PUT/DELETE
/api/students/:id), nécessaire pour couvrir "réinitialiser le mot de passe" listé
en Section 2. À documenter comme telle dans le README.
DELETE /api/students/:id
Désactivation logique, pas de suppression physique (RG-10).
Réponse 200 :
{
"id": 5,
"name": "Jean Rakoto",
"email": "jean.rakoto@examhub.io",
"isActive": false
}
Erreurs : 404 si l'étudiant n'existe pas.
3. Cours (/api/courses) — Admin uniquement
GET /api/courses
Réponse 200 :
[
{ "id": 1, "code": "PROG2", "name": "Programmation avancée", "description": "..." }
]
POST /api/courses
Body :
{
"code": "PROG2",
"name": "Programmation avancée",
"description": "Introduction aux structures de données."
}
Réponse 201 : objet créé, forme identique à GET.
Erreurs : 400 si code déjà utilisé ou champs manquants.
PUT /api/courses/:id
Body : mêmes champs que POST, tous optionnels.
Réponse 200 : objet mis à jour.
DELETE /api/courses/:id
Réponse 200 :
{ "id": 1, "deleted": true }
Erreurs :
- 409 — le cours possède des examens (RG-09) : { "message": "Impossible de
supprimer un cours qui possède des examens." }
- 404 — cours introuvable
4. Examens (/api/exams) — Admin uniquement
GET /api/exams
Filtre optionnel par cours : GET /api/exams?courseId=1
Réponse 200 :
[
{
"id": 10,
"courseId": 1,
"title": "Contrôle final",
"description": "QCM sur les 6 derniers chapitres.",
"startsAt": "2026-09-01T08:00:00Z",
"endsAt": "2026-09-01T10:00:00Z"
}
]
POST /api/exams
Body :
{
"courseId": 1,
"title": "Contrôle final",
"description": "QCM sur les 6 derniers chapitres.",
"startsAt": "2026-09-01T08:00:00Z",
"endsAt": "2026-09-01T10:00:00Z"
}
Réponse 201 : objet créé.
Erreurs : 400 si courseId inconnu, dates manquantes/incohérentes (endsAt ≤ startsAt).
GET /api/exams/:id
Réponse 200 : même forme qu'un élément de la liste.
PUT /api/exams/:id
Body : mêmes champs que POST, tous optionnels.
Réponse 200 : objet mis à jour.
Note : rien dans le sujet n'interdit de modifier un examen qui a des tentatives —
seuls les questions/choix sont verrouillés par RG-08. Si vous choisissez de
verrouiller aussi les champs de l'examen (fenêtre, cours) par cohérence,
documentez-le dans le README car ce n'est pas imposé.
DELETE /api/exams/:id
Réponse 200 :
{ "id": 10, "deleted": true }
Erreurs : 409 si l'examen possède des tentatives (RG-09) : { "message": "Impossible
de supprimer un examen qui a des tentatives." }
5. Questions (/api/exams/:id/questions,
/api/questions/:id) — Admin uniquement
GET /api/exams/:id/questions
Réponse 200 — avec le champ correct (vue admin) :
[
{
"id": 42,
"examId": 10,
"text": "Quelle est la complexité de la recherche binaire ?",
"points": 2,
"choices": [
{ "id": 100, "text": "O(n)", "correct": false },
{ "id": 101, "text": "O(log n)", "correct": true },
{ "id": 102, "text": "O(n²)", "correct": false }
]
}
]
POST /api/exams/:id/questions
Body :
{
"text": "Quelle est la complexité de la recherche binaire ?",
"points": 2,
"choices": [
{ "text": "O(n)", "correct": false },
{ "text": "O(log n)", "correct": true },
{ "text": "O(n²)", "correct": false }
]
}
Réponse 201 : objet créé, forme identique à GET.
Erreurs (RG-04) :
- 400 si moins de 2 ou plus de 6 choix : { "message": "Une question doit
avoir entre 2 et 6 choix." }
- 400 si le nombre de choix corrects ≠ 1 : { "message": "Une question doit
avoir exactement un choix correct." }
- 403 si l'examen a déjà des tentatives (RG-08) : { "message": "Impossible
d'ajouter une question : l'examen a déjà des tentatives." }
PUT /api/questions/:id
Body : text, points, choices (remplace la liste complète des choix — le plus simple à
raisonner, à documenter dans le README).
Réponse 200 : objet mis à jour.
Erreurs : mêmes règles RG-04, plus 403 si verrouillé (RG-08).
DELETE /api/questions/:id
Réponse 200 :
{ "id": 42, "deleted": true }
Erreurs : 403 si l'examen a des tentatives (RG-08).
6. Résultats admin (/api/exams/:id/results) — Admin
uniquement
GET /api/exams/:id/results
Réponse 200 :
{
"examId": 10,
"examTitle": "Contrôle final",
"totalPoints": 20,
"average": 14.3,
"results": [
{
"studentId": 5,
"studentName": "Jean Rakoto",
"attemptId": 77,
"score": 16,
"submittedAt": "2026-09-01T08:45:00Z",
"attemptsCount": 1
}
]
}
- average : moyenne des scores en points bruts, arrondie à 1 décimale.
- attemptsCount : toujours 1 dans la pratique vu RG-02, mais gardé pour lisibilité et
robustesse si la contrainte venait à évoluer.
- Si aucun étudiant n'a encore passé l'examen : results: [], average: 0.
7. Espace étudiant (/api/my/*) — Étudiant uniquement
GET /api/my/exams
Liste des examens actuellement disponibles pour l'étudiant connecté (fenêtre ouverte,
RG-03) et pas encore passés (RG-02).
Réponse 200 :
[
{
"id": 10,
"courseId": 1,
"courseName": "Programmation avancée",
"title": "Contrôle final",
"description": "QCM sur les 6 derniers chapitres.",
"startsAt": "2026-09-01T08:00:00Z",
"endsAt": "2026-09-01T10:00:00Z"
}
]
Un examen déjà passé, ou hors fenêtre, n'apparaît simplement pas dans cette liste
— c'est plus simple et plus sûr qu'un champ status que le front devrait interpréter.
GET /api/my/exams/:id
Détail d'un examen pour le passer — sans le champ correct (RG-07).
Réponse 200 :
{
"id": 10,
"title": "Contrôle final",
"description": "QCM sur les 6 derniers chapitres.",
"startsAt": "2026-09-01T08:00:00Z",
"endsAt": "2026-09-01T10:00:00Z",
"questions": [
{
"id": 42,
"text": "Quelle est la complexité de la recherche binaire ?",
"points": 2,
"choices": [
{ "id": 100, "text": "O(n)" },
{ "id": 101, "text": "O(log n)" },
{ "id": 102, "text": "O(n²)" }
]
}
]
}
Erreurs (RG-03, vérifié côté serveur à l'affichage) :
- 403 — hors fenêtre : { "message": "Cet examen n'est pas disponible
actuellement." }
- 409 — déjà passé (RG-02) : { "message": "Vous avez déjà passé cet
examen." }
- 404 — examen introuvable
POST /api/my/exams/:id/submit
Body — toutes les questions de l'examen sont énumérées ; une question sans réponse a
choiceId: null (RG-05) :
{
"answers": [
{ "questionId": 42, "choiceId": 101 },
{ "questionId": 43, "choiceId": null }
]
}
Réponse 201 — la note et la correction complète sont renvoyées immédiatement (RG-12) :
{
"attemptId": 77,
"score": 16,
"totalPoints": 20,
"submittedAt": "2026-09-01T08:45:00Z",
"answers": [
{
"questionId": 42,
"questionText": "Quelle est la complexité de la recherche binaire ?",
"points": 2,
"choiceId": 101,
"correctChoiceId": 101,
"isCorrect": true,
"choices": [
{ "id": 100, "text": "O(n)", "correct": false },
{ "id": 101, "text": "O(log n)", "correct": true },
{ "id": 102, "text": "O(n²)", "correct": false }
]
},
{
"questionId": 43,
"questionText": "...",
"points": 3,
"choiceId": null,
"correctChoiceId": 89,
"isCorrect": false,
"choices": [ "..." ]
}
]
}
Erreurs :
- 403 — hors fenêtre (RG-03) : { "message": "Cet examen n'est pas
disponible actuellement." }
- 409 — tentative déjà existante (RG-02) : { "message": "Vous avez déjà passé
cet examen." }
- 400 — questionId inconnu, choiceId n'appartenant pas à la question, ou question
de l'examen manquante dans answers : { "message": "Réponse invalide
pour une ou plusieurs questions." }
RG-06 : le serveur recalcule tout depuis la base — il ignore toute note ou statut
"correct" que le client tenterait d'envoyer. Le body ne contient que des choiceId,
jamais un score.
GET /api/my/results
Historique des tentatives de l'étudiant connecté.
Réponse 200 :
[
{
"attemptId": 77,
"examId": 10,
"examTitle": "Contrôle final",
"courseName": "Programmation avancée",
"score": 16,
"totalPoints": 20,
"submittedAt": "2026-09-01T08:45:00Z"
}
]
GET /api/my/results/:attemptId
Détail d'une tentative passée — correction complète question par question, réutilise exactement
la forme de la réponse de POST /api/my/exams/:id/submit. RG-12 s'applique toujours ici
: c'est une tentative déjà soumise, donc l'étudiant a le droit de revoir sa correction complète
(contrairement à GET /api/my/exams/:id avant soumission, où RG-07 interdit tout champ
correct).
Réponse 200 :
{
"attemptId": 77,
"examId": 10,
"examTitle": "Contrôle final",
"score": 16,
"totalPoints": 20,
"submittedAt": "2026-09-01T08:45:00Z",
"answers": [
{
"questionId": 42,
"questionText": "Quelle est la complexité de la recherche binaire ?",
"points": 2,
"choiceId": 101,
"correctChoiceId": 101,
"isCorrect": true,
"choices": [
{ "id": 100, "text": "O(n)", "correct": false },
{ "id": 101, "text": "O(log n)", "correct": true },
{ "id": 102, "text": "O(n²)", "correct": false }
]
}
]
}
Erreurs :
- 404 — tentative introuvable
- 403 — la tentative appartient à un autre étudiant : { "message": "Accès refusé à
cette tentative." }
Extension au-delà de la liste stricte de la Section 5 (qui n'impose que GET
/api/my/results en liste), nécessaire pour couvrir l'écran "page de résultat avec
correction colorée juste/faux" / historique décrit en Section 6-7. À documenter
comme telle dans le README.
Récapitulatif des routes imposées (Section 5, vérifié)
POST /api/auth/login
# Admin
GET/POST /api/students PUT/DELETE /api/students/:id
GET/POST /api/courses PUT/DELETE /api/courses/:id
GET/POST /api/exams GET/PUT/DELETE /api/exams/:id
GET/POST /api/exams/:id/questions
PUT/DELETE /api/questions/:id
GET /api/exams/:id/results
# Étudiant
GET /api/my/exams GET /api/my/exams/:id
POST /api/my/exams/:id/submit GET /api/my/results
Routes ajoutées en extension (non imposées par la Section 5, à
documenter dans le README)
POST /api/students/:id/reset-password # réinitialisation du mot de passe
GET /api/my/results/:attemptId # détail/correction d'une tentative passéegit add docs/API_CONTRACT.md
