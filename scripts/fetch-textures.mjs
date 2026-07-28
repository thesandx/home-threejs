/**
 * Download and process the PBR texture sets used by the walkthrough.
 *
 * Sources are CC0 material scans from ambientCG. The raw 1K sets are far larger
 * than this project needs (a single normal map is ~2 MB), so each map is
 * resized and re-encoded before it lands in `public/textures/`:
 *
 *   - colour maps      → 1024px JPEG (quality 82)
 *   - normal maps      → 1024px JPEG (quality 88, they suffer more from
 *                        compression than colour does)
 *   - roughness maps   → 512px greyscale JPEG — roughness carries far less
 *                        high-frequency information, so half resolution is
 *                        indistinguishable and halves the payload again
 *
 * Run with `pnpm textures:fetch`. The output is committed, so this only needs
 * running when a material changes.
 *
 * Licence: every set below is CC0 (public domain). See public/textures/CREDITS.md.
 */

import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import sharp from 'sharp';

const run = promisify(execFile);

/** ambientCG asset id → the name this project uses for it. */
const MATERIALS = [
  { id: 'Plaster001', name: 'render' }, // facade render / stucco
  { id: 'Bricks075A', name: 'wall' }, // neighbouring masonry
  { id: 'WoodFloor043', name: 'teak' }, // cladding, louvres, soffits
  { id: 'PavingStones131', name: 'paving' }, // forecourt and driveway
  { id: 'Concrete034', name: 'concrete' }, // kerb, street, plinths
  { id: 'Marble016', name: 'marble' }, // interior floors
  { id: 'Grass004', name: 'grass' }, // lawn
];

const OUT = path.resolve('public/textures');
const TMP = path.resolve('.texture-cache');

/** Pick the right file out of an extracted ambientCG set. */
function pick(files, suffix) {
  return files.find((f) => f.endsWith(`_${suffix}.jpg`) || f.endsWith(`_${suffix}.png`));
}

async function processMaterial({ id, name }) {
  const zip = path.join(TMP, `${id}.zip`);
  const dir = path.join(TMP, id);
  const url = `https://ambientcg.com/get?file=${id}_1K-JPG.zip`;

  process.stdout.write(`· ${id} → ${name}\n`);
  await run('curl', ['-sL', '--max-time', '300', url, '-o', zip]);
  await mkdir(dir, { recursive: true });
  await run('unzip', ['-o', '-q', zip, '-d', dir]);

  const files = await readdir(dir);
  const color = pick(files, 'Color');
  const normal = pick(files, 'NormalGL');
  const rough = pick(files, 'Roughness');
  if (!color) throw new Error(`${id}: no colour map in the downloaded set`);

  await sharp(path.join(dir, color))
    .resize(1024, 1024, { fit: 'fill' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT, `${name}_color.jpg`));

  if (normal) {
    await sharp(path.join(dir, normal))
      .resize(1024, 1024, { fit: 'fill' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(OUT, `${name}_normal.jpg`));
  }
  if (rough) {
    await sharp(path.join(dir, rough))
      .resize(512, 512, { fit: 'fill' })
      .greyscale()
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT, `${name}_rough.jpg`));
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(TMP, { recursive: true });
  for (const material of MATERIALS) {
    await processMaterial(material);
  }
  const credits = [
    '# Texture credits',
    '',
    'Every texture in this folder is a CC0 (public domain) material scan from',
    '[ambientCG](https://ambientcg.com). No attribution is required; it is recorded',
    'here so the provenance of the assets stays clear.',
    '',
    'Regenerate with `pnpm textures:fetch` — see `scripts/fetch-textures.mjs` for the',
    'resize and re-encode settings.',
    '',
    '| File prefix | ambientCG asset | Used for |',
    '| ----------- | --------------- | -------- |',
    ...MATERIALS.map((m) => `| \`${m.name}_\` | ${m.id} | ${describe(m.name)} |`),
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'CREDITS.md'), credits, 'utf8');
  await rm(TMP, { recursive: true, force: true });
  process.stdout.write('done\n');
}

function describe(name) {
  return (
    {
      render: 'Facade render and boundary walls',
      wall: 'Neighbouring masonry',
      teak: 'Cladding, louvres and balcony soffits',
      paving: 'Forecourt and driveway',
      concrete: 'Kerb, street and plinths',
      marble: 'Interior floors',
      grass: 'Lawn',
    }[name] ?? name
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
