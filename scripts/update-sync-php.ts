import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  getSessionPhysicalPath,
  ensureSessionDirectories,
  SYNC_INDEX_PHP_CONTENT,
} from '../src/lib/sftpgo';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Mise à jour sécurisée des index.php et dossiers SFTP pour chaque session ===');
  const sessions = await prisma.session.findMany({
    select: { id: true, name: true, slug: true },
  });

  console.log(`Nombre de sessions trouvées en base : ${sessions.length}`);

  for (const session of sessions) {
    try {
      console.log(`Traitement de la session : [${session.name}] (${session.slug})`);
      await ensureSessionDirectories(session.id);
      const sessionDir = getSessionPhysicalPath(session.id);
      const indexPhpPath = path.join(sessionDir, 'sync', 'index.php');

      // Vérification que le fichier existe
      await fs
        .writeFile(indexPhpPath, SYNC_INDEX_PHP_CONTENT, { encoding: 'utf8', mode: 0o444 })
        .catch(async (err) => {
          if (err.code === 'EACCES') {
            await fs.chmod(indexPhpPath, 0o644).catch(() => {});
            await fs.writeFile(indexPhpPath, SYNC_INDEX_PHP_CONTENT, 'utf8');
            await fs.chmod(indexPhpPath, 0o444).catch(() => {});
            await fs.chown(indexPhpPath, 1000, 1000).catch(() => {});
          } else {
            throw err;
          }
        });

      console.log(`  ✓ index.php mis à jour et dossiers mandatory/optional vérifiés`);
    } catch (err) {
      console.error(`  ✗ Erreur lors du traitement de ${session.slug}:`, err);
    }
  }

  console.log("=== Terminé avec succès ! Aucun fichier existant n'a été supprimé. ===");
}

main()
  .catch((e) => {
    console.error('Erreur générale :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
