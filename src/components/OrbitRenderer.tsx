import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vector3Tuple } from '../types';

type OrbitRendererProps = {
  center: Vector3Tuple;
  radius: number;
  segments: number;
  variant: 'solar' | 'lunar';
};

export function OrbitRenderer({ center, radius, segments, variant }: OrbitRendererProps) {
  const ring = useMemo(() => createOrbitRing(center, radius, segments), [center, radius, segments]);
  const dash = useMemo(() => createDashedOrbit(center, radius, segments), [center, radius, segments]);
  const ticks = useMemo(() => createOrbitTicks(center, radius, variant === 'solar' ? 84 : 40, variant === 'solar' ? 0.22 : 0.08), [center, radius, variant]);
  const dots = useMemo(() => createOrbitDots(center, radius, Math.floor(segments * 0.75)), [center, radius, segments]);

  return (
    <>
      <lineSegments geometry={ring}>
        <lineBasicMaterial color="#D8DDE8" opacity={variant === 'solar' ? 0.2 : 0.26} transparent />
      </lineSegments>
      <lineSegments geometry={dash}>
        <lineBasicMaterial color="#F4F4F0" opacity={variant === 'solar' ? 0.45 : 0.54} transparent />
      </lineSegments>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color="#FFFFFF" opacity={variant === 'solar' ? 0.34 : 0.42} transparent />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={dots} count={dots.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#FFFFFF" opacity={variant === 'solar' ? 0.58 : 0.7} size={variant === 'solar' ? 1.25 : 1.45} sizeAttenuation={false} transparent />
      </points>
    </>
  );
}

export function BackgroundDots() {
  const dots = useMemo(() => {
    const count = 150;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (hash(i * 2.31) - 0.5) * 86;
      positions[i * 3 + 1] = (hash(i * 3.77) - 0.5) * 46;
      positions[i * 3 + 2] = -18 - hash(i * 5.19) * 42;
    }

    return positions;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={dots} count={dots.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#D8DDE8" opacity={0.28} size={1.1} sizeAttenuation={false} transparent />
    </points>
  );
}

function createOrbitRing(center: Vector3Tuple, radius: number, segments: number) {
  const positions: number[] = [];
  appendCircle(positions, segments, (angle) => [center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius]);
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createDashedOrbit(center: Vector3Tuple, radius: number, segments: number) {
  const positions: number[] = [];

  for (let i = 0; i < segments; i += 1) {
    if (i % 5 === 3 || i % 5 === 4) continue;
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 0.62) / segments) * Math.PI * 2;
    positions.push(
      center[0] + Math.cos(a) * radius,
      center[1],
      center[2] + Math.sin(a) * radius,
      center[0] + Math.cos(b) * radius,
      center[1],
      center[2] + Math.sin(b) * radius
    );
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createOrbitTicks(center: Vector3Tuple, radius: number, count: number, length: number) {
  const positions: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const major = i % 6 === 0;
    const inner = radius - length * (major ? 1.45 : 0.7);
    const outer = radius + length * (major ? 1.45 : 0.7);
    positions.push(
      center[0] + Math.cos(angle) * inner,
      center[1],
      center[2] + Math.sin(angle) * inner,
      center[0] + Math.cos(angle) * outer,
      center[1],
      center[2] + Math.sin(angle) * outer
    );
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createOrbitDots(center: Vector3Tuple, radius: number, count: number) {
  const dots = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const drift = (hash(i * 4.9) - 0.5) * 0.08;
    dots[i * 3] = center[0] + Math.cos(angle) * (radius + drift);
    dots[i * 3 + 1] = center[1] + (hash(i * 6.2) - 0.5) * 0.04;
    dots[i * 3 + 2] = center[2] + Math.sin(angle) * (radius + drift);
  }

  return dots;
}

function appendCircle(positions: number[], segments: number, resolve: (angle: number) => Vector3Tuple) {
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const from = resolve(a);
    const to = resolve(b);
    positions.push(from[0], from[1], from[2], to[0], to[1], to[2]);
  }
}

function hash(value: number) {
  return THREE.MathUtils.euclideanModulo(Math.sin(value * 12.9898) * 43758.5453, 1);
}
