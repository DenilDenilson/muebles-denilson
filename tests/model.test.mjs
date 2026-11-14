import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../public/models/basurero-doble/', import.meta.url);
const model = JSON.parse(await readFile(new URL('basurero-doble.mesh.json', root), 'utf8'));

test('la geometría publicada procede exactamente del STEP descargable', async () => {
  const step = await readFile(new URL(model.source, root));
  assert.match(step.toString('utf8', 0, 120), /ISO-10303-21/);
  assert.equal(createHash('sha256').update(step).digest('hex'), model.sourceSha256);
  assert.equal(model.units, 'mm');
});

test('los dos tachos están a lados distintos del tubo y dejan holgura nominal', () => {
  const bounds = part => {
    const x = part.positions.filter((_, i) => i % 3 === 0);
    return [Math.min(...x), Math.max(...x)];
  };
  const left = bounds(model.meshes.find(m => m.name === 'tacho_izquierdo'));
  const right = bounds(model.meshes.find(m => m.name === 'tacho_derecho'));
  const pipe = bounds(model.meshes.find(m => m.category === 'context'));
  assert.ok(left[1] <= pipe[0] - 3.9);
  assert.ok(right[0] > pipe[1]);
  assert.ok(Math.abs(left[1] - left[0] - 120) < 0.1);
});

test('todas las piezas contienen triángulos finitos y referencias válidas', () => {
  assert.equal(model.meshes.filter(m => m.category === 'bin').length, 2);
  assert.equal(new Set(model.meshes.map(m => m.name)).size, model.meshes.length);
  for (const mesh of model.meshes) {
    assert.ok(mesh.positions.length > 0);
    assert.equal(mesh.positions.length % 3, 0);
    assert.equal(mesh.indices.length % 3, 0);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
  }
});

test('el barrido CAD publicado no informa interferencias de 0° a 30°', async () => {
  const report = JSON.parse(await readFile(new URL('verification.json', root), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.range_degrees, [0, 30]);
  assert.equal(report.angle_step_degrees, 1);
  assert.deepEqual(report.collisions, []);
});
