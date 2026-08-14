/**
 * One-off backfill: encrypt the SMTP and IMAP passwords of credentials that
 * were stored before encryption at rest landed.
 *
 * Safe to re-run. Rows already carrying the `v1.` prefix are skipped, so a
 * second pass is a no-op rather than a double encryption.
 *
 *   pnpm --filter hyredfast-backend encrypt-credentials
 */

import "dotenv/config";
import { prisma } from "../services/prisma.service.js";
import { encryptSecret, isEncrypted } from "../utils/crypto.js";

async function main() {
  const credentials = await prisma.emailCredential.findMany({
    select: { id: true, username: true, password: true, imapPassword: true },
  });

  let encrypted = 0;
  let skipped = 0;

  for (const credential of credentials) {
    const needsPassword = credential.password && !isEncrypted(credential.password);
    const needsImap =
      credential.imapPassword && !isEncrypted(credential.imapPassword);

    if (!needsPassword && !needsImap) {
      skipped++;
      continue;
    }

    await prisma.emailCredential.update({
      where: { id: credential.id },
      data: {
        ...(needsPassword
          ? { password: encryptSecret(credential.password) }
          : {}),
        ...(needsImap
          ? { imapPassword: encryptSecret(credential.imapPassword) }
          : {}),
      },
    });

    encrypted++;
    console.log(`Encrypted credential ${credential.id} (${credential.username})`);
  }

  console.log(
    `Done. ${encrypted} credential(s) encrypted, ${skipped} already encrypted.`,
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
