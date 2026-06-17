import * as THREE from 'three';

export type BodyKind = 'sun' | 'earth' | 'moon';

export const BODY_STYLE = {
  sun: {
    label: '太阳',
    radius: 2.85,
    particleCount: 780,
    particleSize: [0.022, 0.062],
    points: [
      { count: 920, size: 0.72, lift: 0.008 },
      { count: 260, size: 1.08, lift: 0.022 },
      { count: 72, size: 1.55, lift: 0.038 }
    ],
    core: '#F4E9B8',
    outer: '#F2D88A',
    line: '#FFF6D0',
    shadow: '#9f8848',
    minLight: 0.86,
    spin: 0.00065
  },
  earth: {
    label: '地球',
    radius: 1.28,
    particleCount: 520,
    particleSize: [0.018, 0.046],
    points: [
      { count: 560, size: 0.7, lift: 0.006 },
      { count: 170, size: 1.02, lift: 0.018 },
      { count: 44, size: 1.42, lift: 0.03 }
    ],
    core: '#243C8F',
    outer: '#315AAE',
    line: '#D8DDE8',
    shadow: '#10172f',
    minLight: 0.22,
    spin: 0.00135
  },
  moon: {
    label: '月亮',
    radius: 0.54,
    particleCount: 300,
    particleSize: [0.015, 0.04],
    points: [
      { count: 270, size: 0.68, lift: 0.006 },
      { count: 90, size: 0.98, lift: 0.019 },
      { count: 28, size: 1.36, lift: 0.032 }
    ],
    core: '#AEB6C3',
    outer: '#E1E6EE',
    line: '#E1E6EE',
    shadow: '#6B7380',
    minLight: 0.1,
    spin: 0.00048
  }
} satisfies Record<
  BodyKind,
  {
    core: string;
    label: string;
    line: string;
    minLight: number;
    outer: string;
    particleCount: number;
    particleSize: [number, number];
    points: Array<{ count: number; lift: number; size: number }>;
    radius: number;
    shadow: string;
    spin: number;
  }
>;

export function makeBodyMaterial(kind: BodyKind) {
  return new THREE.MeshBasicMaterial({
    color: BODY_STYLE[kind].core,
    depthWrite: false,
    opacity: kind === 'sun' ? 0.94 : 0.9,
    toneMapped: false,
    transparent: true,
    vertexColors: true
  });
}

export function mixBodyColor(target: THREE.Color, kind: BodyKind, light: number) {
  const style = BODY_STYLE[kind];
  const shadow = new THREE.Color(style.shadow);
  const core = new THREE.Color(style.core);
  const outer = new THREE.Color(style.outer);
  const color = target.copy(shadow).lerp(core, Math.min(1, light * 1.1));

  if (kind === 'sun') {
    color.lerp(outer, 0.32 + light * 0.24);
  }

  if (kind === 'moon' && light > 0.58) {
    color.lerp(outer, (light - 0.58) * 0.7);
  }

  if (kind === 'earth' && light > 0.5) {
    color.lerp(outer, (light - 0.5) * 0.38);
  }

  return color;
}

export function hash(value: number) {
  return THREE.MathUtils.euclideanModulo(Math.sin(value * 12.9898) * 43758.5453, 1);
}
