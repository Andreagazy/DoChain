-- IPFS is only used for the final document, not per-signature snapshots.
ALTER TABLE "signatures" DROP COLUMN "signedFileIpfsHash";
