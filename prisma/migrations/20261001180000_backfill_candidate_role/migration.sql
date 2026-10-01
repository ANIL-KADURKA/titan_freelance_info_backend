-- Data fix: give every non-deleted user with no role the default CANDIDATE role.
-- Accounts could end up role-less when registration failed after the user row
-- was created (see AuthService.register). Safe to re-run: it only touches
-- users that have no role at all.
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id"
FROM "users" u
CROSS JOIN "roles" r
WHERE r."name" = 'CANDIDATE'
  AND u."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur WHERE ur."user_id" = u."id"
  );
