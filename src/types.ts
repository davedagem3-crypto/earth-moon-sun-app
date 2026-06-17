export type PhaseName =
  | '新月'
  | '蛾眉月'
  | '上弦月'
  | '盈凸月'
  | '满月'
  | '亏凸月'
  | '下弦月'
  | '残月';

export type TimeSpeed = {
  label: string;
  daysPerSecond: number;
};

export type ObserverLocation = {
  name: string;
  latitude: number;
  longitude: number;
  height?: number;
};

export type Vector3Tuple = [number, number, number];

export type AstronomySnapshot = {
  date: Date;
  observerName: string;
  phaseName: PhaseName;
  phaseAngle: number;
  moonAge: number;
  illumination: number;
  nextFullMoonDays: number;
  moonDistanceKm: number;
  moonrise: string;
  moonset: string;
  sunrise: string;
  sunset: string;
  blueHour: string;
  positions: {
    sun: Vector3Tuple;
    earth: Vector3Tuple;
    moon: Vector3Tuple;
  };
  lightDirections: {
    earth: Vector3Tuple;
    moon: Vector3Tuple;
  };
};
