"use client";

/**
 * CreditCard3D
 * Interactive 3D payment card (React Three Fiber).
 *
 *  - Faces are drawn into canvas textures and mapped onto the card geometry, so text,
 *    chip and network logo follow the card exactly while it tilts and flips.
 *  - PBR material (physical, clear-coat) lit by a procedural studio environment —
 *    no network request, deterministic in every browser.
 *  - Pointer parallax and flip use frame-rate independent damping.
 *  - Bloom on strong glints; stronger for the "neon" finish.
 *  - Idle float and parallax are disabled for `prefers-reduced-motion`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface CreditCard3DProps {
  /** Last 4 digits of the PAN — plaintext, safe to render. */
  lastFour: string;
  holderName: string;
  /** 1–12 */
  expiryMonth: number;
  /** Full year, e.g. 2031 */
  expiryYear: number;
  /** Hex colour of the card body, e.g. "#1a1a2e". */
  color?: string;
  /** Surface finish. "light" renders a pale card tinted by `color`. */
  theme?: "dark" | "light" | "neon";
  network?: "VISA" | "MASTERCARD" | "ELO";
  cardType?: "CREDIT" | "DEBIT" | "VIRTUAL";
  /** When set, the CVV is printed on the back. */
  revealedCvv?: string;
  /** When provided, a "Mostrar CVV" button appears while the back is showing. */
  onRevealCvv?: () => Promise<void>;
  /** Drop the frame around the stage (use when the parent already draws one). */
  bare?: boolean;
  /** Hide the "flip" / "show CVV" buttons under the stage (for display-only uses). */
  hideControls?: boolean;
  /** Width limit etc. for the outer wrapper. Defaults to `max-w-[420px]`. */
  className?: string;
}

// ─────────────────────────────────────────────
// Geometry + material constants
// ─────────────────────────────────────────────

const CARD_W = 3.37;
const CARD_H = 2.125;
const CARD_D = 0.045;
const CORNER = 0.1;
const TEX_W = 1024;
const TEX_H = Math.round(TEX_W / (CARD_W / CARD_H));

const FINISH = {
  dark: { metalness: 0.28, roughness: 0.32, clearcoat: 1, emissive: 0.16, bloom: 0.3 },
  light: { metalness: 0.0, roughness: 0.42, clearcoat: 0.6, emissive: 0.06, bloom: 0.12 },
  neon: { metalness: 0.32, roughness: 0.25, clearcoat: 1, emissive: 0.34, bloom: 0.8 },
} as const;

/** Stage backdrop: a faint pool of cool light fading into the page colour (--bg). Kept subtle on purpose. */
function makeStageBackground(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 210, 10, 256, 256, 400);
  g.addColorStop(0, "#2a2f40");
  g.addColorStop(0.5, "#1a1d27");
  g.addColorStop(1, "#111216");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The card's shadow on the "wall" behind it: a radial falloff that reaches zero before the texture
 * edge. It has no shape of its own, so there is no edge to see however far the card tilts.
 */
function makeBackingShadow(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 340;
  const ctx = c.getContext("2d")!;
  ctx.translate(256, 170);
  ctx.scale(1, 340 / 512); // squash the circle into an ellipse that fits the texture
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 256);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(0.35, "rgba(0,0,0,0.42)");
  g.addColorStop(0.7, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-256, -256, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const TYPE_LABEL = { CREDIT: "CRÉDITO", DEBIT: "DÉBITO", VIRTUAL: "VIRTUAL" } as const;

// ─────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex: string, other: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Hex in, hex out — for values handed to three.js. */
function lightenHex(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v + (255 - v) * t));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);
const darken = (hex: string, t: number) => mix(hex, "#000000", t);

// ─────────────────────────────────────────────
// Canvas painting
// ─────────────────────────────────────────────

interface FaceData {
  lastFour: string;
  holderName: string;
  expiryLabel: string;
  base: string; // resolved body colour
  theme: "dark" | "light" | "neon";
  network: "VISA" | "MASTERCARD" | "ELO";
  cardType: "CREDIT" | "DEBIT" | "VIRTUAL";
  revealedCvv?: string;
  fontFamily: string;
}

const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintBackground(ctx: CanvasRenderingContext2D, d: FaceData, deeper = 0) {
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
  g.addColorStop(0, d.theme === "light" ? lighten(d.base, 0.35) : lighten(d.base, 0.16 - deeper));
  g.addColorStop(1, d.theme === "light" ? darken(d.base, 0.06) : darken(d.base, 0.28 + deeper));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const sheen = ctx.createRadialGradient(TEX_W * 0.18, -TEX_H * 0.1, 0, TEX_W * 0.18, -TEX_H * 0.1, TEX_W * 0.95);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  if (d.theme === "neon") {
    ctx.strokeStyle = "rgba(0,255,204,0.55)";
    ctx.lineWidth = 3;
    roundRect(ctx, 16, 16, TEX_W - 32, TEX_H - 32, 34);
    ctx.stroke();
  }
}

function drawNetwork(ctx: CanvasRenderingContext2D, d: FaceData, ink: string, right: number, baseline: number) {
  if (d.network === "MASTERCARD") {
    const r = 36;
    const cx = right - r * 1.7;
    const cy = baseline - r;
    ctx.fillStyle = "#eb001b";
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f79e1b";
    ctx.beginPath();
    ctx.arc(cx + r * 0.55, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#ff5f00";
    ctx.beginPath();
    ctx.arc(cx + r * 0.55, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  if (d.network === "VISA") {
    ctx.font = 'italic 800 58px "Times New Roman", serif';
    ctx.fillText("VISA", right, baseline);
  } else {
    ctx.font = `800 54px ${d.fontFamily}`;
    ctx.fillText("elo", right, baseline);
  }
  ctx.textAlign = "left";
}

function paintFront(ctx: CanvasRenderingContext2D, d: FaceData) {
  const light = d.theme === "light";
  const ink = light ? "#0f172a" : "#f8fafc";
  const dim = light ? "rgba(15,23,42,0.55)" : "rgba(248,250,252,0.62)";
  const pad = 68;

  ctx.clearRect(0, 0, TEX_W, TEX_H);
  paintBackground(ctx, d);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Wordmark
  ctx.fillStyle = ink;
  ctx.font = `700 46px ${d.fontFamily}`;
  ctx.letterSpacing = "1px";
  ctx.fillText("NexBank", pad, 112);

  // Card type pill
  ctx.font = `600 22px ${d.fontFamily}`;
  ctx.letterSpacing = "3px";
  const label = TYPE_LABEL[d.cardType];
  const lw = ctx.measureText(label).width;
  ctx.strokeStyle = dim;
  ctx.lineWidth = 2;
  roundRect(ctx, TEX_W - pad - lw - 44, 70, lw + 44, 50, 25);
  ctx.stroke();
  ctx.fillStyle = dim;
  ctx.fillText(label, TEX_W - pad - lw - 22, 104);

  // EMV chip
  const cx = pad;
  const cy = 196;
  const chip = ctx.createLinearGradient(cx, cy, cx + 112, cy + 86);
  chip.addColorStop(0, "#f2d98a");
  chip.addColorStop(1, "#b88f3a");
  ctx.fillStyle = chip;
  roundRect(ctx, cx, cy, 112, 86, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,60,10,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 29);
  ctx.lineTo(cx + 112, cy + 29);
  ctx.moveTo(cx, cy + 57);
  ctx.lineTo(cx + 112, cy + 57);
  ctx.moveTo(cx + 40, cy);
  ctx.lineTo(cx + 40, cy + 86);
  ctx.moveTo(cx + 72, cy);
  ctx.lineTo(cx + 72, cy + 86);
  ctx.stroke();
  roundRect(ctx, cx, cy, 112, 86, 14);
  ctx.stroke();

  // Contactless
  ctx.strokeStyle = dim;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(cx + 176, cy + 43, 12 + i * 11, -0.9, 0.9);
    ctx.stroke();
  }

  // PAN
  ctx.font = `500 54px ${MONO}`;
  ctx.letterSpacing = "3px";
  const groups = ["••••", "••••", "••••", d.lastFour];
  groups.forEach((g, i) => {
    ctx.fillStyle = i === 3 ? ink : dim;
    ctx.fillText(g, pad + i * 224, 392);
  });

  // Holder + expiry
  ctx.letterSpacing = "2px";
  ctx.font = `600 20px ${d.fontFamily}`;
  ctx.fillStyle = dim;
  ctx.fillText("TITULAR", pad, 486);
  ctx.fillText("VALIDADE", 590, 486);

  ctx.letterSpacing = "1px";
  ctx.font = `600 34px ${d.fontFamily}`;
  ctx.fillStyle = ink;
  let name = d.holderName.toUpperCase();
  while (ctx.measureText(name).width > 470 && name.length > 3) name = name.slice(0, -1);
  ctx.fillText(name, pad, 536);
  ctx.fillText(d.expiryLabel, 590, 536);

  ctx.letterSpacing = "0px";
  drawNetwork(ctx, d, ink, TEX_W - pad, 560);
}

function paintBack(ctx: CanvasRenderingContext2D, d: FaceData) {
  const light = d.theme === "light";
  const dim = light ? "rgba(15,23,42,0.55)" : "rgba(248,250,252,0.6)";
  const pad = 68;

  ctx.clearRect(0, 0, TEX_W, TEX_H);
  paintBackground(ctx, d, 0.04);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Magnetic stripe
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 84, TEX_W, 108);

  // Signature panel
  const sw = 580;
  const sx = pad;
  const sy = 252;
  ctx.save();
  roundRect(ctx, sx, sy, sw, 76, 8);
  ctx.clip();
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(sx, sy, sw, 76);
  ctx.strokeStyle = "rgba(160,160,170,0.55)";
  ctx.lineWidth = 3;
  for (let x = sx - 80; x < sx + sw + 80; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, sy + 76);
    ctx.lineTo(x + 40, sy);
    ctx.stroke();
  }
  ctx.restore();

  // CVV
  ctx.font = `600 20px ${d.fontFamily}`;
  ctx.letterSpacing = "2px";
  ctx.fillStyle = dim;
  ctx.fillText("CVV", TEX_W - pad - 170, sy - 14);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, TEX_W - pad - 170, sy, 170, 76, 10);
  ctx.fill();
  ctx.fillStyle = "#0b0b0e";
  ctx.font = `700 44px ${MONO}`;
  ctx.letterSpacing = "8px";
  ctx.textAlign = "center";
  ctx.fillText(d.revealedCvv ?? "•••", TEX_W - pad - 85 + 4, sy + 54);

  // Disclaimer
  ctx.textAlign = "center";
  ctx.letterSpacing = "1px";
  ctx.font = `500 20px ${d.fontFamily}`;
  ctx.fillStyle = dim;
  ctx.fillText("CARTÃO VIRTUAL PARA TESTES — NÃO FUNCIONA EM COMÉRCIOS REAIS", TEX_W / 2, 560);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
}

function useCardTextures(d: FaceData | null) {
  const [textures, setTextures] = useState<{ front: THREE.CanvasTexture; back: THREE.CanvasTexture } | null>(null);

  useEffect(() => {
    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TEX_W;
      canvas.height = TEX_H;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    };
    const next = { front: make(), back: make() };
    setTextures(next);
    return () => {
      next.front.dispose();
      next.back.dispose();
    };
  }, []);

  const key = d
    ? [d.lastFour, d.holderName, d.expiryLabel, d.base, d.theme, d.network, d.cardType, d.revealedCvv, d.fontFamily].join("|")
    : "";

  useEffect(() => {
    if (!textures || !d) return;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      const f = (textures.front.image as HTMLCanvasElement).getContext("2d");
      const b = (textures.back.image as HTMLCanvasElement).getContext("2d");
      if (!f || !b) return;
      paintFront(f, d);
      paintBack(b, d);
      textures.front.needsUpdate = true;
      textures.back.needsUpdate = true;
    };
    paint();
    document.fonts?.ready.then(paint);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures, key]);

  return textures;
}

// ─────────────────────────────────────────────
// 3D scene
// ─────────────────────────────────────────────

/** Rounded rectangle with 0..1 UVs, so a face texture maps edge to edge. */
function makeFaceGeometry(): THREE.ShapeGeometry {
  const w = CARD_W;
  const h = CARD_H;
  const r = CORNER;
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ShapeGeometry(shape, 12);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  return geo;
}

interface SceneProps {
  textures: { front: THREE.CanvasTexture; back: THREE.CanvasTexture };
  base: string;
  theme: "dark" | "light" | "neon";
  flipped: boolean;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
}

function CardScene({ textures, base, theme, flipped, pointer, reducedMotion }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const backing = useRef<THREE.Mesh>(null);
  const state = useRef({ rx: 0, ry: 0, flip: 0 });
  const faceGeometry = useMemo(makeFaceGeometry, []);
  const stage = useMemo(() => ({ background: makeStageBackground(), shadow: makeBackingShadow() }), []);
  const finish = FINISH[theme];

  useEffect(() => () => faceGeometry.dispose(), [faceGeometry]);
  useEffect(
    () => () => {
      stage.background.dispose();
      stage.shadow.dispose();
    },
    [stage]
  );

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const p = pointer.current;
    const s = state.current;
    // About 11 and 16 degrees at the edges: enough to catch the light without distorting the card.
    const targetX = reducedMotion ? 0 : -p.y * 0.2;
    const targetY = reducedMotion ? 0 : p.x * 0.28;
    s.rx = THREE.MathUtils.damp(s.rx, targetX, 6, delta);
    s.ry = THREE.MathUtils.damp(s.ry, targetY, 6, delta);
    s.flip = THREE.MathUtils.damp(s.flip, flipped ? Math.PI : 0, 5, delta);
    g.rotation.set(s.rx, s.ry + s.flip, 0);
    const bob = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.035;
    g.position.y = bob;

    // The shadow stays on the "wall" while the card moves in front of it: that offset is the depth cue.
    const wall = backing.current;
    if (wall) {
      wall.position.x = -s.ry * 0.55;
      wall.position.y = -0.2 + s.rx * 0.45 + bob * 0.4;
    }
  });

  const faceMaterial = (map: THREE.CanvasTexture) => (
    <meshPhysicalMaterial
      map={map}
      emissive="#ffffff"
      emissiveMap={map}
      emissiveIntensity={finish.emissive}
      metalness={finish.metalness}
      roughness={finish.roughness}
      clearcoat={finish.clearcoat}
      clearcoatRoughness={0.22}
      envMapIntensity={1}
      polygonOffset
      polygonOffsetFactor={-2}
    />
  );

  return (
    <>
      <primitive object={stage.background} attach="background" />
      <PerspectiveCamera makeDefault position={[0, 0, 3.45]} fov={40} />

      <mesh ref={backing} position={[0, -0.2, -0.55]} renderOrder={-1}>
        <planeGeometry args={[CARD_W * 1.5, CARD_H * 1.6]} />
        <meshBasicMaterial map={stage.shadow} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Procedural studio: soft boxes instead of a downloaded HDRI. */}
      <Environment key={theme} resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.6} position={[0, 3.2, 3]} scale={[9, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 0, 2]} scale={[2, 7, 1]} color="#9db4ff" />
        <Lightformer form="rect" intensity={1.1} position={[5, -1, 2]} scale={[2, 6, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={0.8} position={[0, -3, 3]} scale={4} color="#ffffff" />
        {theme === "neon" && (
          <Lightformer form="rect" intensity={2.2} position={[0, -2.5, 2.5]} scale={[7, 1.2, 1]} color="#00ffcc" />
        )}
      </Environment>

      <ambientLight intensity={0.3} />

      <group ref={group}>
        <RoundedBox args={[CARD_W, CARD_H, CARD_D]} radius={CORNER} smoothness={4}>
          <meshPhysicalMaterial
            color={base}
            metalness={finish.metalness}
            roughness={finish.roughness}
            clearcoat={finish.clearcoat}
            clearcoatRoughness={0.22}
          />
        </RoundedBox>

        <mesh geometry={faceGeometry} position={[0, 0, CARD_D / 2 + 0.0008]}>
          {faceMaterial(textures.front)}
        </mesh>

        <mesh geometry={faceGeometry} position={[0, 0, -(CARD_D / 2 + 0.0008)]} rotation={[0, Math.PI, 0]}>
          {faceMaterial(textures.back)}
        </mesh>
      </group>

      <EffectComposer multisampling={4}>
        <Bloom intensity={finish.bloom} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function CreditCard3D({
  lastFour,
  holderName,
  expiryMonth,
  expiryYear,
  color = "#1a1a2e",
  theme = "dark",
  network = "MASTERCARD",
  cardType = "CREDIT",
  revealedCvv,
  onRevealCvv,
  bare = false,
  hideControls = false,
  className,
}: CreditCard3DProps) {
  const [flipped, setFlipped] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fontFamily, setFontFamily] = useState("system-ui, sans-serif");
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    setFontFamily(getComputedStyle(document.body).fontFamily || "system-ui, sans-serif");
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const base = theme === "light" ? lightenHex(color, 0.86) : color;
  const faceData: FaceData | null = mounted
    ? {
        lastFour,
        holderName,
        expiryLabel: `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear).slice(-2)}`,
        base,
        theme,
        network,
        cardType,
        revealedCvv,
        fontFamily,
      }
    : null;
  const textures = useCardTextures(faceData);

  const flip = useCallback(() => setFlipped((v) => !v), []);

  const reveal = useCallback(async () => {
    if (!onRevealCvv) return;
    setRevealing(true);
    try {
      await onRevealCvv();
    } finally {
      setRevealing(false);
    }
  }, [onRevealCvv]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  return (
    <div className={cn("w-full", className ?? "max-w-[420px]")}>
      <div
        role="img"
        aria-label={`Cartão ${network} final ${lastFour}, ${flipped ? "verso" : "frente"}`}
        className={cn(
          "relative aspect-[1.586] w-full cursor-pointer touch-pan-y overflow-hidden rounded-xl",
          // The stage is a lit "window": a thin edge and an inner shadow make it read as recessed.
          !bare && "border border-line shadow-field"
        )}
        onClick={flip}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          pointer.current.x = 0;
          pointer.current.y = 0;
        }}
      >
        {mounted && textures && (
          <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}>
            <CardScene
              textures={textures}
              base={base}
              theme={theme}
              flipped={flipped}
              pointer={pointer}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        )}
      </div>

      <div className={cn("mt-3 flex items-center justify-between gap-3", hideControls && "hidden")}>
        <Button variant="secondary" size="sm" onClick={flip}>
          <RotateCw className="size-3.5" aria-hidden />
          {flipped ? "Ver frente" : "Ver verso"}
        </Button>

        {onRevealCvv && flipped && (
          revealedCvv ? (
            <span className="text-xs text-fg-subtle" role="status">
              CVV visível por 30 segundos
            </span>
          ) : (
            <Button size="sm" onClick={reveal} loading={revealing}>
              Mostrar CVV
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export default CreditCard3D;
