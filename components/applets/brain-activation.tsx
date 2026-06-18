"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  useAppletTheme,
  usePrefersReducedMotion,
  useContainerSize,
} from "@/components/applets/use-applet-theme";
import type { AppletTheme } from "@/components/applets/use-applet-theme";

// ═══════════════════════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════════════════════

interface ConceptAssignment {
  sentence: string;
  highlightedWords: string[];
  labels: string[];
  regionIndices: number[];
}

type Lang = "pt" | "en";

const EXAMPLES_PT: ConceptAssignment[] = [
  {
    sentence: "João comeu pão",
    highlightedWords: ["João", "comeu", "pão"],
    labels: ["João", "comeu", "pão"],
    regionIndices: [0, 3, 4],
  },
  {
    sentence: "O gato dormiu",
    highlightedWords: ["gato", "dormiu"],
    labels: ["gato", "dormiu"],
    regionIndices: [1, 5],
  },
  {
    sentence: "Ela leu o livro",
    highlightedWords: ["Ela", "leu", "livro"],
    labels: ["Ela", "leu", "livro"],
    regionIndices: [2, 0, 1],
  },
  {
    sentence: "Chove lá fora",
    highlightedWords: ["Chove", "lá", "fora"],
    labels: ["Chove", "lá", "fora"],
    regionIndices: [4, 5, 3],
  },
];

// English mirror — same region indices so the activation pattern is identical.
const EXAMPLES_EN: ConceptAssignment[] = [
  {
    sentence: "John ate bread",
    highlightedWords: ["John", "ate", "bread"],
    labels: ["John", "ate", "bread"],
    regionIndices: [0, 3, 4],
  },
  {
    sentence: "The cat slept",
    highlightedWords: ["cat", "slept"],
    labels: ["cat", "slept"],
    regionIndices: [1, 5],
  },
  {
    sentence: "She read the book",
    highlightedWords: ["She", "read", "book"],
    labels: ["She", "read", "book"],
    regionIndices: [2, 0, 1],
  },
  {
    sentence: "It rains outside",
    highlightedWords: ["rains", "outside"],
    labels: ["rains", "outside"],
    regionIndices: [4, 3],
  },
];

const EXAMPLES_BY_LANG: Record<Lang, ConceptAssignment[]> = {
  pt: EXAMPLES_PT,
  en: EXAMPLES_EN,
};

// 6 region anchors positioned ON the cerebrum surface (final brain space).
// Each lights up a whole lobe; labels project from these points.
const REGION_CENTERS: THREE.Vector3[] = [
  new THREE.Vector3(-0.5, 0.5, 1.0),     // 0 – left frontal
  new THREE.Vector3(0.5, 0.5, 1.0),      // 1 – right frontal
  new THREE.Vector3(-0.95, -0.22, 0.35), // 2 – left temporal
  new THREE.Vector3(0.95, -0.22, 0.35),  // 3 – right temporal
  new THREE.Vector3(-0.45, 0.55, -0.95), // 4 – left parietal/occipital
  new THREE.Vector3(0.45, 0.55, -0.95),  // 5 – right parietal/occipital
];
// How far a region's glow spreads across the surface (world units).
const REGION_RADIUS = 0.82;

const ACCENT_KEYS: (keyof AppletTheme)[] = [
  "green", "aqua", "red", "yellow", "orange", "purple",
];

const CYCLE_INTERVAL_MS = 4200;
const TRANSITION_DURATION_MS = 750;
const ROTATION_SPEED = 0.0022;
const PULSE_SPEED = 2.6;
const PULSE_AMPLITUDE = 0.22;
const NODE_COUNT = 1100;
const CONNECTIONS_PER_NODE = 5;   // denser web — connections are the focus
const EDGE_MAX_DIST = 0.62;       // reach across the interior, not just surface

// ═══════════════════════════════════════════════════════════════════════════════
// Brain shape generation
// ═══════════════════════════════════════════════════════════════════════════════

function hash3D(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1442968193;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483648;
}

function smoothstep01(s: number): number {
  const x = Math.max(0, Math.min(1, s));
  return x * x * (3 - 2 * x);
}

interface BrainData {
  positions: Float32Array;
  regionOf: Int8Array;       // -1 = none, else region index
  regionStrength: Float32Array; // base activation 0..1 (falloff from anchor)
  baseSize: Float32Array;    // per-node base point size (world units)
  nodeAct: Float32Array;     // scratch: per-node activation this frame
}

// Build an anatomically-suggestive brain: cerebrum (two hemispheres split by a
// sagittal fissure, tapered frontal pole, temporal lobes hanging on the sides),
// a foliated cerebellum bump at the lower back, and a tapered brainstem.
function generateBrain(total: number): BrainData {
  const cerebrumCount = Math.floor(total * 0.78);
  const cerebellumCount = Math.floor(total * 0.14);
  const brainstemCount = total - cerebrumCount - cerebellumCount;

  const positions = new Float32Array(total * 3);
  const regionOf = new Int8Array(total).fill(-1);
  const regionStrength = new Float32Array(total);
  const baseSize = new Float32Array(total);

  const GA = Math.PI * (1 + Math.sqrt(5)); // golden angle
  let w = 0;

  // ── Cerebrum ──────────────────────────────────────────────────────────────
  for (let i = 0; i < cerebrumCount; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / cerebrumCount);
    const theta = GA * i;
    const ux = Math.sin(phi) * Math.cos(theta);
    const uy = Math.cos(phi);
    const uz = Math.sin(phi) * Math.sin(theta);

    let x = ux * 1.12;
    let y = uy * 0.86;
    let z = uz * 1.3;

    // Frontal pole (front = +z) tapers narrower and lower
    const front = Math.max(0, uz);
    x *= 1 - 0.16 * front * front;
    y *= 1 - 0.05 * front * front;
    // Occipital pole (back = -z) slims slightly
    const back = Math.max(0, -uz);
    x *= 1 - 0.05 * back * back;

    // Flatten the underside of the cerebrum (sits over cerebellum/stem)
    if (uy < 0) y *= 0.62;

    // Temporal lobes: lateral-bottom bulge hanging down and forward
    const lat = Math.max(0, Math.abs(ux) - 0.15);
    const low = Math.max(0, -uy);
    const temporal = lat * low;
    y -= temporal * 0.5;
    x += Math.sign(ux) * temporal * 0.18;
    z += temporal * 0.22;

    // Sagittal fissure: longitudinal dip at x≈0 along the top
    const top = Math.max(0, uy);
    const fissure = Math.exp(-(x * x) / 0.045) * top;
    y -= fissure * 0.2;
    x += (x >= 0 ? 1 : -1) * fissure * 0.05;

    // Gyrification (cortical folding) noise
    const ns = 5.0;
    const n1 = hash3D(x * ns, y * ns, z * ns);
    const n2 = hash3D(x * ns * 2.1, y * ns * 2.1, z * ns * 2.1) * 0.5;
    const noise = ((n1 + n2) / 1.5) * 0.09 - 0.03;
    const len = Math.hypot(x, y, z) || 1;
    const sc = (len + noise) / len;
    x *= sc; y *= sc; z *= sc;

    // Volume fill: push a share of nodes INWARD so connections run through the
    // interior, not just along the surface. Half stay in the outer shell to keep
    // the brain silhouette crisp; the rest fill the volume toward the center.
    // Assign the region from the SURFACE point (before pushing inward) so a lit
    // region is a whole column through the brain — surface and interior nodes of
    // that lobe both activate, and the connections crossing it glow too.
    const surfX = x, surfY = y + 0.12, surfZ = z;
    let bestR = -1;
    let bestStrength = 0;
    for (let r = 0; r < REGION_CENTERS.length; r++) {
      const c = REGION_CENTERS[r];
      const d = Math.hypot(surfX - c.x, surfY - c.y, surfZ - c.z);
      if (d < REGION_RADIUS) {
        const st = smoothstep01(1 - d / REGION_RADIUS);
        if (st > bestStrength) {
          bestStrength = st;
          bestR = r;
        }
      }
    }

    const hr = hash3D(i * 1.7 + 3.1, i * 0.9 + 1.3, i * 2.3 + 0.7);
    let rho: number;
    if (hr < 0.45) {
      rho = 0.86 + 0.14 * hash3D(i * 3.7, 5.1, i * 1.1); // outer shell
    } else {
      rho = 0.32 + 0.56 * hash3D(i * 2.9, i * 1.7 + 2.0, 4.3); // interior
    }
    x *= rho; y *= rho; z *= rho;

    // Lift cerebrum so the cerebellum/stem sit clearly below
    y += 0.12;

    positions[w * 3] = x;
    positions[w * 3 + 1] = y;
    positions[w * 3 + 2] = z;
    baseSize[w] = 0.018;

    regionOf[w] = bestR;
    regionStrength[w] = bestStrength;
    w++;
  }

  // ── Cerebellum (foliated, two lobes via a vermis gap) — small, tucked under
  //    the back of the cerebrum ───────────────────────────────────────────────
  const cbx = 0;
  const cby = -0.28;
  const cbz = -0.62;
  for (let i = 0; i < cerebellumCount; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / cerebellumCount);
    const theta = GA * i;
    const ux = Math.sin(phi) * Math.cos(theta);
    const uy = Math.cos(phi);
    const uz = Math.sin(phi) * Math.sin(theta);

    let x = ux * 0.36;
    let y = uy * 0.24;
    let z = uz * 0.3;

    // Vermis gap: push points away from the x≈0 midline → two lobes
    x += (x >= 0 ? 1 : -1) * Math.exp(-(x * x) / 0.012) * 0.04;
    // Foliation banding: ripple the radius by latitude
    const band = 0.03 * Math.sin(uy * 26);
    const len = Math.hypot(x, y, z) || 1;
    const fol = (len + band) / len;
    x *= fol; y *= fol; z *= fol;
    // Fine surface noise
    const n = (hash3D(x * 9, y * 9, z * 9) - 0.5) * 0.04;
    const len2 = Math.hypot(x, y, z) || 1;
    const s2 = (len2 + n) / len2;

    positions[w * 3] = x * s2 + cbx;
    positions[w * 3 + 1] = y * s2 + cby;
    positions[w * 3 + 2] = z * s2 + cbz;
    baseSize[w] = 0.015;
    regionOf[w] = -1;
    regionStrength[w] = 0;
    w++;
  }

  // ── Brainstem (tapered column descending from the base) ───────────────────
  const yTop = -0.3;
  const yBot = -1.18;
  for (let i = 0; i < brainstemCount; i++) {
    const tt = i / Math.max(1, brainstemCount - 1); // 0 top → 1 bottom
    const ang = GA * i;
    const radius = 0.17 * (1 - 0.45 * tt);
    const rr = radius * Math.sqrt(((i % 7) + 0.5) / 7); // fill the cross-section
    const y = yTop + (yBot - yTop) * tt;
    const z = -0.32 + tt * 0.16;
    positions[w * 3] = Math.cos(ang) * rr;
    positions[w * 3 + 1] = y + (hash3D(i, i * 2, i * 3) - 0.5) * 0.03;
    positions[w * 3 + 2] = z + Math.sin(ang) * rr * 0.7;
    baseSize[w] = 0.017;
    regionOf[w] = -1;
    regionStrength[w] = 0;
    w++;
  }

  return { positions, regionOf, regionStrength, baseSize, nodeAct: new Float32Array(total) };
}

interface EdgeData {
  positions: Float32Array;   // 2 verts per edge, 3 floats per vert
  edgeNodes: Int32Array;     // 2 node indices per edge (for region coloring)
}

function buildWireframeEdges(positions: Float32Array, k: number, maxDist: number): EdgeData {
  const pointCount = positions.length / 3;
  const cellSize = maxDist;
  const grid = new Map<string, number[]>();

  for (let i = 0; i < pointCount; i++) {
    const cx = Math.floor(positions[i * 3] / cellSize);
    const cy = Math.floor(positions[i * 3 + 1] / cellSize);
    const cz = Math.floor(positions[i * 3 + 2] / cellSize);
    const key = `${cx},${cy},${cz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  }

  const edgeA: number[] = [];
  const edgeB: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const cx = Math.floor(px / cellSize);
    const cy = Math.floor(py / cellSize);
    const cz = Math.floor(pz / cellSize);

    const neighbors: { idx: number; dist: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!cell) continue;
          for (const j of cell) {
            if (j <= i) continue;
            const ddx = positions[j * 3] - px;
            const ddy = positions[j * 3 + 1] - py;
            const ddz = positions[j * 3 + 2] - pz;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
            if (dist < maxDist) neighbors.push({ idx: j, dist });
          }
        }
      }
    }
    neighbors.sort((a, b) => a.dist - b.dist);
    for (const n of neighbors.slice(0, k)) {
      edgeA.push(i);
      edgeB.push(n.idx);
    }
  }

  const edgeCount = edgeA.length;
  const result = new Float32Array(edgeCount * 6);
  const edgeNodes = new Int32Array(edgeCount * 2);
  for (let e = 0; e < edgeCount; e++) {
    const a = edgeA[e];
    const b = edgeB[e];
    result[e * 6] = positions[a * 3];
    result[e * 6 + 1] = positions[a * 3 + 1];
    result[e * 6 + 2] = positions[a * 3 + 2];
    result[e * 6 + 3] = positions[b * 3];
    result[e * 6 + 4] = positions[b * 3 + 1];
    result[e * 6 + 5] = positions[b * 3 + 2];
    edgeNodes[e * 2] = a;
    edgeNodes[e * 2 + 1] = b;
  }
  return { positions: result, edgeNodes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function toThreeColor(css: string | undefined, fallback: string): THREE.Color {
  if (!css) return new THREE.Color(fallback);
  try {
    return new THREE.Color(css);
  } catch {
    return new THREE.Color(fallback);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function BrainActivation({ lang = "pt" }: { lang?: Lang }) {
  const theme = useAppletTheme();
  const reducedMotion = usePrefersReducedMotion();
  const { ref: containerRef, size } = useContainerSize<HTMLDivElement>();

  // Active example set for the chosen language (PT default). Stable per mount.
  const EXAMPLES = EXAMPLES_BY_LANG[lang];

  // ── React state for rendering (not read by the rAF loop) ──────────────────
  const [labelPositions, setLabelPositions] = useState<
    { x: number; y: number; label: string; color: string; opacity: number }[]
  >([]);
  const [sentenceState, setSentenceState] = useState<{
    currentIdx: number;
    nextIdx: number | null;
    progress: number;
  }>({ currentIdx: 0, nextIdx: null, progress: 0 });
  const [ready, setReady] = useState(false);

  // ── Refs for mutable state read/written by the rAF loop ───────────────────
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const brainGroupRef = useRef<THREE.Group | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const wiresRef = useRef<THREE.LineSegments | null>(null);
  const edgeNodesRef = useRef<Int32Array | null>(null);
  const brainDataRef = useRef<BrainData | null>(null);
  const rafIdRef = useRef(0);
  const timeRef = useRef(0);
  const reducedMotionRenderedRef = useRef(false);
  const sceneInitializedRef = useRef(false);

  // Mutable animation state (refs so the loop never restarts)
  const animStateRef = useRef({
    exampleIndex: 0,
    nextExampleIndex: null as number | null,
    isTransitioning: false,
    transitionProgress: 0,
    transitionStart: 0,
    theme: null as AppletTheme | null,
  });

  // Keep animState.theme in sync
  useEffect(() => {
    animStateRef.current.theme = theme;
  }, [theme]);

  // ── Three.js scene setup ──────────────────────────────────────────────────

  const setupScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount || sceneInitializedRef.current) return;
    if (size.width === 0 || size.height === 0) return; // wait for first size measurement

    sceneInitializedRef.current = true;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = size.width / Math.max(size.height, 1);
    const camera = new THREE.PerspectiveCamera(
      38,
      aspect,
      0.1,
      20,
    );
    // Push camera back on narrow viewports so the brain always fits horizontally.
    const fitZ = aspect < 1 ? (5.4 * 1.05) / aspect : 5.4;
    camera.position.set(0, 0.25, fitZ);
    camera.lookAt(0, -0.05, 0);
    cameraRef.current = camera;

    const brainGroup = new THREE.Group();
    scene.add(brainGroup);
    brainGroupRef.current = brainGroup;

    // Point cloud — per-node size + color via a tiny shader so whole regions
    // can visibly swell and glow when active (not just a faint tint).
    const brain = generateBrain(NODE_COUNT);
    const pointPositions = brain.positions;
    brainDataRef.current = brain;

    const pointGeom = new THREE.BufferGeometry();
    pointGeom.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    const colors = new Float32Array(NODE_COUNT * 3);
    pointGeom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const sizes = new Float32Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) sizes[i] = brain.baseSize[i];
    pointGeom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const pointMat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1 },         // px-per-world-unit scale (set on resize)
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uScale;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale * uPixelRatio / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          // soft round sprite
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = dot(d, d);
          if (r > 0.25) discard;
          float alpha = smoothstep(0.25, 0.02, r);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });
    const points = new THREE.Points(pointGeom, pointMat);
    points.frustumCulled = false;
    brainGroup.add(points);
    pointsRef.current = points;

    // Wireframe — THE FOCUS. Per-vertex colored so connections crossing an
    // active region glow in that region's accent color. Built with more
    // neighbors and longer reach so the web threads through the interior.
    const edgeData = buildWireframeEdges(pointPositions, CONNECTIONS_PER_NODE, EDGE_MAX_DIST);
    edgeNodesRef.current = edgeData.edgeNodes;
    const wireGeom = new THREE.BufferGeometry();
    wireGeom.setAttribute("position", new THREE.BufferAttribute(edgeData.positions, 3));
    const edgeVertCount = edgeData.positions.length / 3;
    wireGeom.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(edgeVertCount * 3), 3),
    );
    // Per-vertex alpha so idle edges can be a light tint at ~50% while active
    // edges stay near-opaque — LineBasicMaterial can't vary alpha per vertex.
    wireGeom.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(new Float32Array(edgeVertCount), 1),
    );
    const wireMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
    });
    // ShaderMaterial needs vertexColors flag for the built-in `color` attribute.
    wireMat.vertexColors = true;
    const wires = new THREE.LineSegments(wireGeom, wireMat);
    wires.frustumCulled = false;
    brainGroup.add(wires);
    wiresRef.current = wires;

    // Map world-unit point sizes to pixels: size_px = aSize * uScale / -z
    const fovRad = (camera.fov * Math.PI) / 180;
    const uScale = size.height / (2 * Math.tan(fovRad / 2));
    (pointMat.uniforms.uScale as { value: number }).value = uScale;
  }, [size.width, size.height]); // still needs initial size for renderer/camera

  useEffect(() => {
    setupScene();
  }, [setupScene]);

  // ── Apply theme to materials ──────────────────────────────────────────────

  useEffect(() => {
    if (!theme) return;
    const wireMat = wiresRef.current?.material as THREE.LineBasicMaterial | undefined;
    if (wireMat) {
      // Edges are vertex-colored per frame; just tune overall presence by mode.
      wireMat.opacity = theme.mode === "dark" ? 0.6 : 0.5;
    }
  }, [theme]);

  // ── Label projection (called from rAF loop, throttled setState) ──────────

  const lastLabelStrRef = useRef("");

  const projectLabels = useCallback(() => {
    const camera = cameraRef.current;
    const brainGroup = brainGroupRef.current;
    const container = mountRef.current;
    const t = animStateRef.current.theme;
    if (!camera || !brainGroup || !container || !t) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const state = animStateRef.current;
    const example = EXAMPLES[state.exampleIndex];
    const nextExample = state.nextExampleIndex != null ? EXAMPLES[state.nextExampleIndex] : null;
    const progress = state.transitionProgress;

    const activeMap = new Map<
      number,
      { label: string; color: string; strength: number }
    >();

    const addRegion = (
      ri: number,
      label: string,
      accentIdx: number,
      strength: number,
    ) => {
      const accentKey = ACCENT_KEYS[accentIdx % ACCENT_KEYS.length];
      const color = t[accentKey] ?? t.foreground;
      const existing = activeMap.get(ri);
      if (!existing || strength > existing.strength) {
        activeMap.set(ri, { label, color, strength });
      }
    };

    for (let i = 0; i < example.labels.length; i++) {
      const ri = example.regionIndices[i];
      const s = nextExample ? 1 - progress : 1;
      addRegion(ri, example.labels[i], ri, s);
    }
    if (nextExample) {
      for (let i = 0; i < nextExample.labels.length; i++) {
        const ri = nextExample.regionIndices[i];
        addRegion(ri, nextExample.labels[i], ri, progress);
      }
    }

    const tmpVec = new THREE.Vector3();
    const screenPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const brainWorldPos = new THREE.Vector3();
    brainGroup.getWorldPosition(brainWorldPos);

    const labels: { x: number; y: number; label: string; color: string; opacity: number }[] = [];

    for (const [regionIdx, info] of activeMap) {
      if (info.strength < 0.05) continue;
      const center = REGION_CENTERS[regionIdx];
      tmpVec.copy(center);
      brainGroup.localToWorld(tmpVec);
      screenPos.copy(tmpVec).project(camera);
      if (screenPos.z > 1) continue;

      const px = (screenPos.x * 0.5 + 0.5) * rect.width;
      const py = (-screenPos.y * 0.5 + 0.5) * rect.height;

      const fromBrain = tmpVec.clone().sub(brainWorldPos).normalize();
      const facing = fromBrain.dot(camDir);
      const visible = facing > -0.25;
      const opacity = visible
        ? Math.min(info.strength, 1)
        : Math.max(0, info.strength - 0.6);

      labels.push({ x: px, y: py, label: info.label, color: info.color, opacity });
    }

    // Throttle setState by comparing serialized form
    const str = JSON.stringify(labels.map((l) => [l.x.toFixed(1), l.y.toFixed(1), l.label, l.opacity.toFixed(2)]));
    if (str !== lastLabelStrRef.current) {
      lastLabelStrRef.current = str;
      setLabelPositions(labels);
    }
  }, []);

  // ── Animation loop (stable callback — reads state from refs) ─────────────

  const animate = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const brainGroup = brainGroupRef.current;
    const points = pointsRef.current;

    if (!scene || !camera || !renderer || !brainGroup || !points) {
      rafIdRef.current = requestAnimationFrame(animate);
      return;
    }

    const t = animStateRef.current.theme;
    const now = performance.now() * 0.001;
    timeRef.current = now;

    // Update transition progress
    let progress = animStateRef.current.transitionProgress;
    if (animStateRef.current.isTransitioning) {
      const elapsed = (now - animStateRef.current.transitionStart) * 1000;
      const raw = Math.min(elapsed / TRANSITION_DURATION_MS, 1);
      progress = easeInOutQuad(raw);
      animStateRef.current.transitionProgress = progress;

      if (raw >= 1) {
        // Complete transition
        animStateRef.current.isTransitioning = false;
        animStateRef.current.transitionProgress = 0;
        animStateRef.current.exampleIndex = animStateRef.current.nextExampleIndex!;
        animStateRef.current.nextExampleIndex = null;
        progress = 0;
        // Push to React for sentence rendering
        setSentenceState({
          currentIdx: animStateRef.current.exampleIndex,
          nextIdx: null,
          progress: 0,
        });
      } else {
        // Push progress to React
        setSentenceState((prev) => ({
          ...prev,
          progress,
        }));
      }
    }

    // Rotation
    if (!reducedMotion) {
      brainGroup.rotation.y += ROTATION_SPEED;
      brainGroup.rotation.x = Math.sin(now * 0.3) * 0.08;
      brainGroup.rotation.z = Math.cos(now * 0.25) * 0.04;
    }

    // Update node colors + sizes, then edge colors (connections are the focus)
    const brainData = brainDataRef.current;
    const edgeNodes = edgeNodesRef.current;
    if (t && brainData) {
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const sizeAttr = points.geometry.getAttribute("aSize") as THREE.BufferAttribute;
      const pointCount = colorAttr.count;

      // Idle node/edge color — a light grey tint. Edges use ~20% alpha so the
      // resting web is a faint structure; idle nodes use a pre-dimmed grey
      // (the point shader has no per-node alpha) so they don't dominate.
      const idleNode = new THREE.Color(
        t.mode === "dark" ? "#566066" : "#9aa090",
      );
      const idleEdge = new THREE.Color(
        t.mode === "dark" ? "#e0dede" : "#a8ad9c",
      );
      const idleEdgeAlpha = t.mode === "dark" ? 0.1 : 0.22;

      const regionColors = REGION_CENTERS.map(
        (_, i) => toThreeColor(t[ACCENT_KEYS[i % ACCENT_KEYS.length]], "#ffffff"),
      );

      // Per-region activation level this frame (0..1), ramped by transition.
      const curRegions = EXAMPLES[animStateRef.current.exampleIndex].regionIndices;
      const nextRegions =
        animStateRef.current.nextExampleIndex != null
          ? EXAMPLES[animStateRef.current.nextExampleIndex].regionIndices
          : null;
      const regionLevel = new Float32Array(REGION_CENTERS.length);
      for (const ri of curRegions) regionLevel[ri] = nextRegions ? 1 - progress : 1;
      if (nextRegions) {
        for (const ri of nextRegions) regionLevel[ri] = Math.max(regionLevel[ri], progress);
      }

      // Per-node activation + color index, reused for edge coloring.
      const nodeAct = brainData.nodeAct;
      const finalColor = new THREE.Color();
      for (let i = 0; i < pointCount; i++) {
        const ri = brainData.regionOf[i];
        const base = brainData.baseSize[i];

        let act = 0;
        if (ri >= 0) act = brainData.regionStrength[i] * regionLevel[ri];
        nodeAct[i] = act;

        if (act < 0.01) {
          finalColor.copy(idleNode);
          colorAttr.setXYZ(i, finalColor.r, finalColor.g, finalColor.b);
          sizeAttr.setX(i, base * 0.7); // idle nodes are physically smaller too
          continue;
        }

        const pulse = reducedMotion
          ? 1
          : 1 + Math.sin(now * PULSE_SPEED + i * 0.25) * PULSE_AMPLITUDE * act;

        // Start from the PURE accent color. With normal blending colors no
        // longer sum to white, so a near-1.0 multiply keeps them vivid and
        // saturated (the concept's real color) instead of washing out.
        finalColor.copy(regionColors[ri]).multiplyScalar(Math.min(0.7 + act * 0.55, 1.25) * pulse);
        colorAttr.setXYZ(i, finalColor.r, finalColor.g, finalColor.b);
        // Active nodes swell so the lit region reads at a glance
        sizeAttr.setX(i, base * (1 + act * 1.8 * pulse));
      }
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      // ── Edge colors + alpha: connections glow when an endpoint is active ────
      if (edgeNodes && wiresRef.current) {
        const wireGeo = wiresRef.current.geometry;
        const wireColor = wireGeo.getAttribute("color") as THREE.BufferAttribute;
        const wireAlpha = wireGeo.getAttribute("aAlpha") as THREE.BufferAttribute;
        const edgeCount = edgeNodes.length / 2;
        const ec = new THREE.Color();
        for (let e = 0; e < edgeCount; e++) {
          const a = edgeNodes[e * 2];
          const b = edgeNodes[e * 2 + 1];
          const aAct = nodeAct[a];
          const bAct = nodeAct[b];
          const act = Math.max(aAct, bAct);

          let alpha: number;
          if (act < 0.01) {
            // Idle: light tint at ~50% so the resting web is visible but soft.
            ec.copy(idleEdge);
            alpha = idleEdgeAlpha;
          } else {
            const ri = (aAct >= bAct ? brainData.regionOf[a] : brainData.regionOf[b]);
            const accent = ri >= 0 ? regionColors[ri] : idleEdge;
            const pulse = reducedMotion
              ? 1
              : 1 + Math.sin(now * PULSE_SPEED + e * 0.05) * 0.3 * act;
            ec.copy(accent).multiplyScalar(Math.min(0.7 + act * 0.5, 1.2) * pulse);
            // Highlighted edges go fully opaque so the active region pops hard
            // against the 10% idle web.
            alpha = idleEdgeAlpha + (1 - idleEdgeAlpha) * Math.min(act * 1.6, 1);
          }
          wireColor.setXYZ(e * 2, ec.r, ec.g, ec.b);
          wireColor.setXYZ(e * 2 + 1, ec.r, ec.g, ec.b);
          wireAlpha.setX(e * 2, alpha);
          wireAlpha.setX(e * 2 + 1, alpha);
        }
        wireColor.needsUpdate = true;
        wireAlpha.needsUpdate = true;
      }
    }

    renderer.render(scene, camera);
    projectLabels();

    // For reduced motion: render one frame then stop
    if (reducedMotion) {
      if (reducedMotionRenderedRef.current) return; // don't recurse
      reducedMotionRenderedRef.current = true;
    }

    rafIdRef.current = requestAnimationFrame(animate);
  }, [reducedMotion, projectLabels]);

  // ── Start/stop loop ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!theme || size.width === 0) return;

    const timer = setTimeout(() => setReady(true), 200);
    timeRef.current = performance.now() * 0.001;
    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [theme, size.width, animate]);

  // ── Sentence cycling ─────────────────────────────────────────────────────

  useEffect(() => {
    if (reducedMotion || !theme) return;
    if (animStateRef.current.isTransitioning) return;

    const id = setTimeout(() => {
      const current = animStateRef.current.exampleIndex;
      const next = (current + 1) % EXAMPLES.length;
      animStateRef.current.nextExampleIndex = next;
      animStateRef.current.isTransitioning = true;
      animStateRef.current.transitionProgress = 0;
      animStateRef.current.transitionStart = performance.now() * 0.001;
      setSentenceState({ currentIdx: current, nextIdx: next, progress: 0 });
    }, CYCLE_INTERVAL_MS);

    return () => clearTimeout(id);
  }, [sentenceState.currentIdx, sentenceState.nextIdx, reducedMotion, theme]);

  // ── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      rendererRef.current?.dispose();
      pointsRef.current?.geometry.dispose();
      (pointsRef.current?.material as THREE.Material)?.dispose();
      wiresRef.current?.geometry.dispose();
      (wiresRef.current?.material as THREE.Material)?.dispose();
    };
  }, []);

  // ── Camera resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!camera || !renderer || size.width === 0) return;
    const aspect = size.width / Math.max(size.height, 1);
    camera.aspect = aspect;
    // Keep brain fitting horizontally on narrow viewports.
    camera.position.z = aspect < 1 ? (5.4 * 1.05) / aspect : 5.4;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height, false);
    const pointMat = pointsRef.current?.material as THREE.ShaderMaterial | undefined;
    if (pointMat) {
      const fovRad = (camera.fov * Math.PI) / 180;
      (pointMat.uniforms.uScale as { value: number }).value =
        size.height / (2 * Math.tan(fovRad / 2));
      (pointMat.uniforms.uPixelRatio as { value: number }).value = Math.min(
        window.devicePixelRatio,
        2,
      );
    }
  }, [size.width, size.height]);

  // ── Build highlighted sentence ───────────────────────────────────────────

  const buildSentenceSpans = (
    ex: ConceptAssignment,
  ) => {
    const parts: { text: string; color?: string }[] = [];
    let remaining = ex.sentence;

    for (let i = 0; i < ex.highlightedWords.length; i++) {
      const word = ex.highlightedWords[i];
      const idx = remaining.indexOf(word);
      if (idx === -1) continue;
      if (idx > 0) parts.push({ text: remaining.slice(0, idx) });
      const accentKey = ACCENT_KEYS[ex.regionIndices[i] % ACCENT_KEYS.length];
      parts.push({
        text: word,
        color: theme?.[accentKey] ?? theme?.foreground ?? "#334155",
      });
      remaining = remaining.slice(idx + word.length);
    }
    if (remaining.length > 0) parts.push({ text: remaining });

    return parts;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const currentEx = EXAMPLES[sentenceState.currentIdx];
  const nextEx =
    sentenceState.nextIdx != null ? EXAMPLES[sentenceState.nextIdx] : null;
  const sProgress = sentenceState.progress;
  const isCrossfading = nextEx != null;

  const currentParts = buildSentenceSpans(currentEx);
  const nextParts = nextEx ? buildSentenceSpans(nextEx) : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "clamp(340px, 58vw, 480px)",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      {/* Sentence */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          paddingTop: "clamp(8px, 2vw, 18px)",
          pointerEvents: "none",
          opacity: ready ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        <div
          style={{
            position: "relative",
            fontSize: "clamp(1rem, 2.8vw, 1.35rem)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            color: theme?.foreground ?? "#334155",
            letterSpacing: "0.01em",
            textAlign: "center",
            display: "flex",
            gap: "0.15em",
            flexWrap: "wrap",
            justifyContent: "center",
            minHeight: "1.6em",
          }}
        >
          {/* Current */}
          <span
            style={{
              opacity: isCrossfading ? 1 - sProgress : 1,
              transition: "opacity 500ms ease",
              position: isCrossfading ? "absolute" : "relative",
              whiteSpace: "nowrap",
            }}
            aria-hidden={isCrossfading}
          >
            {currentParts.map((p, i) =>
              p.color ? (
                <span
                  key={i}
                  style={{
                    color: p.color,
                    fontWeight: 600,
                    transition: "color 600ms ease",
                  }}
                >
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </span>

          {/* Next */}
          {isCrossfading && nextParts && (
            <span
              style={{
                opacity: sProgress,
                transition: "opacity 500ms ease",
                position: "absolute",
                whiteSpace: "nowrap",
              }}
              aria-hidden
            >
              {nextParts.map((p, i) =>
                p.color ? (
                  <span
                    key={i}
                    style={{
                      color: p.color,
                      fontWeight: 600,
                      transition: "color 600ms ease",
                    }}
                  >
                    {p.text}
                  </span>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </span>
          )}

          {/* Invisible spacer */}
          {isCrossfading && (
            <span style={{ visibility: "hidden", whiteSpace: "nowrap" }}>
              {currentEx.sentence.length >= nextEx!.sentence.length
                ? currentEx.sentence
                : nextEx!.sentence}
            </span>
          )}
        </div>
      </div>

      {/* Three.js canvas mount point */}
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
        }}
      />

      {/* HTML overlay labels */}
      {labelPositions.map((lp, i) => (
        <div
          key={`${lp.label}-${i}`}
          style={{
            position: "absolute",
            left: lp.x,
            top: lp.y,
            transform: "translate(-50%, -50%)",
            color: lp.color,
            opacity: lp.opacity,
            transition: "opacity 400ms ease, color 600ms ease",
            fontSize: "clamp(0.7rem, 1.6vw, 0.85rem)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            pointerEvents: "none",
            textShadow: theme?.mode === "dark"
              ? "0 0 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)"
              : "0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
            maxWidth: "clamp(100px, 70vw, 240px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            zIndex: 5,
          }}
        >
          {lp.label}
        </div>
      ))}

      {/* SSR / loading placeholder */}
      {!theme && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "2px solid rgba(150,150,150,0.25)",
              borderTopColor: "rgba(150,150,150,0.6)",
              animation: "brain-spin 0.8s linear infinite",
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes brain-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default BrainActivation;