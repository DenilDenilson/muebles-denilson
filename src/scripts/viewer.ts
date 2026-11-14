import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

type Category = 'carcass' | 'front' | 'support' | 'bin' | 'hardware' | 'context';
interface MeshData {
  name: string;
  category: Category;
  moving: boolean;
  color: string;
  positions: number[];
  indices: number[];
  explode: [number, number, number];
}
interface ModelData {
  schemaVersion: number;
  source: string;
  sourceSha256: string;
  units: string;
  pivot: [number, number, number];
  maxAngle: number;
  meshes: MeshData[];
}

function cadVector([x, y, z]: number[]) { return new THREE.Vector3(x / 1000 - 0.2, z / 1000, -y / 1000); }

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#bc966e'; ctx.fillRect(0, 0, 128, 512);
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 280; i++) {
    const x = random() * 128;
    ctx.strokeStyle = `rgba(${random() > 0.5 ? '86,53,28' : '238,209,163'},${0.025 + random() * 0.09})`;
    ctx.lineWidth = 0.25 + random() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + random() * 12, 170, x - random() * 10, 360, x + random() * 4, 512);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeLabel(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f2eb'; ctx.fillRect(10, 8, 364, 80);
  ctx.fillStyle = '#33473b'; ctx.font = '500 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 192, 49);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(0.115, 0.029, 1); sprite.renderOrder = 5;
  return sprite;
}

export async function initViewer(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('.canvas-stage')!;
  const loading = root.querySelector<HTMLElement>('.viewer-loading')!;
  const error = root.querySelector<HTMLElement>('.viewer-error')!;
  const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const range = query<HTMLInputElement>('#opening');
  const output = query<HTMLOutputElement>('#opening-value');
  const openButton = query<HTMLButtonElement>('[data-toggle-open]');
  let renderer: THREE.WebGLRenderer | undefined;
  let disposed = false;
  let controls: OrbitControls | undefined;
  let observer: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let animationFrame = 0;
  let visible = true;
  const abort = new AbortController();
  const listeners = { signal: abort.signal };
  let scene: THREE.Scene | undefined;
  const textures: THREE.Texture[] = [];
  let environment: THREE.WebGLRenderTarget | undefined;

  const fail = (reason: unknown) => {
    console.error('No se pudo cargar el modelo 3D:', reason);
    loading.hidden = true; error.hidden = false; root.dataset.state = 'error';
    root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.viewer-controls button, .viewer-controls input, .view-presets button, [data-reset]').forEach(el => el.disabled = true);
  };
  query<HTMLButtonElement>('[data-retry]').addEventListener('click', () => location.reload(), listeners);

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort(); observer?.disconnect(); visibilityObserver?.disconnect();
    cancelAnimationFrame(animationFrame); controls?.dispose();
    scene?.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
        if ('geometry' in object) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
          material.dispose();
        }
      }
    });
    textures.forEach(texture => texture.dispose()); environment?.dispose(); renderer?.dispose();
  };
  window.addEventListener('pagehide', () => { cleanup(); }, { once: true });

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
    const target = new THREE.Vector3(0, 0.33, -0.16);
    const presetPositions: Record<string, THREE.Vector3> = {
      perspective: new THREE.Vector3(0.92, 0.78, 1.06),
      front: new THREE.Vector3(0, 0.34, 1.35),
      top: new THREE.Vector3(0, 1.8, -0.159),
    };
    camera.position.copy(presetPositions.perspective);
    controls = new OrbitControls(camera, canvas);
    controls.target.copy(target); controls.enableDamping = true; controls.dampingFactor = 0.1;
    controls.minDistance = 0.55; controls.maxDistance = 3;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.enablePan = false;
    controls.update();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04); scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa4ad99, 2));
    const sun = new THREE.DirectionalLight(0xfff5e6, 3);
    sun.position.set(1.4, 2.5, 1.4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -1; sun.shadow.camera.right = 1;
    sun.shadow.camera.top = 1; sun.shadow.camera.bottom = -1;
    sun.shadow.normalBias = 0.015;
    sun.target.position.copy(target); scene.add(sun, sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: '#536047', opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; scene.add(ground);

    const response = await fetch(root.dataset.model!, { signal: abort.signal });
    if (!response.ok) throw new Error(`Modelo no disponible (${response.status})`);
    const data: ModelData = await response.json();
    if (data.schemaVersion !== 1 || data.units !== 'mm' || !data.meshes?.length) throw new Error('Formato de modelo no compatible');
    const pivot = cadVector(data.pivot);
    const movingGroup = new THREE.Group(); movingGroup.name = 'conjunto_basculante'; movingGroup.position.copy(pivot);
    const contextGroup = new THREE.Group(); contextGroup.name = 'referencia_desague'; contextGroup.visible = false;
    scene.add(movingGroup, contextGroup);
    const wood = woodTexture(); textures.push(wood);
    const meshes: { mesh: THREE.Mesh; rest: THREE.Vector3; explode: THREE.Vector3 }[] = [];
    let frontMaterial: THREE.MeshStandardMaterial | undefined;

    for (const part of data.meshes) {
      const vertices = new Float32Array(part.positions.length);
      const uvs = new Float32Array(part.positions.length / 3 * 2);
      for (let i = 0; i < part.positions.length; i += 3) {
        const v = cadVector(part.positions.slice(i, i + 3));
        if (part.moving) v.sub(pivot);
        vertices.set([v.x, v.y, v.z], i);
        uvs[i / 3 * 2] = part.positions[i] / 352;
        uvs[i / 3 * 2 + 1] = part.positions[i + 2] / 592;
      }
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      indexed.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      indexed.setIndex(part.indices);
      // Aristas nítidas en tableros y caras fieles al STEP.
      const geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: part.category === 'front' ? '#ffffff' : part.color,
        roughness: part.category === 'hardware' ? 0.32 : 0.73,
        metalness: part.category === 'hardware' ? 0.72 : 0,
        map: part.category === 'front' ? wood : null,
        transparent: part.category === 'context', opacity: part.category === 'context' ? 0.45 : 1,
      });
      if (part.category === 'front') frontMaterial = material;
      const mesh = new THREE.Mesh(geometry, material); mesh.name = part.name;
      mesh.castShadow = part.category !== 'context'; mesh.receiveShadow = part.category !== 'context';
      if (part.category === 'context') contextGroup.add(mesh);
      else if (part.moving) movingGroup.add(mesh);
      else scene.add(mesh);
      const explode = new THREE.Vector3(part.explode[0] / 1000, part.explode[2] / 1000, -part.explode[1] / 1000);
      meshes.push({ mesh, rest: mesh.position.clone(), explode });
    }

    const dimensions = new THREE.Group(); dimensions.visible = false; dimensions.name = 'cotas';
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#5a6d59', transparent: true, opacity: 0.65 });
    const dimension = (a: THREE.Vector3, b: THREE.Vector3, text: string, offset: THREE.Vector3) => {
      const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a, b]), lineMaterial);
      const label = makeLabel(text); label.position.copy(a.clone().add(b).multiplyScalar(0.5).add(offset));
      dimensions.add(line, label);
    };
    dimension(new THREE.Vector3(-0.197, 0.008, 0.1), new THREE.Vector3(0.197, 0.008, 0.1), '39,4 cm', new THREE.Vector3(0, -0.023, 0));
    dimension(new THREE.Vector3(0.25, 0.004, 0), new THREE.Vector3(0.25, 0.664, 0), '66 cm', new THREE.Vector3(0.035, 0, 0));
    dimension(new THREE.Vector3(-0.25, 0.008, -0.002), new THREE.Vector3(-0.25, 0.008, -0.480), '47,8 cm', new THREE.Vector3(-0.025, 0.02, 0));
    scene.add(dimensions);

    let angle = 22;
    let desiredAngle = angle;
    let exploded = 0;
    let desiredExploded = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = () => {
      animationFrame = 0;
      if (disposed || !visible) return;
      const lerp = reducedMotion ? 1 : 0.16;
      angle = THREE.MathUtils.lerp(angle, desiredAngle, lerp);
      exploded = THREE.MathUtils.lerp(exploded, desiredExploded, lerp);
      movingGroup.rotation.x = THREE.MathUtils.degToRad(angle);
      for (const { mesh, rest, explode } of meshes) mesh.position.copy(rest).addScaledVector(explode, exploded);
      const changed = controls!.update();
      renderer!.render(scene!, camera);
      if (changed || Math.abs(angle - desiredAngle) > 0.01 || Math.abs(exploded - desiredExploded) > 0.001) requestRender();
    };
    const requestRender = () => { if (!animationFrame && !disposed && visible) animationFrame = requestAnimationFrame(render); };
    controls.addEventListener('change', requestRender);

    const setOpening = (value: number) => {
      desiredAngle = Math.max(0, Math.min(data.maxAngle, value));
      range.value = String(desiredAngle); output.value = `${desiredAngle}°`;
      openButton.setAttribute('aria-pressed', String(desiredAngle > 0));
      openButton.setAttribute('aria-label', desiredAngle > 0 ? 'Cerrar mueble' : 'Abrir mueble');
      root.dataset.angle = String(desiredAngle); requestRender();
    };
    range.max = String(data.maxAngle);
    range.addEventListener('input', () => setOpening(Number(range.value)), listeners);
    openButton.addEventListener('click', () => setOpening(desiredAngle > 0 ? 0 : data.maxAngle), listeners);

    root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => {
      button.addEventListener('click', () => {
        controls!.target.copy(target); camera.position.copy(presetPositions[button.dataset.camera!]);
        root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(el => { el.classList.toggle('active', el === button); el.setAttribute('aria-pressed', String(el === button)); });
        root.dataset.camera = button.dataset.camera;
        controls!.update(); requestRender();
      }, listeners);
    });
    query<HTMLButtonElement>('[data-reset]').addEventListener('click', () => {
      query<HTMLButtonElement>('[data-camera="perspective"]').click(); setOpening(22);
      desiredExploded = 0; query('[data-explode]').setAttribute('aria-pressed', 'false');
      contextGroup.visible = dimensions.visible = false;
      query('[data-context]').setAttribute('aria-pressed', 'false'); query('[data-dimensions]').setAttribute('aria-pressed', 'false');
      root.dataset.exploded = 'false'; root.dataset.context = 'false'; root.dataset.dimensions = 'false'; requestRender();
    }, listeners);
    query<HTMLButtonElement>('[data-explode]').addEventListener('click', event => {
      desiredExploded = desiredExploded ? 0 : 1;
      (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(!!desiredExploded));
      root.dataset.exploded = String(!!desiredExploded); requestRender();
    }, listeners);
    for (const [selector, group, key] of [['[data-context]', contextGroup, 'context'], ['[data-dimensions]', dimensions, 'dimensions']] as const) {
      query<HTMLButtonElement>(selector).addEventListener('click', event => {
        group.visible = !group.visible;
        (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(group.visible));
        root.dataset[key] = String(group.visible); requestRender();
      }, listeners);
    }
    document.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach(button => {
      button.addEventListener('click', () => {
        const finish = button.dataset.finish!;
        document.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach(el => { el.classList.toggle('selected', el === button); el.setAttribute('aria-pressed', String(el === button)); });
        if (frontMaterial) {
          frontMaterial.map = finish === 'roble' ? wood : null;
          frontMaterial.color.set(finish === 'blanco' ? '#e9e5dc' : finish === 'grafito' ? '#454b45' : '#ffffff');
          frontMaterial.needsUpdate = true;
        }
        query('#finish-label').textContent = button.getAttribute('aria-label');
        root.dataset.finish = finish; requestRender();
      }, listeners);
    });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const delta = camera.position.clone().sub(controls!.target);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') delta.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? 0.12 : -0.12);
      else delta.multiplyScalar(event.key === 'ArrowUp' ? 0.92 : 1.08).clampLength(0.55, 3);
      camera.position.copy(controls!.target).add(delta); controls!.update(); requestRender();
    }, listeners);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(animationFrame); animationFrame = 0; fail('Se perdió el contexto WebGL.'); }, listeners);

    observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (!width || !height) return;
      renderer!.setSize(width, height, false); camera.aspect = width / height;
      camera.fov = width < 500 ? 44 : 35;
      camera.updateProjectionMatrix(); requestRender();
    });
    observer.observe(stage);
    visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) requestRender(); });
    visibilityObserver.observe(stage);
    setOpening(22); controls.update(); loading.hidden = true;
    root.dataset.state = 'ready'; root.dataset.meshes = String(data.meshes.length);
    root.dataset.sourceSha256 = data.sourceSha256;
    requestRender();
  } catch (reason) {
    if (!disposed) fail(reason);
  }
}
