-- =============================================================================
-- Exam Hub — Schéma SQL complet (PostgreSQL)
-- =============================================================================
-- À exécuter une seule fois à l'initialisation du conteneur Docker.
-- Aucun ORM (contrainte du sujet) : ce fichier EST le modèle de données.
--
-- Convention : tous les timestamps sont en UTC (TIMESTAMPTZ), tous les IDs
-- sont des entiers auto-incrémentés (BIGSERIAL / SERIAL), conformément aux
-- décisions de conception de l'équipe.
--
-- Ce fichier ne doit être modifié que par une seule personne à la fois,
-- avec annonce dans le groupe avant toute modification (règle d'équipe).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
 
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,           -- bcrypt, jamais le mot de passe en clair
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('admin', 'student')),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

-- -----------------------------------------------------------------------------
-- courses
-- -----------------------------------------------------------------------------
 
CREATE TABLE courses (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50)   NOT NULL UNIQUE,
    name        VARCHAR(255)  NOT NULL,
    description TEXT          NOT NULL DEFAULT ''
);

-- -----------------------------------------------------------------------------
-- exams
-- -----------------------------------------------------------------------------
 
CREATE TABLE exams (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT        NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
    title       VARCHAR(255)  NOT NULL,
    description TEXT          NOT NULL DEFAULT '',
    starts_at   TIMESTAMPTZ   NOT NULL,
    ends_at     TIMESTAMPTZ   NOT NULL,
    CONSTRAINT chk_exam_window CHECK (ends_at > starts_at)
);

CREATE INDEX idx_exams_course_id ON exams (course_id);

-- -----------------------------------------------------------------------------
-- questions
-- -----------------------------------------------------------------------------
 
CREATE TABLE questions (
    id      BIGSERIAL PRIMARY KEY,
    exam_id BIGINT        NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
    text    TEXT          NOT NULL,
    points  INTEGER       NOT NULL CHECK (points > 0)
);

CREATE INDEX idx_questions_exam_id ON questions (exam_id);

-- -----------------------------------------------------------------------------
-- choices
-- -----------------------------------------------------------------------------
 
CREATE TABLE choices (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT        NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    text        TEXT          NOT NULL,
    correct     BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_choices_question_id ON choices (question_id);

-- -----------------------------------------------------------------------------
-- attempts
-- -----------------------------------------------------------------------------
 
CREATE TABLE attempts (
    id           BIGSERIAL PRIMARY KEY,
    student_id   BIGINT        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    exam_id      BIGINT        NOT NULL REFERENCES exams (id) ON DELETE RESTRICT,
    score        INTEGER       NOT NULL DEFAULT 0 CHECK (score >= 0),
    submitted_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attempt_student_exam UNIQUE (student_id, exam_id)  -- RG-02
);

CREATE INDEX idx_attempts_student_id ON attempts (student_id);
CREATE INDEX idx_attempts_exam_id    ON attempts (exam_id);

-- -----------------------------------------------------------------------------
-- answers
-- -----------------------------------------------------------------------------
 
CREATE TABLE answers (
    id          BIGSERIAL PRIMARY KEY,
    attempt_id  BIGINT        NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
    question_id BIGINT        NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
    choice_id   BIGINT        NULL     REFERENCES choices (id) ON DELETE RESTRICT,  -- RG-05
    CONSTRAINT uq_answer_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_answers_attempt_id  ON answers (attempt_id);
CREATE INDEX idx_answers_question_id ON answers (question_id);

