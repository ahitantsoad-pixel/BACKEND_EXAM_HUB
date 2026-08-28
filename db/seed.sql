-- =============================================================================
-- Exam Hub — Données initiales (seed)
-- =============================================================================

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
    'Admin Principal',
    'admin@examhub.io',
    '$2b$10$hF6R9J/1OiTFxfvtNpP6z.lXDhEoW1vktkOYOZYgyzv5rfDg3uKGu', -- admin123
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;  -- idempotent : rejouer le seed ne duplique pas le compte

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
    'Patrick',
    'patrick@gmail.com',
    '$2b$10$o5WpnH9LEGRe1TFvsX36aeXQP1CVGsoz6R8OlA2lD2FJgWa2WATZ.', -- patrick@123
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;