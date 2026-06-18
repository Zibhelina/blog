"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  useAppletTheme,
  usePrefersReducedMotion,
  useContainerSize,
} from "@/components/applets/use-applet-theme";
import type { AppletTheme } from "@/components/applets/use-applet-theme";

// ── Graph data ────────────────────────────────────────────────────────────────
//
// A small web of concepts where each one is "defined" by others, which are
// themselves defined by others — the Wikipedia rabbit-hole. The directed edges
// are the *questions* that pull you from one concept to the next. There are
// cycles on purpose (vetor ⇄ norma, base ⇄ dimensão, vetor → transformação →
// matriz → vetor): concepts lean on each other, sometimes circularly.
//
// The view highlights ONE link at a time: two concepts and the single question
// connecting them, always picking the pair nearest the camera as the graph
// turns. The highlight then "descends" along an outgoing question of the concept
// it just reached — walking the rabbit-hole one hop at a time.

type AccentKey = "green" | "aqua" | "yellow" | "orange" | "purple" | "red";

interface ConceptNode {
  id: string;
  label: string;
  accent: AccentKey;
}

interface ConceptEdge {
  from: string;
  to: string;
  q: string;
}

const NODES: ConceptNode[] = [
  { id: "vetor", label: "Vetor", accent: "green" },
  { id: "espaco", label: "Espaço vetorial", accent: "aqua" },
  { id: "base", label: "Base", accent: "yellow" },
  { id: "dimensao", label: "Dimensão", accent: "orange" },
  { id: "combinacao", label: "Combinação linear", accent: "purple" },
  { id: "independencia", label: "Independência linear", accent: "red" },
  { id: "matriz", label: "Matriz", accent: "aqua" },
  { id: "transformacao", label: "Transformação linear", accent: "orange" },
  { id: "norma", label: "Norma", accent: "purple" },
];

const EDGES: ConceptEdge[] = [
  { from: "vetor", to: "espaco", q: "onde ele vive?" },
  { from: "espaco", to: "base", q: "o que o gera?" },
  { from: "espaco", to: "combinacao", q: "como me movo nele?" },
  { from: "base", to: "independencia", q: "o que ela exige?" },
  { from: "base", to: "dimensao", q: "quantos vetores?" },
  { from: "dimensao", to: "base", q: "conta o quê?" },
  { from: "combinacao", to: "vetor", q: "combina o quê?" },
  { from: "independencia", to: "combinacao", q: "evita qual combinação?" },
  { from: "vetor", to: "norma", q: "qual o seu tamanho?" },
  { from: "norma", to: "vetor", q: "mede o quê?" },
  { from: "vetor", to: "transformacao", q: "o que age sobre ele?" },
  { from: "transformacao", to: "matriz", q: "como represento?" },
  { from: "matriz", to: "vetor", q: "age sobre o quê?" },
  { from: "transformacao", to: "espaco", q: "mapeia entre o quê?" },
];

const NODE_INDEX: Record<string, number> = Object.fromEntries(
  NODES.map((n, i) => [n.id, i])
);

// ── i18n ────────────────────────────────────────────────────────────────────
// Labels + questions in English, keyed to the same node ids / edge order so the
// graph structure stays identical across languages. Default language is PT.
type Lang = "pt" | "en";

const NODE_LABELS_EN: Record<string, string> = {
  vetor: "Vector",
  espaco: "Vector space",
  base: "Basis",
  dimensao: "Dimension",
  combinacao: "Linear combination",
  independencia: "Linear independence",
  matriz: "Matrix",
  transformacao: "Linear transformation",
  norma: "Norm",
};

// Same order as EDGES above.
const EDGE_QUESTIONS_EN: string[] = [
  "where does it live?",
  "what generates it?",
  "how do I move in it?",
  "what does it require?",
  "how many vectors?",
  "counts what?",
  "combines what?",
  "avoids which combination?",
  "what is its size?",
  "measures what?",
  "what acts on it?",
  "how do I represent it?",
  "acts on what?",
  "maps between what?",
];

function nodeLabel(id: string, fallback: string, lang: Lang): string {
  return lang === "en" ? NODE_LABELS_EN[id] ?? fallback : fallback;
}
function edgeQuestion(i: number, fallback: string, lang: Lang): string {
  return lang === "en" ? EDGE_QUESTIONS_EN[i] ?? fallback : fallback;
}

interface EdgeIdx {
  from: number;
  to: number;
  q: string;
}

const EDGE_IDX: EdgeIdx[] = EDGES.map((e) => ({
  from: NODE_INDEX[e.from]!,
  to: NODE_INDEX[e.to]!,
  q: e.q,
}));

// Outgoing / incoming edge indices per node.
const OUTGOING: number[][] = NODES.map((_, i) =>
  EDGE_IDX.map((e, ei) => (e.from === i ? ei : -1)).filter((ei) => ei >= 0)
);
const INCOMING: number[][] = NODES.map((_, i) =>
  EDGE_IDX.map((e, ei) => (e.to === i ? ei : -1)).filter((ei) => ei >= 0)
);

// ── Tunables ──────────────────────────────────────────────────────────────────

const NODE_RADIUS = 0.22;
const FOCUS_RADIUS = 0.34;
const TARGET_RADIUS = 0.28;
const TUBE_RADIUS = 0.022;
const CONE_RADIUS = 0.085;
const CONE_HEIGHT = 0.26;
const BOW = 0.18; // fraction of edge length the curve bows outward
const ROTATION_SPEED = 0.0019; // rad/frame (idle auto-rotation)
const INITIAL_TILT_X = 0.3;
const DWELL_MS = 2700;
const DPR_CAP = 2;
const FIT_RADIUS = 3.0;
const DRAG_SENS = 0.008; // rad per pixel dragged
const PITCH_LIMIT = 1.35; // clamp vertical rotation so it never flips over
const AUTOROTATE_RESUME_MS = 2600; // idle delay before auto-rotation resumes

const FALLBACK: Record<AccentKey | "muted" | "surface" | "foreground", string> = {
  green: "#a7c080",
  aqua: "#83c092",
  yellow: "#dbbc7f",
  orange: "#e69875",
  purple: "#d699b6",
  red: "#e67e80",
  muted: "#859289",
  surface: "#2d353b",
  foreground: "#d3c6aa",
};

// ── Deterministic RNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 3D force-directed layout, run to settle, normalized to fit a sphere of
 * radius FIT_RADIUS. Deterministic seed → identical layout every mount.
 */
function computeLayout3D(): THREE.Vector3[] {
  const rng = mulberry32(20260618);
  const n = NODES.length;
  const pos: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    pos.push(
      new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(1.6)
    );
  }

  const REST = 1.5;
  const K_REP = 0.9;
  const K_SPRING = 0.06;
  const K_CENTER = 0.012;
  const ITERS = 600;
  const tmp = new THREE.Vector3();

  for (let iter = 0; iter < ITERS; iter++) {
    const cooling = 1 - iter / ITERS;
    const disp: THREE.Vector3[] = pos.map(() => new THREE.Vector3());

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        tmp.subVectors(pos[i]!, pos[j]!);
        let d2 = tmp.lengthSq();
        if (d2 < 1e-4) {
          tmp.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.01);
          d2 = tmp.lengthSq() + 1e-4;
        }
        const f = K_REP / d2;
        tmp.normalize().multiplyScalar(f);
        disp[i]!.add(tmp);
        disp[j]!.sub(tmp);
      }
    }

    for (const e of EDGE_IDX) {
      tmp.subVectors(pos[e.to]!, pos[e.from]!);
      const d = tmp.length() || 1e-4;
      const f = K_SPRING * (d - REST);
      tmp.normalize().multiplyScalar(f);
      disp[e.from]!.add(tmp);
      disp[e.to]!.sub(tmp);
    }

    for (let i = 0; i < n; i++) {
      disp[i]!.addScaledVector(pos[i]!, -K_CENTER);
    }

    for (let i = 0; i < n; i++) {
      pos[i]!.addScaledVector(disp[i]!, cooling);
    }
  }

  const centroid = new THREE.Vector3();
  for (const p of pos) centroid.add(p);
  centroid.multiplyScalar(1 / n);
  let maxR = 0;
  for (const p of pos) {
    p.sub(centroid);
    maxR = Math.max(maxR, p.length());
  }
  const scale = FIT_RADIUS / (maxR || 1);
  for (const p of pos) p.multiplyScalar(scale);
  return pos;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLE_ID = "concept-graph-styles";
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .cg3-wrapper {
      position: relative;
      width: 100%;
      height: clamp(400px, 76vw, 560px);
      background: transparent;
      touch-action: pan-y;
      cursor: grab;
    }
    .cg3-wrapper.cg3-dragging { cursor: grabbing; }
    .cg3-canvas-host { position: absolute; inset: 0; }
    .cg3-canvas-host canvas { display: block; }
    .cg3-labels { position: absolute; inset: 0; overflow: visible; z-index: 2; pointer-events: none; }
    .cg3-node {
      position: absolute;
      transform: translate(-50%, -50%);
      white-space: nowrap;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.01em;
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
      transition: color 0.35s ease, opacity 0.35s ease;
      will-change: transform, opacity;
    }
    .cg3-q {
      position: absolute;
      transform: translate(-50%, -50%);
      white-space: nowrap;
      padding: 0.18em 0.5em;
      border-radius: 6px;
      font-size: 0.72rem;
      font-style: italic;
      line-height: 1;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease;
      will-change: transform, opacity;
    }
    @media (max-width: 480px) {
      .cg3-q { font-size: 0.64rem; }
    }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConceptGraph({ lang = "pt" }: { lang?: Lang }) {
  const theme = useAppletTheme();
  const reducedMotion = usePrefersReducedMotion();
  const { ref: containerRef, size } = useContainerSize<HTMLDivElement>();

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const nodeMeshRef = useRef<THREE.Mesh[]>([]);
  const tubeMeshRef = useRef<THREE.Mesh[]>([]);
  const coneMeshRef = useRef<THREE.Mesh[]>([]);
  const localPosRef = useRef<THREE.Vector3[]>([]);
  const edgeApexRef = useRef<THREE.Vector3[]>([]);

  const labelsHostRef = useRef<HTMLDivElement | null>(null);
  const nodeElsRef = useRef<HTMLDivElement[]>([]);
  const qElsRef = useRef<HTMLDivElement[]>([]);

  // Active link = one directed edge (two concepts + one question).
  const activeEdgeRef = useRef(0);
  const hopCountRef = useRef(0);
  const lastSwitchRef = useRef(0);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const resumeAtRef = useRef(0); // timestamp after which auto-rotation may resume
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const themeRef = useRef<AppletTheme | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    themeRef.current = theme;
    applyTheme();
    if (reducedRef.current) renderOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    injectStyles();
  }, []);

  // ── Setup (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;
    if (rendererRef.current) return; // guard double-init
    mountedRef.current = true;

    const W = Math.max(container.clientWidth, 1);
    const H = Math.max(container.clientHeight, 1);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 100);
    camera.position.set(0, 0, 10.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    renderer.setSize(W, H, false);
    rendererRef.current = renderer;

    const canvasHost = document.createElement("div");
    canvasHost.className = "cg3-canvas-host";
    canvasHost.appendChild(renderer.domElement);
    container.appendChild(canvasHost);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dir1.position.set(4, 6, 6);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.25);
    dir2.position.set(-4, -2, -5);
    scene.add(dir2);

    const group = new THREE.Group();
    group.rotation.x = INITIAL_TILT_X;
    scene.add(group);
    groupRef.current = group;

    // ── Drag-to-orbit ────────────────────────────────────────────────────────
    // Click/touch and drag rotates the graph on both axes so the structure can
    // be explored from any angle. Auto-rotation pauses during the drag and for a
    // short idle window after, then resumes. On touch, `touch-action: pan-y`
    // lets vertical swipes scroll the page; we only apply yaw from touch so the
    // page stays scrollable, while a mouse gets full pitch + yaw.
    let lastX = 0;
    let lastY = 0;
    let activePointer: number | null = null;
    let dragPointerType = "mouse";

    const onPointerDown = (ev: PointerEvent) => {
      if (activePointer !== null) return;
      activePointer = ev.pointerId;
      dragPointerType = ev.pointerType;
      draggingRef.current = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      container.classList.add("cg3-dragging");
      try {
        container.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingRef.current || ev.pointerId !== activePointer) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      const g = groupRef.current;
      if (!g) return;
      g.rotation.y += dx * DRAG_SENS;
      if (dragPointerType === "mouse") {
        g.rotation.x = THREE.MathUtils.clamp(
          g.rotation.x + dy * DRAG_SENS,
          -PITCH_LIMIT,
          PITCH_LIMIT
        );
      }
      if (reducedRef.current) renderOnce();
    };

    const endDrag = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointer) return;
      activePointer = null;
      draggingRef.current = false;
      resumeAtRef.current = performance.now() + AUTOROTATE_RESUME_MS;
      container.classList.remove("cg3-dragging");
      try {
        container.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    const layout = computeLayout3D();
    localPosRef.current = layout;

    const nodeGeo = new THREE.SphereGeometry(1, 28, 28);
    const nodeMeshes: THREE.Mesh[] = [];
    layout.forEach((p) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.35,
        metalness: 0.05,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(p);
      mesh.scale.setScalar(NODE_RADIUS);
      group.add(mesh);
      nodeMeshes.push(mesh);
    });
    nodeMeshRef.current = nodeMeshes;

    const tubeMeshes: THREE.Mesh[] = [];
    const coneMeshes: THREE.Mesh[] = [];
    const apexes: THREE.Vector3[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const altUp = new THREE.Vector3(1, 0, 0);
    const coneGeo = new THREE.ConeGeometry(CONE_RADIUS, CONE_HEIGHT, 14, 1);

    EDGE_IDX.forEach((e) => {
      const a = layout[e.from]!;
      const b = layout[e.to]!;
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const start = a.clone().addScaledVector(dir, NODE_RADIUS);
      const end = b.clone().addScaledVector(dir, -(NODE_RADIUS + CONE_HEIGHT));

      let perp = new THREE.Vector3().crossVectors(dir, up);
      if (perp.lengthSq() < 1e-4) perp = new THREE.Vector3().crossVectors(dir, altUp);
      perp.normalize();
      const sign = e.from < e.to ? 1 : -1;
      const dist = a.distanceTo(b);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const ctrl = mid.clone().addScaledVector(perp, sign * BOW * dist);

      const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
      apexes.push(curve.getPoint(0.5));

      const tubeGeo = new THREE.TubeGeometry(curve, 24, TUBE_RADIUS, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.05,
        transparent: true,
        opacity: 0.08,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      group.add(tube);
      tubeMeshes.push(tube);

      const tangent = curve.getTangent(1).normalize();
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.05,
        transparent: true,
        opacity: 0.08,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(end).addScaledVector(tangent, CONE_HEIGHT / 2);
      cone.quaternion.setFromUnitVectors(up, tangent);
      group.add(cone);
      coneMeshes.push(cone);
    });

    tubeMeshRef.current = tubeMeshes;
    coneMeshRef.current = coneMeshes;
    edgeApexRef.current = apexes;

    const labelsHost = document.createElement("div");
    labelsHost.className = "cg3-labels";
    container.appendChild(labelsHost);
    labelsHostRef.current = labelsHost;

    const nodeEls: HTMLDivElement[] = [];
    NODES.forEach((node, i) => {
      const el = document.createElement("div");
      el.className = "cg3-node";
      el.textContent = nodeLabel(node.id, node.label, lang);
      el.addEventListener("pointerenter", () => {
        // Hover a concept → highlight its nearest-to-camera outgoing link
        // (fall back to an incoming one if it's a pure sink).
        const outs = OUTGOING[i] ?? [];
        const ins = INCOMING[i] ?? [];
        const pool = outs.length > 0 ? outs : ins;
        if (pool.length > 0) {
          activeEdgeRef.current = pickNearestEdge(pool);
          pausedRef.current = true;
          if (reducedRef.current) renderOnce();
        }
      });
      el.addEventListener("pointerleave", () => {
        pausedRef.current = false;
        lastSwitchRef.current = performance.now();
      });
      labelsHost.appendChild(el);
      nodeEls.push(el);
    });
    nodeElsRef.current = nodeEls;

    const qEls: HTMLDivElement[] = [];
    EDGE_IDX.forEach((e, ei) => {
      const el = document.createElement("div");
      el.className = "cg3-q";
      el.textContent = edgeQuestion(ei, e.q, lang);
      labelsHost.appendChild(el);
      qEls.push(el);
    });
    qElsRef.current = qEls;

    // Start on whichever edge is frontmost.
    activeEdgeRef.current = pickNearestEdge(EDGE_IDX.map((_, i) => i));
    applyTheme();
    lastSwitchRef.current = performance.now();

    if (reducedRef.current) {
      renderOnce();
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.classList.remove("cg3-dragging");
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m?.dispose();
        }
      });
      canvasHost.remove();
      labelsHost.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
      nodeMeshRef.current = [];
      tubeMeshRef.current = [];
      coneMeshRef.current = [];
      nodeElsRef.current = [];
      qElsRef.current = [];
      localPosRef.current = [];
      edgeApexRef.current = [];
      labelsHostRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!renderer || !camera || !container) return;
    if (size.width === 0 || size.height === 0) return;
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.updateProjectionMatrix();
    if (reducedRef.current) renderOnce();
  }, [size]);

  function col(key: AccentKey | "muted" | "surface" | "foreground"): string {
    const t = themeRef.current;
    if (!t) return FALLBACK[key];
    if (key === "muted") return t.muted;
    if (key === "surface") return t.surface;
    if (key === "foreground") return t.foreground;
    return t[key];
  }

  function applyTheme() {
    const nodes = nodeMeshRef.current;
    nodes.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(col(NODES[i]!.accent));
    });
  }

  // ── World distance of a group-local point to the camera (smaller = closer) ──
  const _w = new THREE.Vector3();
  function depthToCamera(local: THREE.Vector3): number {
    const group = groupRef.current;
    const cam = cameraRef.current;
    if (!group || !cam) return 0;
    _w.copy(local);
    group.localToWorld(_w);
    return _w.distanceTo(cam.position);
  }

  // ── Among a set of edges, pick the one nearest the camera right now ─────────
  // (tiny random tiebreak among the two closest so it doesn't feel mechanical).
  function pickNearestEdge(list: number[]): number {
    if (list.length === 0) return activeEdgeRef.current;
    if (list.length === 1) return list[0]!;
    const apexes = edgeApexRef.current;
    const scored = list
      .map((ei) => ({ ei, d: apexes[ei] ? depthToCamera(apexes[ei]!) : 1e9 }))
      .sort((a, b) => a.d - b.d);
    const k = Math.min(2, scored.length);
    return scored[Math.floor(Math.random() * k)]!.ei;
  }

  // ── Walk one hop: descend along an outgoing question of the concept we just
  //    reached, preferring the link nearest the camera. ───────────────────────
  function stepFocus(now: number) {
    if (pausedRef.current || draggingRef.current) return;
    if (now - lastSwitchRef.current < DWELL_MS) return;

    const active = EDGE_IDX[activeEdgeRef.current]!;
    const cameFrom = active.from;
    const curNode = active.to;

    // Continuation candidates: outgoing edges of curNode, avoiding the immediate
    // reverse (going straight back where we came from) unless there's no choice.
    let candidates = OUTGOING[curNode] ?? [];
    const nonReverse = candidates.filter((ei) => EDGE_IDX[ei]!.to !== cameFrom);
    if (nonReverse.length > 0) candidates = nonReverse;

    // Every few hops, "open a new tab": jump to a fresh frontmost link anywhere.
    const jump = hopCountRef.current > 0 && hopCountRef.current % 5 === 0;

    let next: number;
    if (jump || candidates.length === 0) {
      const all = EDGE_IDX.map((_, i) => i).filter(
        (i) => i !== activeEdgeRef.current
      );
      next = pickNearestEdge(all);
    } else {
      next = pickNearestEdge(candidates);
    }

    activeEdgeRef.current = next;
    hopCountRef.current += 1;
    lastSwitchRef.current = now;
  }

  // ── Project a group-local point to container pixels ────────────────────────
  const _world = new THREE.Vector3();
  const _ndc = new THREE.Vector3();
  function project(
    local: THREE.Vector3,
    rectW: number,
    rectH: number
  ): { x: number; y: number; visible: boolean; depthScale: number; dist: number } {
    const group = groupRef.current!;
    const cam = cameraRef.current!;
    _world.copy(local);
    group.localToWorld(_world);
    const dist = _world.distanceTo(cam.position);
    _ndc.copy(_world).project(cam);
    const visible =
      _ndc.z > 0 && _ndc.z < 1 && Math.abs(_ndc.x) < 1.25 && Math.abs(_ndc.y) < 1.25;
    const x = ((_ndc.x + 1) / 2) * rectW;
    const y = ((1 - _ndc.y) / 2) * rectH;
    const depthScale = THREE.MathUtils.clamp(10.5 / Math.max(dist, 1), 0.6, 1.18);
    return { x, y, visible, depthScale, dist };
  }

  // ── Update HTML labels + highlight for the single active link ──────────────
  function updateOverlay() {
    const container = containerRef.current;
    const host = labelsHostRef.current;
    if (!container || !host) return;
    const W = container.clientWidth;
    const H = container.clientHeight;

    const activeIdx = activeEdgeRef.current;
    const active = EDGE_IDX[activeIdx]!;
    const fromN = active.from;
    const toN = active.to;
    const accent = col(NODES[fromN]!.accent);

    // Edges: only the active one lit; everything else nearly invisible.
    const tubes = tubeMeshRef.current;
    const cones = coneMeshRef.current;
    EDGE_IDX.forEach((_, ei) => {
      const hot = ei === activeIdx;
      const tubeMat = tubes[ei]!.material as THREE.MeshStandardMaterial;
      const coneMat = cones[ei]!.material as THREE.MeshStandardMaterial;
      const c = hot ? accent : col("muted");
      tubeMat.color.set(c);
      coneMat.color.set(c);
      tubeMat.opacity = hot ? 0.98 : 0.05;
      coneMat.opacity = hot ? 0.98 : 0.05;
    });

    // Node spheres: source biggest, target slightly bigger, rest small + dim
    // (dimmer the farther they are from the camera).
    const nodeMeshes = nodeMeshRef.current;
    const localPos = localPosRef.current;
    nodeMeshes.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (i === fromN) {
        mesh.scale.setScalar(FOCUS_RADIUS);
        mat.opacity = 1;
      } else if (i === toN) {
        mesh.scale.setScalar(TARGET_RADIUS);
        mat.opacity = 1;
      } else {
        mesh.scale.setScalar(NODE_RADIUS);
        const ds = project(localPos[i]!, W, H).depthScale;
        mat.opacity = 0.08 + 0.22 * ((ds - 0.6) / 0.58); // ~0.08 (far) .. 0.30 (near)
      }
    });

    // Node labels
    const nodeEls = nodeElsRef.current;
    nodeEls.forEach((el, i) => {
      const p = project(localPos[i]!, W, H);
      const isFrom = i === fromN;
      const isTo = i === toN;
      const active2 = isFrom || isTo;
      const yOff = (isFrom ? FOCUS_RADIUS : isTo ? TARGET_RADIUS : NODE_RADIUS) * 58 * p.depthScale + 8;
      el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y + yOff}px)`;

      if (!p.visible) {
        el.style.opacity = "0";
        return;
      }
      if (active2) {
        el.style.opacity = "1";
        el.style.color = isFrom ? col("foreground") : col(NODES[i]!.accent);
        el.style.fontSize = `${((isFrom ? 15 : 13.5) * p.depthScale).toFixed(2)}px`;
        el.style.fontWeight = isFrom ? "700" : "650";
        el.style.textShadow = `0 1px 3px ${col("surface")}, 0 0 3px ${col("surface")}`;
        el.style.zIndex = "130";
      } else {
        const dim = 0.1 + 0.28 * ((p.depthScale - 0.6) / 0.58); // near ones a touch more visible
        el.style.opacity = String(THREE.MathUtils.clamp(dim, 0.1, 0.42));
        el.style.color = col("muted");
        el.style.fontSize = `${(11.5 * p.depthScale).toFixed(2)}px`;
        el.style.fontWeight = "600";
        el.style.textShadow = "none";
        el.style.zIndex = String(Math.round(p.depthScale * 100));
      }
    });

    // Question labels: only the active link's question is shown.
    const qEls = qElsRef.current;
    const apexes = edgeApexRef.current;
    qEls.forEach((el, ei) => {
      if (ei !== activeIdx) {
        el.style.opacity = "0";
        return;
      }
      const p = project(apexes[ei]!, W, H);
      el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`;
      el.style.opacity = p.visible ? "1" : "0";
      el.style.color = accent;
      el.style.background = col("surface");
      el.style.zIndex = "140";
    });
  }

  function renderOnce() {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    updateOverlay();
  }

  function loop() {
    if (!mountedRef.current) return;
    const now = performance.now();
    const group = groupRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (group && renderer && scene && camera) {
      stepFocus(now);
      if (!reducedRef.current && !draggingRef.current && now >= resumeAtRef.current) {
        group.rotation.y += ROTATION_SPEED;
      }
      renderer.render(scene, camera);
      updateOverlay();
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  return (
    <div
      ref={containerRef}
      className="cg3-wrapper"
      style={{ background: "transparent" }}
      aria-label="Grafo 3D de conceitos interligados de álgebra linear. A cada instante um único par de conceitos é destacado, ligado por uma pergunta; o destaque desce de conceito em conceito como descer pelos links da Wikipédia. Arraste com o mouse para girar e explorar a estrutura."
    />
  );
}
