-- Add enum and column for user signature preference
CREATE TYPE "SignaturePreference" AS ENUM ('VISIBLE', 'INVISIBLE');

ALTER TABLE "users"
ADD COLUMN "preferredSignatureMode" "SignaturePreference" NOT NULL DEFAULT 'INVISIBLE';
