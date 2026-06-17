import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Share2 } from 'lucide-react';
import DataPanel from './components/DataPanel';
import SolarScene from './components/SolarScene';
import TimeSlider from './components/TimeSlider';
import { getAstronomySnapshot } from './utils/astronomy';
import { snapDateToStep } from './utils/format';
import { createShareCard } from './utils/shareCard';
import type { ObserverLocation, TimeSpeed } from './types';

export type InterfaceLanguage = 'zh' | 'en';

const SPEEDS: TimeSpeed[] = [
  { label: '1 小时/秒', daysPerSecond: 1 / 24 },
  { label: '1 天/秒', daysPerSecond: 1 },
  { label: '1 月/秒', daysPerSecond: 29.530588853 },
  { label: '1 年/秒', daysPerSecond: 365.2422 }
];

const DAY_MS = 86_400_000;
const SLIDER_DAYS = 365 * 3;

export const OBSERVER_PRESETS: ObserverLocation[] = [
  { name: '沈阳', latitude: 41.8057, longitude: 123.4315, height: 49 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737, height: 4 },
  { name: '北京', latitude: 39.9042, longitude: 116.4074, height: 44 },
  { name: '深圳', latitude: 22.5431, longitude: 114.0579, height: 18 },
  { name: '纽约', latitude: 40.7128, longitude: -74.006, height: 10 },
  { name: '洛杉矶', latitude: 34.0522, longitude: -118.2437, height: 71 },
  { name: '伦敦', latitude: 51.5072, longitude: -0.1276, height: 11 }
];

const UI_TEXT = {
  zh: {
    eyebrow: 'Earth · Moon · Sun',
    title: '真实地球-月亮-太阳运行模拟',
    pause: '暂停',
    play: '播放',
    reset: '重置到当前时间',
    share: '生成分享卡片'
  },
  en: {
    eyebrow: 'Earth · Moon · Sun',
    title: 'Real Earth · Moon · Sun Simulator',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset to now',
    share: 'Create share card'
  }
} satisfies Record<InterfaceLanguage, Record<string, string>>;

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => snapDateToStep(new Date()));
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [observer, setObserver] = useState<ObserverLocation>(OBSERVER_PRESETS[0]);
  const [language, setLanguage] = useState<InterfaceLanguage>('zh');
  const [isSharing, setIsSharing] = useState(false);
  const lastFrameRef = useRef<number | null>(null);
  const text = UI_TEXT[language];

  const snapshot = useMemo(() => getAstronomySnapshot(currentDate, observer), [currentDate, observer]);
  const sliderValue = useMemo(() => {
    const deltaDays = (currentDate.getTime() - Date.now()) / DAY_MS;
    return Math.max(-SLIDER_DAYS, Math.min(SLIDER_DAYS, deltaDays));
  }, [currentDate]);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return undefined;
    }

    let frame = 0;
    const tick = (time: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = time;
      const deltaSeconds = Math.min(0.08, (time - lastFrameRef.current) / 1000);
      lastFrameRef.current = time;
      setCurrentDate((date) => new Date(date.getTime() + deltaSeconds * SPEEDS[speedIndex].daysPerSecond * DAY_MS));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, speedIndex]);

  const handleShare = async () => {
    const sceneCanvas = document.querySelector<HTMLCanvasElement>('.scene-wrap canvas');
    if (!sceneCanvas || isSharing) return;

    setIsSharing(true);
    try {
      await createShareCard({ language, observer, sceneCanvas, snapshot });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="simulation-pane">
        <div className="scene-header">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h1>{text.title}</h1>
          </div>
          <div className="scene-actions">
            <button className="icon-button" type="button" onClick={handleShare} aria-label={text.share} disabled={isSharing}>
              <Share2 size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? text.pause : text.play}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="icon-button" type="button" onClick={() => setCurrentDate(snapDateToStep(new Date()))} aria-label={text.reset}>
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <div className="scene-wrap">
          <SolarScene snapshot={snapshot} />
        </div>

        <TimeSlider
          value={sliderValue}
          rangeDays={SLIDER_DAYS}
          currentDate={currentDate}
          language={language}
          onChange={(days) => setCurrentDate(snapDateToStep(new Date(Date.now() + days * DAY_MS)))}
        />
      </section>

      <DataPanel
        language={language}
        observer={observer}
        presets={OBSERVER_PRESETS}
        snapshot={snapshot}
        onLanguageToggle={() => setLanguage((value) => (value === 'zh' ? 'en' : 'zh'))}
        onObserverChange={setObserver}
      />
    </main>
  );
}
