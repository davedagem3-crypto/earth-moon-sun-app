import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { memo, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AstronomySnapshot, Vector3Tuple } from '../types';

type SolarSceneProps = {
  snapshot: AstronomySnapshot;
};

type BodyKind = 'sun' | 'earth' | 'moon';

type PointCloud = {
  colors: Float32Array;
  normals: Float32Array;
  positions: Float32Array;
  size: number;
};

const BODY = {
  sun: {
    label: '太阳',
    radius: 2.9,
    minLight: 0.82,
    spin: 0.0006,
    layers: [
      { count: 980, lift: 0.004, size: 0.68 },
      { count: 300, lift: 0.018, size: 0.95 },
      { count: 90, lift: 0.036, size: 1.28 }
    ],
    gridOpacity: 0.46
  },
  earth: {
    label: '地球',
    radius: 1.28,
    minLight: 0.2,
    spin: 0.0012,
    layers: [
      { count: 560, lift: 0.004, size: 0.66 },
      { count: 150, lift: 0.017, size: 0.92 },
      { count: 42, lift: 0.028, size: 1.2 }
    ],
    gridOpacity: 0.58
  },
  moon: {
    label: '月亮',
    radius: 0.56,
    minLight: 0.13,
    spin: 0.00045,
    layers: [
      { count: 260, lift: 0.004, size: 0.62 },
      { count: 82, lift: 0.017, size: 0.86 },
      { count: 24, lift: 0.03, size: 1.08 }
    ],
    gridOpacity: 0.62
  }
} satisfies Record<
  BodyKind,
  {
    gridOpacity: number;
    label: string;
    layers: Array<{ count: number; lift: number; size: number }>;
    minLight: number;
    radius: number;
    spin: number;
  }
>;

const tempNormal = new THREE.Vector3();
const tempLight = new THREE.Vector3();

export default function SolarScene({ snapshot }: SolarSceneProps) {
  return (
    <Canvas camera={{ position: [16, 12, 30], fov: 47 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#000102']} />
      <Scene snapshot={snapshot} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={10} maxDistance={86} />
    </Canvas>
  );
}

function Scene({ snapshot }: SolarSceneProps) {
  return (
    <>
      <StarField />
      <OrbitLines center={[0, 0, 0]} radius={18} kind="solar" />
      <OrbitLines center={snapshot.positions.earth} radius={3.8} kind="lunar" />

      <DotLineBody kind="sun" lightDirection={[0, 0, 1]} position={snapshot.positions.sun} />
      <DotLineBody kind="earth" lightDirection={snapshot.lightDirections.earth} position={snapshot.positions.earth} tilt={0.41} />
      <DotLineBody kind="moon" lightDirection={snapshot.lightDirections.moon} position={snapshot.positions.moon} />
    </>
  );
}

type DotLineBodyProps = {
  kind: BodyKind;
  lightDirection: Vector3Tuple;
  position: Vector3Tuple;
  tilt?: number;
};

const DotLineBody = memo(function DotLineBody({ kind, lightDirection, position, tilt = 0 }: DotLineBodyProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const pointRefs = useRef<Array<THREE.Points | null>>([]);
  const body = BODY[kind];
  const clouds = useMemo(() => createBodyPointClouds(kind), [kind]);
  const globeLines = useMemo(() => createGlobeLines(kind), [kind]);
  const featureLines = useMemo(() => createFeatureLines(kind), [kind]);

  useFrame(() => {
    tempLight.set(...lightDirection).normalize();

    clouds.forEach((cloud, cloudIndex) => {
      const points = pointRefs.current[cloudIndex];
      if (!points) return;

      for (let i = 0; i < cloud.positions.length / 3; i += 1) {
        tempNormal.set(cloud.normals[i * 3], cloud.normals[i * 3 + 1], cloud.normals[i * 3 + 2]).normalize();
        const rawLight = kind === 'sun' ? 1 : (tempNormal.dot(tempLight) + 1) / 2;
        const value = Math.max(body.minLight, Math.pow(rawLight, kind === 'moon' ? 1.9 : 1.35));
        const tone = kind === 'sun' ? 0.72 + value * 0.28 : 0.24 + value * 0.76;

        cloud.colors[i * 3] = tone;
        cloud.colors[i * 3 + 1] = tone;
        cloud.colors[i * 3 + 2] = tone;
      }

      points.geometry.attributes.color.needsUpdate = true;
    });

    if (groupRef.current) {
      groupRef.current.rotation.y += body.spin;
    }
  });

  return (
    <group position={position} rotation={[0, 0, tilt]} ref={groupRef}>
      {kind === 'sun' && <RegularSunburst radius={body.radius} />}

      <lineSegments geometry={globeLines}>
        <lineBasicMaterial color="#e7e9ee" opacity={body.gridOpacity} transparent />
      </lineSegments>

      <lineSegments geometry={featureLines}>
        <lineBasicMaterial color="#ffffff" opacity={kind === 'sun' ? 0.32 : 0.5} transparent />
      </lineSegments>

      {clouds.map((cloud, index) => (
        <points
          key={`${kind}-cloud-${index}`}
          ref={(instance) => {
            pointRefs.current[index] = instance;
          }}
          onPointerOut={() => setHovered(false)}
          onPointerOver={() => setHovered(true)}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={cloud.positions} count={cloud.positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={cloud.colors} count={cloud.colors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            alphaTest={0.08}
            color="#ffffff"
            depthWrite={false}
            opacity={kind === 'sun' ? 0.96 : 0.92}
            size={cloud.size}
            sizeAttenuation={false}
            transparent
            vertexColors
          />
        </points>
      ))}

      {hovered && (
        <Html center distanceFactor={8} position={[0, body.radius + 0.72, 0]}>
          <div className="body-label">{body.label}</div>
        </Html>
      )}
    </group>
  );
});

function RegularSunburst({ radius }: { radius: number }) {
  const longRays = useMemo(() => createRegularSunRays(radius, 72, 1), [radius]);
  const shortRays = useMemo(() => createRegularSunRays(radius, 72, 0.62), [radius]);
  const rings = useMemo(() => createFlatRings(radius, [1.18, 1.42, 1.68]), [radius]);

  return (
    <>
      <lineSegments geometry={longRays}>
        <lineBasicMaterial color="#ffffff" opacity={0.62} transparent />
      </lineSegments>
      <lineSegments geometry={shortRays}>
        <lineBasicMaterial color="#ffffff" opacity={0.3} transparent />
      </lineSegments>
      <lineSegments geometry={rings}>
        <lineBasicMaterial color="#e7e9ee" opacity={0.28} transparent />
      </lineSegments>
    </>
  );
}

function OrbitLines({ center, kind, radius }: { center: Vector3Tuple; kind: 'solar' | 'lunar'; radius: number }) {
  const major = useMemo(() => createOrbitRing(center, radius, kind === 'solar' ? 360 : 180), [center, kind, radius]);
  const dash = useMemo(() => createOrbitDashes(center, radius, kind === 'solar' ? 180 : 96), [center, kind, radius]);
  const ticks = useMemo(() => createOrbitTicks(center, radius, kind === 'solar' ? 96 : 48, kind === 'solar' ? 0.24 : 0.08), [center, kind, radius]);
  const dots = useMemo(() => createOrbitDots(center, radius, kind === 'solar' ? 260 : 120), [center, kind, radius]);

  return (
    <>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#e7e9ee" opacity={kind === 'solar' ? 0.22 : 0.3} transparent />
      </lineSegments>
      <lineSegments geometry={dash}>
        <lineBasicMaterial color="#ffffff" opacity={kind === 'solar' ? 0.42 : 0.52} transparent />
      </lineSegments>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color="#ffffff" opacity={kind === 'solar' ? 0.34 : 0.42} transparent />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={dots} count={dots.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" opacity={kind === 'solar' ? 0.5 : 0.62} size={kind === 'solar' ? 0.92 : 1.12} sizeAttenuation={false} transparent />
      </points>
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
        <pointsMaterial color="#ffffff" opacity={0.34} size={1.05} sizeAttenuation={false} transparent />
      </points>
      <lineSegments geometry={chartLines}>
        <lineBasicMaterial color="#d8dde8" opacity={0.12} transparent />
      </lineSegments>
    </>
  );
}

function createBodyPointClouds(kind: BodyKind): PointCloud[] {
  const body = BODY[kind];

  return body.layers.map((layer, layerIndex) => {
    const positions = new Float32Array(layer.count * 3);
    const normals = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    const increment = Math.PI * (3 - Math.sqrt(5));
    const offset = 2 / layer.count;

    for (let i = 0; i < layer.count; i += 1) {
      const y = i * offset - 1 + offset / 2;
      const ring = Math.sqrt(1 - y * y);
      const angle = i * increment + layerIndex * 0.73;
      const normal = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring).normalize();
      const lift = body.radius * (1 + (hash(i * 7.113 + layerIndex * 19.77) - 0.5) * layer.lift);

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

function createGlobeLines(kind: BodyKind) {
  const radius = BODY[kind].radius;
  const positions: number[] = [];
  const latitudes = kind === 'moon' ? [-0.58, -0.22, 0.22, 0.58] : [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72];
  const meridians = kind === 'sun' ? 16 : kind === 'earth' ? 10 : 7;

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

  appendCircleSegments(positions, 160, (angle) => [Math.cos(angle) * radius * 1.012, Math.sin(angle) * radius * 1.012, 0]);
  appendCircleSegments(positions, 160, (angle) => [Math.cos(angle) * radius * 1.012, 0, Math.sin(angle) * radius * 1.012]);

  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createFeatureLines(kind: BodyKind) {
  if (kind === 'sun') return createFlatRings(BODY.sun.radius, [0.72, 0.88, 1.04]);
  if (kind === 'earth') return createEarthSurfaceLines(BODY.earth.radius);
  return createMoonCraterLines(BODY.moon.radius);
}

function createRegularSunRays(radius: number, count: number, lengthScale: number) {
  const positions: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const primary = i % 6 === 0;
    const secondary = i % 3 === 0;
    const start = radius * (primary ? 1.12 : 1.18);
    const end = radius * (primary ? 4.55 : secondary ? 3.72 : 3.18) * lengthScale;

    positions.push(Math.cos(angle) * start, 0, Math.sin(angle) * start, Math.cos(angle) * end, 0, Math.sin(angle) * end);
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

function createOrbitRing(center: Vector3Tuple, radius: number, segments: number) {
  const positions: number[] = [];
  appendCircleSegments(positions, segments, (angle) => [center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius]);
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createOrbitDashes(center: Vector3Tuple, radius: number, segments: number) {
  const positions: number[] = [];

  for (let i = 0; i < segments; i += 1) {
    if (i % 4 === 2) continue;
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 0.54) / segments) * Math.PI * 2;
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
    const major = i % 8 === 0;
    const tick = length * (major ? 1.5 : 0.72);
    const inner = radius - tick;
    const outer = radius + tick;
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
    const wobble = (hash(i * 2.77) - 0.5) * 0.06;
    dots[i * 3] = center[0] + Math.cos(angle) * (radius + wobble);
    dots[i * 3 + 1] = center[1] + (hash(i * 4.31) - 0.5) * 0.03;
    dots[i * 3 + 2] = center[2] + Math.sin(angle) * (radius + wobble);
  }

  return dots;
}

function createStars() {
  const count = 190;
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
