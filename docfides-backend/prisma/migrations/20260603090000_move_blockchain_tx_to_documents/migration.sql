-- Move blockchain transaction metadata to the final document record.
ALTER TABLE "documents" ADD COLUMN "blockchainTxHash" TEXT;

UPDATE "documents" AS d
SET "blockchainTxHash" = latest_signature."blockchainTxHash"
FROM (
  SELECT DISTINCT ON ("documentId")
    "documentId",
    "blockchainTxHash"
  FROM "signatures"
  WHERE "blockchainTxHash" IS NOT NULL
  ORDER BY "documentId", "order" DESC, "createdAt" DESC
) AS latest_signature
WHERE d."id" = latest_signature."documentId";

ALTER TABLE "signatures" DROP COLUMN "documentHash";
ALTER TABLE "signatures" DROP COLUMN "blockchainTxHash";
