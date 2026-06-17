import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { InterfaceLanguage } from '../App';
import type { AstronomySnapshot, ObserverLocation } from '../types';
import { formatDateTimeLocale, formatDistance, formatSignedDays } from '../utils/format';

const SYNODIC_HALF = 29.530588853 / 2;

type DataPanelProps = {
  language: InterfaceLanguage;
  observer: ObserverLocation;
  presets: ObserverLocation[];
  snapshot: AstronomySnapshot;
  onLanguageToggle: () => void;
  onObserverChange: (observer: ObserverLocation) => void;
};

const PHASE_EN: Record<string, string> = {
  新月: 'New Moon',
  蛾眉月: 'Waxing Crescent',
  上弦月: 'First Quarter',
  盈凸月: 'Waxing Gibbous',
  满月: 'Full Moon',
  亏凸月: 'Waning Gibbous',
  下弦月: 'Last Quarter',
  残月: 'Waning Crescent'
};

const CITY_EN: Record<string, string> = {
  沈阳: 'Shenyang',
  上海: 'Shanghai',
  北京: 'Beijing',
  深圳: 'Shenzhen',
  纽约: 'New York',
  洛杉矶: 'Los Angeles',
  伦敦: 'London',
  自定义: 'Custom'
};

const UI = {
  zh: {
    searchPlaceholder: (name: string) => `搜索城市，例如 ${name}`,
    empty: '未找到匹配城市',
    phase: 'Lunar Phase',
    moonAge: '月龄',
    days: '天',
    illumination: '照明',
    observing: '观测条件',
    location: '观测地',
    latitude: '纬度',
    longitude: '经度',
    time: '时间',
    lunar: '月球数据',
    moonrise: '月出',
    moonset: '月落',
    nextFull: '下次满月',
    distance: '月地距离',
    solar: '太阳数据',
    sunrise: '日出',
    sunset: '日落',
    blueHour: '蓝调时刻',
    language: 'EN'
  },
  en: {
    searchPlaceholder: (name: string) => `Search city, e.g. ${name}`,
    empty: 'No matching city',
    phase: 'Lunar Phase',
    moonAge: 'Moon age',
    days: 'days',
    illumination: 'Illumination',
    observing: 'Observation',
    location: 'Location',
    latitude: 'Latitude',
    longitude: 'Longitude',
    time: 'Time',
    lunar: 'Moon',
    moonrise: 'Moonrise',
    moonset: 'Moonset',
    nextFull: 'Next full moon',
    distance: 'Distance',
    solar: 'Sun',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    blueHour: 'Blue hour',
    language: '中'
  }
} satisfies Record<InterfaceLanguage, Record<string, string | ((name: string) => string)>>;

function displayCity(name: string, language: InterfaceLanguage) {
  return language === 'en' ? CITY_EN[name] ?? name : name;
}

export default function DataPanel({ language, observer, presets, snapshot, onLanguageToggle, onObserverChange }: DataPanelProps) {
  const text = UI[language];
  const presetName = presets.some((preset) => preset.name === observer.name) ? observer.name : '自定义';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (presetName !== '自定义') {
      setSearchQuery('');
    }
  }, [presetName]);

  const filteredPresets = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return presets;
    return presets.filter((preset) => preset.name.toLowerCase().includes(keyword) || (CITY_EN[preset.name] ?? '').toLowerCase().includes(keyword));
  }, [presets, searchQuery]);

  const showSearchResults = searchFocused || searchQuery.trim().length > 0;

  return (
    <aside className="data-panel">
      <div className="city-search-card">
        <div className="city-search-row">
          <label className="city-search-field">
            <Search size={15} />
            <input
              type="text"
              value={searchQuery}
              placeholder={(text.searchPlaceholder as (name: string) => string)(displayCity(presetName === '自定义' ? presets[0]?.name ?? '沈阳' : presetName, language))}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <button className="language-toggle" type="button" onClick={onLanguageToggle} aria-label={language === 'zh' ? '切换到英文界面' : 'Switch to Chinese'}>
            {text.language as string}
          </button>
        </div>
        {showSearchResults && (
          <div className="city-search-results">
            {filteredPresets.slice(0, 6).map((preset) => (
              <button
                key={preset.name}
                className={preset.name === observer.name ? 'city-search-option is-active' : 'city-search-option'}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onObserverChange(preset);
                  setSearchQuery('');
                  setSearchFocused(false);
                }}
              >
                <span>{displayCity(preset.name, language)}</span>
                <small>
                  {preset.latitude.toFixed(4)}, {preset.longitude.toFixed(4)}
                </small>
              </button>
            ))}
            {filteredPresets.length === 0 && <div className="city-search-empty">{text.empty as string}</div>}
          </div>
        )}
      </div>

      <div className="phase-card">
        <p className="eyebrow">{text.phase as string}</p>
        <div className="phase-header">
          <div className="phase-title">{language === 'en' ? PHASE_EN[snapshot.phaseName] : snapshot.phaseName}</div>
          <MoonPhaseIcon illumination={snapshot.illumination} moonAge={snapshot.moonAge} />
        </div>
        <div className="phase-meter" aria-hidden="true">
          <span style={{ width: `${Math.max(3, snapshot.illumination * 100)}%` }} />
        </div>
        <p className="phase-subtitle">
          {text.moonAge as string} {snapshot.moonAge.toFixed(1)} {text.days as string} · {text.illumination as string} {(snapshot.illumination * 100).toFixed(0)}%
        </p>
      </div>

      <InfoSection title={text.observing as string}>
        <div className="observer-card">
          <div className="observer-hero">
            <p className="eyebrow">{text.location as string}</p>
            <div className="observer-hero-header">
              <div className="observer-city-value">{displayCity(snapshot.observerName, language)}</div>
              <span className="observer-hero-spacer" aria-hidden="true" />
            </div>
          </div>
          <label>
            <span>{text.latitude as string}</span>
            <input
              type="number"
              value={observer.latitude}
              min={-90}
              max={90}
              step={0.0001}
              onChange={(event) => onObserverChange({ ...observer, name: '自定义', latitude: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>{text.longitude as string}</span>
            <input
              type="number"
              value={observer.longitude}
              min={-180}
              max={180}
              step={0.0001}
              onChange={(event) => onObserverChange({ ...observer, name: '自定义', longitude: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="info-grid">
          <InfoBlock label={text.time as string} value={formatDateTimeLocale(snapshot.date, language)} large />
        </div>
      </InfoSection>

      <InfoSection title={text.lunar as string}>
        <div className="info-grid">
          <InfoBlock label={text.moonrise as string} value={snapshot.moonrise} />
          <InfoBlock label={text.moonset as string} value={snapshot.moonset} />
          <InfoBlock label={text.nextFull as string} value={formatSignedDays(snapshot.nextFullMoonDays, language)} />
          <InfoBlock label={text.distance as string} value={formatDistance(snapshot.moonDistanceKm, language)} large />
        </div>
      </InfoSection>

      <InfoSection title={text.solar as string}>
        <div className="info-grid">
          <InfoBlock label={text.sunrise as string} value={snapshot.sunrise} />
          <InfoBlock label={text.sunset as string} value={snapshot.sunset} />
          <InfoBlock label={text.blueHour as string} value={snapshot.blueHour} large />
        </div>
      </InfoSection>
    </aside>
  );
}

type InfoSectionProps = {
  title: string;
  children: ReactNode;
};

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className="info-section">
      <p className="section-label">{title}</p>
      {children}
    </section>
  );
}

type InfoBlockProps = {
  label: string;
  value: string;
  large?: boolean;
};

function InfoBlock({ label, value, large = false }: InfoBlockProps) {
  return (
    <div className={large ? 'info-block is-wide' : 'info-block'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type MoonPhaseIconProps = {
  illumination: number;
  moonAge: number;
};

function MoonPhaseIcon({ illumination, moonAge }: MoonPhaseIconProps) {
  const gradientId = useId();
  const radius = 34;
  const overlayShift = Math.min(radius * 2, Math.max(0, illumination * radius * 2));
  const isWaxing = moonAge <= SYNODIC_HALF;
  const shadowTranslateX = isWaxing ? -overlayShift : overlayShift;
  const craterOpacity = 0.08 + illumination * 0.22;

  return (
    <svg className="phase-icon" viewBox="0 0 88 88" aria-hidden="true" role="img">
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#f7fbff" stopOpacity="0.98" />
          <stop offset="62%" stopColor="#dbe7f2" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#aebdcb" stopOpacity="0.84" />
        </radialGradient>
      </defs>
      <circle cx="44" cy="44" r="38" fill="#000" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2" />
      <circle className="phase-icon-disc" cx="44" cy="44" r="34" fill={`url(#${gradientId})`} />
      <g className="phase-icon-craters" style={{ opacity: craterOpacity }}>
        <circle cx="33" cy="33" r="4" fill="rgba(123, 140, 157, 0.7)" />
        <circle cx="55" cy="28" r="3.2" fill="rgba(123, 140, 157, 0.52)" />
        <circle cx="57" cy="51" r="5.1" fill="rgba(123, 140, 157, 0.58)" />
        <circle cx="30" cy="56" r="3.6" fill="rgba(123, 140, 157, 0.46)" />
      </g>
      <circle
        className="phase-icon-shadow"
        cx="44"
        cy="44"
        r="34.6"
        fill="#000"
        transform={`translate(${shadowTranslateX} 0)`}
      />
      <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
    </svg>
  );
}
