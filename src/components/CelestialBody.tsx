import { Html, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BODY_STYLE, hash, makeBodyMaterial, mixBodyColor, type BodyKind } from './ParticleMaterial';
import type { Vector3Tuple } from '../types';

type CelestialBodyProps = {
  kind: BodyKind;
  lightDirection: Vector3Tuple;
  position: Vector3Tuple;
  tilt?: number;
};

type Particle = {
  normal: THREE.Vector3;
  position: THREE.Vector3;
  scale: number;
  seed: number;
};

type PointLayer = {
  colors: Float32Array;
  normals: Float32Array;
  positions: Float32Array;
  size: number;
};

const matrix = new THREE.Matrix4();
const color = new THREE.Color();
const vector = new THREE.Vector3();
const lightVector = new THREE.Vector3();

const CelestialBody = memo(function CelestialBody({ kind, lightDirection, position, tilt = 0 }: CelestialBodyProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointRefs = useRef<Array<THREE.Points | null>>([]);
  const style = BODY_STYLE[kind];
  const material = useMemo(() => makeBodyMaterial(kind), [kind]);
  const particleGeometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);
  const particles = useMemo(() => createParticles(kind), [kind]);
  const pointLayers = useMemo(() => createPointLayers(kind), [kind]);
  const identityLines = useMemo(() => createIdentityLines(kind), [kind]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    particles.forEach((particle, index) => {
      matrix.makeScale(particle.scale, particle.scale, particle.scale);
      matrix.setPosition(particle.position);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(style.core));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles, style.core]);

  useFrame(({ clock }) => {
    lightVector.set(...lightDirection).normalize();

    const mesh = meshRef.current;
    if (mesh) {
      particles.forEach((particle, index) => {
        const light = resolveLight(kind, particle.normal, lightVector, style.minLight);
        const sparkle = kind === 'sun' ? 0.92 + Math.sin(clock.elapsedTime * 1.4 + particle.seed) * 0.08 : 1;
        mixBodyColor(color, kind, light * sparkle);
        mesh.setColorAt(index, color);
      });

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    pointLayers.forEach((layer, layerIndex) => {
      const points = pointRefs.current[layerIndex];
      if (!points) return;

      for (let i = 0; i < layer.positions.length / 3; i += 1) {
        vector.set(layer.normals[i * 3], layer.normals[i * 3 + 1], layer.normals[i * 3 + 2]);
        const light = resolveLight(kind, vector, lightVector, style.minLight);
        mixBodyColor(color, kind, light);
        layer.colors[i * 3] = color.r;
        layer.colors[i * 3 + 1] = color.g;
        layer.colors[i * 3 + 2] = color.b;
      }

      points.geometry.attributes.color.needsUpdate = true;
    });

    if (groupRef.current) {
      groupRef.current.rotation.y += style.spin;
    }
  });

  return (
    <group position={position} rotation={[0, 0, tilt]} ref={groupRef}>
      {kind === 'sun' && <SunIdentity radius={style.radius} />}
      {kind === 'earth' && <EarthGlow radius={style.radius} />}
      {kind === 'moon' && <MoonEdgeGlow radius={style.radius} />}

      <lineSegments geometry={identityLines}>
        <lineBasicMaterial color={style.line} opacity={kind === 'sun' ? 0.52 : kind === 'earth' ? 0.72 : 0.62} transparent />
      </lineSegments>

      <instancedMesh
        args={[particleGeometry, material, particles.length]}
        ref={meshRef}
        onPointerOut={() => setHovered(false)}
        onPointerOver={() => setHovered(true)}
      />

      {pointLayers.map((layer, index) => (
        <points
          key={`${kind}-points-${index}`}
          ref={(instance) => {
            pointRefs.current[index] = instance;
          }}
          onPointerOut={() => setHovered(false)}
          onPointerOver={() => setHovered(true)}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={layer.positions} count={layer.positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={layer.colors} count={layer.colors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial color="#ffffff" depthWrite={false} opacity={0.96} size={layer.size} sizeAttenuation={false} transparent vertexColors />
        </points>
      ))}

      {kind === 'earth' && <EarthContinents radius={style.radius} />}
      {kind === 'moon' && <MoonCraters radius={style.radius} />}

      {hovered && (
        <Html center distanceFactor={8} position={[0, style.radius + 0.72, 0]}>
          <div className="body-label">{style.label}</div>
        </Html>
      )}
    </group>
  );
});

export default CelestialBody;

function SunIdentity({ radius }: { radius: number }) {
  const rays = useMemo(() => createSunburst(radius), [radius]);
  const rings = useMemo(() => createWobbledRings(radius, [1.18, 1.34, 1.52]), [radius]);

  return (
    <>
      <Corona radius={radius} />
      <lineSegments geometry={rays}>
        <lineBasicMaterial color="#FFF6D0" opacity={0.72} transparent />
      </lineSegments>
      <lineSegments geometry={rings}>
        <lineBasicMaterial color="#F2D88A" opacity={0.42} transparent />
      </lineSegments>
    </>
  );
}

function Corona({ radius }: { radius: number }) {
  return (
    <Billboard follow>
      {[1.32, 1.58, 1.86, 2.18].map((scale, index) => (
        <mesh key={`corona-${scale}`} renderOrder={-2} scale={[radius * scale, radius * scale, 1]}>
          <ringGeometry args={[0.96, 1, 96]} />
          <meshBasicMaterial color={index < 2 ? '#FFF6D0' : '#F2D88A'} depthWrite={false} opacity={0.16 - index * 0.028} side={THREE.DoubleSide} transparent />
        </mesh>
      ))}
    </Billboard>
  );
}

function EarthGlow({ radius }: { radius: number }) {
  return (
    <Billboard follow>
      <mesh scale={[radius * 1.42, radius * 1.42, 1]}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial color="#5D7CFF" depthWrite={false} opacity={0.14} side={THREE.DoubleSide} transparent />
      </mesh>
    </Billboard>
  );
}

function MoonEdgeGlow({ radius }: { radius: number }) {
  return (
    <Billboard follow>
      <mesh scale={[radius * 1.46, radius * 1.46, 1]}>
        <ringGeometry args={[0.94, 1, 72]} />
        <meshBasicMaterial color="#8b7cff" depthWrite={false} opacity={0.035} side={THREE.DoubleSide} transparent />
      </mesh>
    </Billboard>
  );
}

function EarthContinents({ radius }: { radius: number }) {
  const geometry = useMemo(() => createEarthContinents(radius), [radius]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#D8DDE8" opacity={0.68} transparent />
    </lineSegments>
  );
}

function MoonCraters({ radius }: { radius: number }) {
  const rings = useMemo(() => createMoonCraterRings(radius), [radius]);
  const dots = useMemo(() => createMoonCraterDots(radius), [radius]);

  return (
    <>
      <lineSegments geometry={rings}>
        <lineBasicMaterial color="#E1E6EE" opacity={0.58} transparent />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={dots} count={dots.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#E1E6EE" opacity={0.72} size={1.25} sizeAttenuation={false} transparent />
      </points>
    </>
  );
}

function createParticles(kind: BodyKind): Particle[] {
  const style = BODY_STYLE[kind];
  const particles: Particle[] = [];
  const increment = Math.PI * (3 - Math.sqrt(5));
  const offset = 2 / style.particleCount;

  for (let i = 0; i < style.particleCount; i += 1) {
    const y = i * offset - 1 + offset / 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * increment;
    const normal = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring).normalize();
    const scale = THREE.MathUtils.lerp(style.particleSize[0], style.particleSize[1], Math.pow(hash(i * 11.91), 1.7));
    const lift = 1 + (hash(i * 5.37) - 0.5) * 0.012;
    particles.push({
      normal,
      position: normal.clone().multiplyScalar(style.radius * lift),
      scale,
      seed: hash(i * 17.3) * Math.PI * 2
    });
  }

  return particles;
}

function createPointLayers(kind: BodyKind): PointLayer[] {
  const style = BODY_STYLE[kind];

  return style.points.map((layer, layerIndex) => {
    const positions = new Float32Array(layer.count * 3);
    const normals = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    const increment = Math.PI * (3 - Math.sqrt(5));
    const offset = 2 / layer.count;

    for (let i = 0; i < layer.count; i += 1) {
      const y = i * offset - 1 + offset / 2;
      const ring = Math.sqrt(1 - y * y);
      const angle = i * increment + layerIndex * 0.82;
      const normal = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring).normalize();
      const lift = style.radius * (1 + (hash(i * 7.13 + layerIndex) - 0.5) * layer.lift);

      positions[i * 3] = normal.x * lift;
      positions[i * 3 + 1] = normal.y * lift;
      positions[i * 3 + 2] = normal.z * lift;
      normals[i * 3] = normal.x;
      normals[i * 3 + 1] = normal.y;
      normals[i * 3 + 2] = normal.z;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }

    return { colors, normals, positions, size: layer.size };
  });
}

function createIdentityLines(kind: BodyKind) {
  const style = BODY_STYLE[kind];
  const positions: number[] = [];
  const radius = style.radius;

  appendCircle(positions, 128, (angle) => [Math.cos(angle) * radius * 1.012, Math.sin(angle) * radius * 1.012, 0]);
  appendCircle(positions, 128, (angle) => [Math.cos(angle) * radius * 1.012, 0, Math.sin(angle) * radius * 1.012]);

  if (kind === 'earth') {
    [-0.72, -0.42, -0.16, 0.16, 0.42, 0.72].forEach((lat) => {
      const y = radius * lat;
      const r = Math.sqrt(Math.max(0, radius * radius - y * y));
      appendCircle(positions, 96, (angle) => [Math.cos(angle) * r, y, Math.sin(angle) * r]);
    });

    for (let i = 0; i < 10; i += 1) {
      const turn = (i / 10) * Math.PI;
      appendCircle(positions, 96, (angle) => {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return [Math.cos(turn) * x, y, Math.sin(turn) * x];
      });
    }
  }

  if (kind === 'moon') {
    [-0.5, 0, 0.5].forEach((lat) => {
      const y = radius * lat;
      const r = Math.sqrt(Math.max(0, radius * radius - y * y));
      appendCircle(positions, 72, (angle) => [Math.cos(angle) * r, y, Math.sin(angle) * r]);
    });
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createSunburst(radius: number) {
  const positions: number[] = [];
  const count = 42;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const major = i % 6 === 0;
    const secondary = i % 2 === 0;
    const start = radius * (1.1 + hash(i * 2.7) * 0.08);
    const end = radius * (major ? 4.05 : secondary ? 3.35 : 2.78) * (0.92 + hash(i * 5.1) * 0.18);
    positions.push(Math.cos(angle) * start, 0, Math.sin(angle) * start, Math.cos(angle) * end, 0, Math.sin(angle) * end);
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createWobbledRings(radius: number, multipliers: number[]) {
  const positions: number[] = [];

  multipliers.forEach((multiplier, ringIndex) => {
    appendCircle(positions, 160, (angle) => {
      const wobble = 1 + Math.sin(angle * 7 + ringIndex) * 0.012 + Math.sin(angle * 13) * 0.006;
      return [Math.cos(angle) * radius * multiplier * wobble, 0, Math.sin(angle) * radius * multiplier * wobble];
    });
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createEarthContinents(radius: number) {
  const positions: number[] = [];
  const contours: Vector3Tuple[][] = [
    [
      [-0.28, 0.52, 0.82],
      [0.02, 0.33, 0.94],
      [0.2, 0.05, 0.98],
      [0.06, -0.22, 0.96],
      [-0.18, -0.44, 0.86]
    ],
    [
      [0.45, 0.38, 0.8],
      [0.63, 0.14, 0.76],
      [0.52, -0.14, 0.84],
      [0.28, -0.36, 0.88]
    ],
    [
      [-0.66, 0.18, 0.72],
      [-0.5, -0.06, 0.86],
      [-0.62, -0.34, 0.7]
    ],
    [
      [0.05, 0.62, 0.78],
      [0.25, 0.48, 0.84],
      [0.14, 0.32, 0.94]
    ]
  ];

  contours.forEach((contour) => {
    for (let i = 0; i < contour.length - 1; i += 1) {
      const from = new THREE.Vector3(...contour[i]).normalize().multiplyScalar(radius * 1.035);
      const to = new THREE.Vector3(...contour[i + 1]).normalize().multiplyScalar(radius * 1.035);
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createMoonCraterRings(radius: number) {
  const positions: number[] = [];
  const craters: Array<{ normal: Vector3Tuple; size: number }> = [
    { normal: [0.22, 0.34, 0.92], size: 0.18 },
    { normal: [-0.34, -0.14, 0.94], size: 0.13 },
    { normal: [0.42, -0.36, 0.82], size: 0.1 },
    { normal: [-0.1, 0.02, 0.99], size: 0.08 },
    { normal: [0.12, -0.55, 0.82], size: 0.07 }
  ];

  craters.forEach(({ normal, size }) => {
    appendSurfaceCircle(positions, normal, radius * 1.04, radius * size, 42);
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createMoonCraterDots(radius: number) {
  const count = 46;
  const dots = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const normal = new THREE.Vector3(hash(i * 2.2) - 0.5, hash(i * 3.4) - 0.5, 0.64 + hash(i * 4.6) * 0.5).normalize();
    const point = normal.multiplyScalar(radius * 1.055);
    dots[i * 3] = point.x;
    dots[i * 3 + 1] = point.y;
    dots[i * 3 + 2] = point.z;
  }

  return dots;
}

function appendSurfaceCircle(positions: number[], normal: Vector3Tuple, radius: number, size: number, segments: number) {
  const n = new THREE.Vector3(...normal).normalize();
  const seed = Math.abs(n.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(n, seed).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  const center = n.clone().multiplyScalar(radius);

  appendCircle(positions, segments, (angle) => {
    const point = center.clone().add(t1.clone().multiplyScalar(Math.cos(angle) * size)).add(t2.clone().multiplyScalar(Math.sin(angle) * size));
    return [point.x, point.y, point.z];
  });
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

function resolveLight(kind: BodyKind, normal: THREE.Vector3, light: THREE.Vector3, minLight: number) {
  if (kind === 'sun') return 1;
  const value = Math.max(minLight, (normal.dot(light) + 1) / 2);
  return kind === 'moon' ? Math.pow(value, 1.9) : Math.pow(value, 1.18);
}
