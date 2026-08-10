import { readFile, readdir } from 'node:fs/promises';

import { isGeneProbeData } from '../src/lib/commonDatabase.ts';
import { validateMasterDMRData, validateMdmaMasterData } from '../src/lib/scientificData.ts';

const publicData = new URL('../public/data/', import.meta.url);

async function json(url: URL): Promise<unknown> {
  return JSON.parse(await readFile(url, 'utf8')) as unknown;
}

async function validateProbeDirectory(relativeDirectory: string): Promise<number> {
  const directory = new URL(relativeDirectory, publicData);
  const filenames = (await readdir(directory)).filter(
    (filename) => filename.endsWith('.json') && !filename.startsWith('_'),
  );
  await Promise.all(filenames.map(async (filename) => {
    const gene = filename.slice(0, -'.json'.length);
    const value = await json(new URL(filename, directory));
    if (!isGeneProbeData(value, gene)) {
      throw new Error(`Invalid probe shard: ${relativeDirectory}${filename}`);
    }
  }));
  return filenames.length;
}

validateMasterDMRData(await json(new URL('dmrData.json', publicData)));
validateMdmaMasterData(await json(new URL('mdma/dmrData.json', publicData)));
const [ptsdProbeFiles, legacyTreatmentProbeFiles, treatmentVisitProbeFiles] = await Promise.all([
  validateProbeDirectory('probes/'),
  validateProbeDirectory('mdma/probes/'),
  validateProbeDirectory('mdma/treatment-probes/visits/'),
]);

console.log(`Validated both master datasets and ${ptsdProbeFiles + legacyTreatmentProbeFiles + treatmentVisitProbeFiles} probe shards, including ${treatmentVisitProbeFiles} Treatment Baseline/Follow-up shards with CPT healthy-control references.`);
