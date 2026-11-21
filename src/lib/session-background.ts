import fs from 'fs/promises';
import path from 'path';

/** Only identical bytes identify an auto-provisioned default image. */
export async function isDefaultBackground(candidate: string): Promise<boolean> {
  const reference = path.join(process.cwd(), 'public', 'default-bg.jpg');
  try {
    const [candidateStat, referenceStat] = await Promise.all([
      fs.stat(candidate),
      fs.stat(reference),
    ]);
    if (
      !candidateStat.isFile() ||
      !referenceStat.isFile() ||
      candidateStat.size !== referenceStat.size
    )
      return false;
    const [actual, expected] = await Promise.all([fs.readFile(candidate), fs.readFile(reference)]);
    return actual.equals(expected);
  } catch {
    return false;
  }
}
