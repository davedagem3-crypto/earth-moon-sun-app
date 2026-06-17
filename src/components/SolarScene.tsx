import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { memo, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AstronomySnapshot, Vector3Tuple } from '../types';

type SolarSceneProps = {
  className?: string;
  interactive?: boolean;
  snapshot: AstronomySnapshot;
};

type BodyKind = 'sun' | 'earth' | 'moon';

type OrbitPlane = {
  origin: THREE.Vector3;
  radius: number;
  u: THREE.Vector3;
  v: THREE.Vector3;
};

const BODY = {
  sun: {
    label: '太阳',
    radius: 2.9,
    line: '#706e66',
    ray: '#302f2a',
    spin: 0.00042
  },
  earth: {
    label: '地球',
    radius: 1.28,
    line: '#4f545b',
    spin: 0.00105
  },
  moon: {
    label: '月亮',
    radius: 0.56,
    line: '#74777a',
    spin: 0.00034
  }
} satisfies Record<
  BodyKind,
  {
    label: string;
    line: string;
    ray?: string;
    radius: number;
    spin: number;
  }
>;

export default function SolarScene({ className, interactive = true, snapshot }: SolarSceneProps) {
  return (
    <Canvas className={className} camera={{ position: [16, 12, 30], fov: 47 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#000102']} />
      <Scene snapshot={snapshot} />
      {interactive && <OrbitControls enableDamping dampingFactor={0.08} minDistance={10} maxDistance={86} />}
    </Canvas>
  );
}

function Scene({ snapshot }: SolarSceneProps) {
  const solarPlane = useMemo(() => createOrbitPlane(snapshot.positions.sun, snapshot.positions.earth), [snapshot.positions.earth, snapshot.positions.sun]);
  const lunarPlane = useMemo(() => createOrbitPlane(snapshot.positions.earth, snapshot.positions.moon), [snapshot.positions.earth, snapshot.positions.moon]);

  return (
    <>
      <StarField />
      <OrbitLines kind="solar" plane={solarPlane} />
      <OrbitLines kind="lunar" plane={lunarPlane} />

      <LineBody
        kind="sun"
        lightDirection={[0, 0, 1]}
        solarPlane={solarPlane}
        position={snapshot.positions.sun}
      />
      <LineBody kind="earth" lightDirection={snapshot.lightDirections.earth} position={snapshot.positions.earth} tilt={0.41} />
      <LineBody kind="moon" lightDirection={snapshot.lightDirections.moon} position={snapshot.positions.moon} />
    </>
  );
}

type LineBodyProps = {
  kind: BodyKind;
  lightDirection: Vector3Tuple;
  position: Vector3Tuple;
  solarPlane?: OrbitPlane;
  tilt?: number;
};

const LineBody = memo(function LineBody({ kind, lightDirection, position, solarPlane, tilt = 0 }: LineBodyProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const body = BODY[kind];
  const silhouetteLines = useMemo(() => createSilhouetteLines(kind), [kind]);
  const structureLines = useMemo(() => createStructureLines(kind), [kind]);
  const featureLines = useMemo(() => createFeatureLines(kind), [kind]);
  const phaseLine = useMemo(() => (kind === 'moon' ? createMoonPhaseBoundary(BODY.moon.radius, lightDirection) : null), [kind, lightDirection]);

  useFrame(() => {
    if (groupRef.current && kind !== 'sun') {
      groupRef.current.rotation.y += body.spin;
    }
  });

  return (
    <group position={position} rotation={[0, 0, tilt]} ref={groupRef}>
      {kind === 'sun' && solarPlane && <SolarLinework plane={solarPlane} radius={body.radius} />}

      <lineSegments geometry={silhouetteLines}>
        <lineBasicMaterial color={body.line} opacity={kind === 'sun' ? 0.82 : 0.76} transparent />
      </lineSegments>

      <lineSegments geometry={structureLines}>
        <lineBasicMaterial color={body.line} opacity={kind === 'earth' ? 0.58 : 0.44} transparent />
      </lineSegments>

      <lineSegments geometry={featureLines}>
        <lineBasicMaterial color={body.line} opacity={kind === 'sun' ? 0.38 : 0.64} transparent />
      </lineSegments>

      {phaseLine && (
        <lineSegments geometry={phaseLine}>
          <lineBasicMaterial color={body.line} opacity={0.78} transparent />
        </lineSegments>
      )}

      <mesh onPointerOut={() => setHovered(false)} onPointerOver={() => setHovered(true)}>
        <sphereGeometry args={[body.radius * 1.18, 24, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hovered && (
        <Html center distanceFactor={8} position={[0, body.radius + 0.72, 0]}>
          <div className="body-label">{body.label}</div>
        </Html>
      )}
    </group>
  );
});

function SolarLinework({ plane, radius }: { plane: OrbitPlane; radius: number }) {
  const rays = useMemo(() => createTaperedSunRayMesh(radius, 72, plane), [plane, radius]);
  const rings = useMemo(() => createPlaneRings(radius, [1.12, 1.32, 1.58, 1.9], plane), [plane, radius]);
  const sphereContours = useMemo(() => createSolarSphereContours(radius), [radius]);

  return (
    <>
      <mesh geometry={rays}>
        <meshBasicMaterial color={BODY.sun.ray} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={rings}>
        <lineBasicMaterial color={BODY.sun.line} opacity={0.22} transparent />
      </lineSegments>
      <lineSegments geometry={sphereContours}>
        <lineBasicMaterial color={BODY.sun.line} opacity={0.8} transparent />
      </lineSegments>
    </>
  );
}

function OrbitLines({ kind, plane }: { kind: 'solar' | 'lunar'; plane: OrbitPlane }) {
  const major = useMemo(() => createOrbitRing(plane, kind === 'solar' ? 360 : 180), [kind, plane]);
  const dust = useMemo(() => (kind === 'solar' ? createOrbitPlaneDust(plane, 96) : null), [kind, plane]);

  return (
    <>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#7b7c7e" opacity={kind === 'solar' ? 0.46 : 0.52} transparent />
      </lineSegments>
      {dust && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={dust} count={dust.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial color="#ffffff" opacity={0.8} size={0.42} sizeAttenuation={false} transparent />
        </points>
      )}
    </>
  );
}

function StarField() {
  const stars = useMemo(() => createStars(), []);
  const chartLines = useMemo(() => createChartLines(), []);

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={stars} count={stars.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#c8cace" opacity={0.2} size={0.72} sizeAttenuation={false} transparent />
      </points>
      <lineSegments geometry={chartLines}>
        <lineBasicMaterial color="#c8cace" opacity={0.07} transparent />
      </lineSegments>
    </>
  );
}

function createSilhouetteLines(kind: BodyKind) {
  const radius = BODY[kind].radius;
  const positions: number[] = [];
  appendCircleSegments(positions, 180, (angle) => [Math.cos(angle) * radius * 1.012, Math.sin(angle) * radius * 1.012, 0]);
  appendCircleSegments(positions, 180, (angle) => [Math.cos(angle) * radius * 1.012, 0, Math.sin(angle) * radius * 1.012]);
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createStructureLines(kind: BodyKind) {
  const radius = BODY[kind].radius;
  const positions: number[] = [];
  if (kind === 'sun') {
    return createFlatRings(radius, [0.56, 0.74, 0.92]);
  }

  const latitudes = kind === 'moon' ? [-0.48, 0, 0.48] : [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72];
  const meridians = kind === 'earth' ? 12 : 5;

  latitudes.forEach((latitude) => {
    const y = radius * latitude;
    const ringRadius = Math.sqrt(Math.max(0, radius * radius - y * y));
    appendCircleSegments(positions, 96, (angle) => [Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius]);
  });

  for (let i = 0; i < meridians; i += 1) {
    const turn = (i / meridians) * Math.PI;
    appendCircleSegments(positions, 96, (angle) => {
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return [Math.cos(turn) * x, y, Math.sin(turn) * x];
    });
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createFeatureLines(kind: BodyKind) {
  if (kind === 'sun') return createFlatRings(BODY.sun.radius, [0.72, 0.88, 1.04]);
  if (kind === 'earth') return createEarthSurfaceLines(BODY.earth.radius);
  return createMoonCraterLines(BODY.moon.radius);
}

function createTaperedSunRayMesh(radius: number, count: number, plane: OrbitPlane) {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const primary = i % 6 === 0;
    const secondary = i % 3 === 0;
    const startRadius = radius * 1.36;
    const endRadius = radius * (primary ? 5.35 : secondary ? 4.45 : 3.72);
    const rootWidth = radius * (primary ? 0.092 : secondary ? 0.072 : 0.054);
    const tipWidth = radius * (primary ? 0.009 : 0.006);
    const dir = plane.u.clone().multiplyScalar(Math.cos(angle)).add(plane.v.clone().multiplyScalar(Math.sin(angle))).normalize();
    const tangent = plane.v.clone().multiplyScalar(Math.cos(angle)).add(plane.u.clone().multiplyScalar(-Math.sin(angle))).normalize();
    const startCenter = dir.clone().multiplyScalar(startRadius);
    const endCenter = dir.clone().multiplyScalar(endRadius);
    const baseIndex = positions.length / 3;
    const leftRoot = startCenter.clone().add(tangent.clone().multiplyScalar(rootWidth));
    const rightRoot = startCenter.clone().add(tangent.clone().multiplyScalar(-rootWidth));
    const leftTip = endCenter.clone().add(tangent.clone().multiplyScalar(tipWidth));
    const rightTip = endCenter.clone().add(tangent.clone().multiplyScalar(-tipWidth));

    positions.push(leftRoot.x, leftRoot.y, leftRoot.z, rightRoot.x, rightRoot.y, rightRoot.z, leftTip.x, leftTip.y, leftTip.z, rightTip.x, rightTip.y, rightTip.z);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2);
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)).setIndex(indices);
}

function createSolarSphereContours(radius: number) {
  const positions: number[] = [];
  const turns = [0, Math.PI / 8, Math.PI / 4, (Math.PI * 3) / 8, Math.PI / 2, (Math.PI * 5) / 8, (Math.PI * 3) / 4, (Math.PI * 7) / 8];
  const latitudes = [-0.64, -0.38, -0.16, 0.16, 0.38, 0.64];

  turns.forEach((turn) => {
    appendCircleSegments(positions, 128, (angle) => {
      const x = Math.cos(angle) * radius * 1.006;
      const y = Math.sin(angle) * radius * 1.006;
      return [Math.cos(turn) * x, y, Math.sin(turn) * x];
    });
  });

  latitudes.forEach((latitude) => {
    const y = radius * latitude;
    const ringRadius = Math.sqrt(Math.max(0, radius * radius - y * y));
    appendCircleSegments(positions, 128, (angle) => [Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius]);
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createSolarCoronaLines(radius: number) {
  const positions: number[] = [];
  const count = 36;

  for (let i = 0; i < count; i += 1) {
    const base = (i / count) * Math.PI * 2;
    const spread = 0.045 + (i % 3) * 0.012;
    const inner = radius * 1.04;
    const outer = radius * (1.62 + (i % 4) * 0.16);
    positions.push(
      Math.cos(base - spread) * inner,
      0,
      Math.sin(base - spread) * inner,
      Math.cos(base) * outer,
      0,
      Math.sin(base) * outer,
      Math.cos(base) * outer,
      0,
      Math.sin(base) * outer,
      Math.cos(base + spread) * inner,
      0,
      Math.sin(base + spread) * inner
    );
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createFlatRings(radius: number, multipliers: number[]) {
  const positions: number[] = [];
  multipliers.forEach((multiplier) => {
    appendCircleSegments(positions, 160, (angle) => [Math.cos(angle) * radius * multiplier, 0, Math.sin(angle) * radius * multiplier]);
  });
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createPlaneRings(radius: number, multipliers: number[], plane: OrbitPlane) {
  const positions: number[] = [];

  multipliers.forEach((multiplier) => {
    appendCircleSegments(positions, 160, (angle) => {
      const point = plane.u
        .clone()
        .multiplyScalar(Math.cos(angle) * radius * multiplier)
        .add(plane.v.clone().multiplyScalar(Math.sin(angle) * radius * multiplier));
      return [point.x, point.y, point.z];
    });
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createEarthSurfaceLines(radius: number) {
  const positions: number[] = [];
  const contours: Vector3Tuple[][] = [
    [
      [-0.32, 0.52, 0.8],
      [-0.08, 0.38, 0.92],
      [0.17, 0.16, 0.97],
      [0.08, -0.16, 0.98],
      [-0.2, -0.4, 0.9]
    ],
    [
      [0.44, 0.38, 0.81],
      [0.62, 0.12, 0.78],
      [0.52, -0.14, 0.84],
      [0.28, -0.36, 0.89]
    ],
    [
      [-0.66, 0.18, 0.73],
      [-0.52, -0.02, 0.85],
      [-0.62, -0.26, 0.74]
    ]
  ];

  contours.forEach((contour) => {
    for (let i = 0; i < contour.length - 1; i += 1) {
      const from = new THREE.Vector3(...contour[i]).normalize().multiplyScalar(radius * 1.024);
      const to = new THREE.Vector3(...contour[i + 1]).normalize().multiplyScalar(radius * 1.024);
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createMoonCraterLines(radius: number) {
  const positions: number[] = [];
  const craters: Array<{ normal: Vector3Tuple; size: number }> = [
    { normal: [0.2, 0.35, 0.92], size: 0.18 },
    { normal: [-0.32, -0.12, 0.94], size: 0.13 },
    { normal: [0.42, -0.36, 0.82], size: 0.1 },
    { normal: [-0.04, 0.08, 0.99], size: 0.08 }
  ];

  craters.forEach(({ normal, size }) => {
    const n = new THREE.Vector3(...normal).normalize();
    const seed = Math.abs(n.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(n, seed).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
    const center = n.clone().multiplyScalar(radius * 1.026);

    appendCircleSegments(positions, 48, (angle) => {
      const point = center
        .clone()
        .add(t1.clone().multiplyScalar(Math.cos(angle) * radius * size))
        .add(t2.clone().multiplyScalar(Math.sin(angle) * radius * size));
      return [point.x, point.y, point.z];
    });
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createMoonPhaseBoundary(radius: number, lightDirection: Vector3Tuple) {
  const positions: number[] = [];
  const n = new THREE.Vector3(...lightDirection).normalize();
  const seed = Math.abs(n.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(n, seed).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();

  appendCircleSegments(positions, 120, (angle) => {
    const point = t1
      .clone()
      .multiplyScalar(Math.cos(angle) * radius * 1.022)
      .add(t2.clone().multiplyScalar(Math.sin(angle) * radius * 1.022));
    return [point.x, point.y, point.z];
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createOrbitPlane(center: Vector3Tuple, target: Vector3Tuple): OrbitPlane {
  const origin = new THREE.Vector3(...center);
  const radial = new THREE.Vector3(...target).sub(origin);
  const radius = radial.length() || 1;
  const u = radial.normalize();
  const reference = Math.abs(u.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3().crossVectors(reference, u).normalize();

  return { origin, radius, u, v };
}

function createOrbitRing(plane: OrbitPlane, segments: number) {
  const positions: number[] = [];
  appendCircleSegments(positions, segments, (angle) => {
    const point = plane.origin
      .clone()
      .add(plane.u.clone().multiplyScalar(Math.cos(angle) * plane.radius))
      .add(plane.v.clone().multiplyScalar(Math.sin(angle) * plane.radius));
    return [point.x, point.y, point.z];
  });
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createOrbitPlaneDust(plane: OrbitPlane, count: number) {
  const dust = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const angle = hash(i * 9.73) * Math.PI * 2;
    const distance = plane.radius * Math.sqrt(hash(i * 12.41)) * 0.96;
    const point = plane.origin
      .clone()
      .add(plane.u.clone().multiplyScalar(Math.cos(angle) * distance))
      .add(plane.v.clone().multiplyScalar(Math.sin(angle) * distance));

    dust[i * 3] = point.x;
    dust[i * 3 + 1] = point.y;
    dust[i * 3 + 2] = point.z;
  }

  return dust;
}

function createStars() {
  const count = 18;
  const stars = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    stars[i * 3] = (hash(i * 1.77) - 0.5) * 86;
    stars[i * 3 + 1] = (hash(i * 2.91) - 0.5) * 46;
    stars[i * 3 + 2] = -18 - hash(i * 5.03) * 42;
  }

  return stars;
}

function createChartLines() {
  const positions: number[] = [];
  const groups = [
    [
      [-24, 13, -34],
      [-20, 16, -35],
      [-16, 14, -36],
      [-13, 18, -35]
    ],
    [
      [17, -13, -32],
      [22, -10, -34],
      [26, -14, -33],
      [30, -11, -36]
    ]
  ] satisfies Vector3Tuple[][];

  groups.forEach((group) => {
    for (let i = 0; i < group.length - 1; i += 1) {
      positions.push(...group[i], ...group[i + 1]);
    }
  });

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function appendCircleSegments(positions: number[], segments: number, resolve: (angle: number) => Vector3Tuple) {
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
