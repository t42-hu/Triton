ALTER TABLE "user" ALTER COLUMN "two_factor_enabled" SET DEFAULT true;
--> statement-breakpoint
-- Preserve the email approval protection that previously applied to every account.
UPDATE "user" SET "two_factor_enabled" = true;
