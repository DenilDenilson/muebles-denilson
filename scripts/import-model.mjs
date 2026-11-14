import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] ?? '../mueble-basura-cocina/output');
const target = resolve('public/models/basurero-doble');
const mesh = JSON.parse(await readFile(resolve(source, 'basurero-doble.mesh.json'), 'utf8'));
const step = await readFile(resolve(source, 'basurero-doble.step'));
if (createHash('sha256').update(step).digest('hex') !== mesh.sourceSha256) {
  throw new Error('La malla no corresponde al STEP. Regenera el modelo antes de importar.');
}
const verification = JSON.parse(await readFile(resolve(source, 'verification.json'), 'utf8'));
if (verification.status !== 'PASS') throw new Error('El modelo tiene interferencias pendientes.');
await mkdir(target, { recursive: true });
for (const file of ['basurero-doble.step', 'basurero-doble-abierto.step', 'basurero-doble.mesh.json', 'despiece-provisional.csv', 'verification.json', 'parameters.json']) {
  await copyFile(resolve(source, file), resolve(target, file));
}
console.log(`Importadas ${mesh.meshes.length} piezas desde STEP ${mesh.sourceSha256.slice(0, 12)} a ${target}`);
