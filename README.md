# Muebles Denilson

Catálogo de muebles a medida, construido con Astro, pnpm y Three.js. Sitio: https://muebles.denil.org.

## Desarrollo

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
pnpm exec playwright test
```

Node 24 y pnpm 10.33. El build es estático (`dist/`). `pnpm build` incluye comprobación de tipos.

## Separación de responsabilidades

- **Diseño CAD:** proyecto independiente `../mueble-basura-cocina`, Python con uv y build123d. Conserva parámetros, construcción de sólidos, STEP e informe de interferencias.
- **Este repositorio:** catálogo, interacción Three.js y copias publicadas de los modelos. El navegador no necesita Python ni un servidor CAD.
- **Conversión:** el generador CAD reimporta el STEP y triangula sus sólidos. El JSON conserva sus nombres, grupos móviles y SHA-256 del STEP original. El visor transforma de mm a metros y de Z vertical a Y vertical; no reconstruye el mueble con primitivas de JavaScript.

Para publicar una revisión del mueble:

```sh
# Dentro del proyecto CAD:
uv run python model.py
# Dentro de este repositorio:
pnpm import:model ../mueble-basura-cocina/output
pnpm test
pnpm build
```

La importación rechaza un SHA incorrecto o un informe CAD con interferencias. Ambos artefactos se versionan juntos.

## Añadir muebles

Agregar un registro en `src/data/furniture.ts` y sus archivos en `public/models/<slug>/`. Astro crea `/muebles/<slug>/` a partir del catálogo. El componente de vista espera la versión 1 del esquema de malla, en mm, con piezas etiquetadas, categoría, movimiento y eje de giro. Actualmente el mueble destacado es el primero de la lista.

## Publicación

Vercel con repositorio GitHub conectado, rama de producción `main`, instalación `pnpm install --frozen-lockfile`, build `pnpm build`, salida `dist/`. `vercel.json` mantiene la configuración junto al código. Cloudflare gestiona exclusivamente el CNAME `muebles.denil.org`; el destino debe ser el recomendado por Vercel para el proyecto, sin proxy.

## Estado del primer diseño

Anteproyecto de melamina de 18 mm. Tachitos RYBIU NA35873 aproximados a 120×300×315 mm y desagüe modelado por envolvente. El cuerpo mide 394×478×660 mm; el tirador sobresale 12 mm. Confirmar dimensiones físicas, poza, tapacantos, herrajes, brazos limitadores, anclaje y humedad antes de fabricar. La vista de despiece es ilustrativa y no una secuencia de ensamblaje.

## Controles

Arrastrar: girar. Rueda o pellizco: acercar. Flechas del teclado con el lienzo enfocado: girar o acercar. Selector de apertura 0–30°, vistas predefinidas, acabados del frente, despiece, referencia del desagüe y cotas. Render bajo demanda, límite de densidad de píxeles, suspensión fuera de pantalla y respeto de movimiento reducido.
