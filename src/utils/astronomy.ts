import type { AstronomySnapshot, ObserverLocation, PhaseName, Vector3Tuple } from '../types';
import {
  Body,
  EclipticGeoMoon,
  Illumination,
  Libration,
  MoonPhase,
  Observer as AstronomyObserver,
  SearchAltitude,
  SearchMoonPhase,
  SearchRiseSet,
  SunPosition
} from 'astronomy-engine';

const SYNODIC_MONTH = 29.530588853;
const DAY_MS = 86_400_000;
const EARTH_ORBIT_SCALE = 18;
const MOON_ORBIT_BASE_SCALE = 3.8;
const DEFAULT_LATITUDE = 41.8057;
const DEFAULT_LONGITUDE = 123.4315;
const DEFAULT_OBSERVER_NAME = '沈阳';

const MAJOR_PHASE_TOLERANCE_DEGREES = 6;

function normalize01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function normalizeVector([x, y, z]: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function subtract(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function phaseNameFromAngle(phaseAngle: number): PhaseName {
  const angle = normalize01(phaseAngle / 360) * 360;

  if (angle < MAJOR_PHASE_TOLERANCE_DEGREES || angle >= 360 - MAJOR_PHASE_TOLERANCE_DEGREES) return '新月';
  if (Math.abs(angle - 90) <= MAJOR_PHASE_TOLERANCE_DEGREES) return '上弦月';
  if (Math.abs(angle - 180) <= MAJOR_PHASE_TOLERANCE_DEGREES) return '满月';
  if (Math.abs(angle - 270) <= MAJOR_PHASE_TOLERANCE_DEGREES) return '下弦月';
  if (angle < 90) return '蛾眉月';
  if (angle < 180) return '盈凸月';
  if (angle < 270) return '亏凸月';
  return '残月';
}

function eclipticLongitude(date: Date): number {
  return ((SunPosition(date).elon + 180) * Math.PI) / 180;
}

function clockFromDate(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function computeMoonAge(date: Date): number {
  const previousNewMoon = SearchMoonPhase(0, date, -40);
  if (!previousNewMoon) return normalize01(MoonPhase(date) / 360) * SYNODIC_MONTH;
  return (date.getTime() - previousNewMoon.date.getTime()) / DAY_MS;
}

function computeNextFullMoonDays(date: Date): number {
  const nextFullMoon = SearchMoonPhase(180, date, 40);
  if (!nextFullMoon) return 0;
  return Math.max(0, (nextFullMoon.date.getTime() - date.getTime()) / DAY_MS);
}

function computeRiseSet(date: Date, observer: ObserverLocation) {
  const astronomyObserver = new AstronomyObserver(observer.latitude, observer.longitude, observer.height ?? 0);
  const start = localDayStart(date);
  const rise = SearchRiseSet(Body.Moon, astronomyObserver, +1, start, 1.15);
  const set = SearchRiseSet(Body.Moon, astronomyObserver, -1, start, 1.15);

  return {
    rise: clockFromDate(rise?.date ?? null),
    set: clockFromDate(set?.date ?? null)
  };
}

function formatTimeRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return '--:-- - --:--';
  return `${clockFromDate(start)} - ${clockFromDate(end)}`;
}

function computeSolarEvents(date: Date, observer: ObserverLocation) {
  const astronomyObserver = new AstronomyObserver(observer.latitude, observer.longitude, observer.height ?? 0);
  const start = localDayStart(date);
  const sunrise = SearchRiseSet(Body.Sun, astronomyObserver, +1, start, 1.15);
  const sunset = SearchRiseSet(Body.Sun, astronomyObserver, -1, start, 1.15);
  const blueHourEnd = sunset ? SearchAltitude(Body.Sun, astronomyObserver, -1, sunset.date, 0.5, -6) : null;

  return {
    sunrise: clockFromDate(sunrise?.date ?? null),
    sunset: clockFromDate(sunset?.date ?? null),
    blueHour: formatTimeRange(sunset?.date ?? null, blueHourEnd?.date ?? null)
  };
}

function computePositions(date: Date, phaseAngle: number, distanceKm: number) {
  const earthAngle = eclipticLongitude(date);
  const earth: Vector3Tuple = [
    Math.cos(earthAngle) * EARTH_ORBIT_SCALE,
    Math.sin(earthAngle * 1.91) * 1.8,
    Math.sin(earthAngle) * EARTH_ORBIT_SCALE
  ];

  const moonPhaseAngle = (phaseAngle * Math.PI) / 180;
  const sunFromEarthAngle = earthAngle + Math.PI;
  const moonAngle = sunFromEarthAngle + moonPhaseAngle;
  const moonEcliptic = EclipticGeoMoon(date);
  const moonInclination = (moonEcliptic.lat * Math.PI) / 180;
  const moonScale = MOON_ORBIT_BASE_SCALE * (distanceKm / 384_400);

  const moonOffset: Vector3Tuple = [
    Math.cos(moonAngle) * moonScale,
    Math.sin(moonInclination) * moonScale * 5.2,
    Math.sin(moonAngle) * moonScale
  ];

  const moon: Vector3Tuple = [earth[0] + moonOffset[0], earth[1] + moonOffset[1], earth[2] + moonOffset[2]];
  const sun: Vector3Tuple = [0, 0, 0];
  return { sun, earth, moon };
}

export function getAstronomySnapshot(date: Date, observer: ObserverLocation = {
  latitude: DEFAULT_LATITUDE,
  longitude: DEFAULT_LONGITUDE,
  height: 4,
  name: DEFAULT_OBSERVER_NAME
}): AstronomySnapshot {
  const phaseAngle = MoonPhase(date);
  const moonAge = computeMoonAge(date);
  const illumination = Illumination(Body.Moon, date).phase_fraction;
  const distanceKm = Libration(date).dist_km;
  const daysToFull = computeNextFullMoonDays(date);
  const riseSet = computeRiseSet(date, observer);
  const solarEvents = computeSolarEvents(date, observer);
  const positions = computePositions(date, phaseAngle, distanceKm);

  return {
    date,
    observerName: observer.name || `${observer.latitude.toFixed(2)}, ${observer.longitude.toFixed(2)}`,
    phaseName: phaseNameFromAngle(phaseAngle),
    phaseAngle,
    moonAge,
    illumination,
    nextFullMoonDays: daysToFull,
    moonDistanceKm: distanceKm,
    moonrise: riseSet.rise,
    moonset: riseSet.set,
    sunrise: solarEvents.sunrise,
    sunset: solarEvents.sunset,
    blueHour: solarEvents.blueHour,
    positions,
    lightDirections: {
      earth: normalizeVector(subtract(positions.sun, positions.earth)),
      moon: normalizeVector(subtract(positions.sun, positions.moon))
    }
  };
}
