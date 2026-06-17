import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { formatSliderDate } from '../utils/format';

type TimeSliderProps = {
  value: number;
  rangeDays: number;
  currentDate: Date;
  language: 'zh' | 'en';
  onChange: (value: number) => void;
};

const TICK_HOURS = 2;
const TICKS_PER_DAY = 12;
const VISIBLE_DAYS = 5;
const VISIBLE_TICKS = VISIBLE_DAYS * TICKS_PER_DAY + 1;
const BUFFER_TICKS = 24;
const RENDER_TICKS = VISIBLE_TICKS + BUFFER_TICKS * 2;
const CENTER_VISIBLE_TICK_INDEX = Math.floor(VISIBLE_TICKS / 2);
const CENTER_RENDER_TICK_INDEX = Math.floor(RENDER_TICKS / 2);
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatMonthDay(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export default function TimeSlider({
  value,
  rangeDays,
  currentDate,
  language,
  onChange
}: TimeSliderProps) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const today = new Date();
  const referenceDate = currentDate;
  const visibleWindowStart = addHours(referenceDate, -CENTER_VISIBLE_TICK_INDEX * TICK_HOURS);
  const visibleWindowEnd = addHours(referenceDate, (VISIBLE_TICKS - CENTER_VISIBLE_TICK_INDEX - 1) * TICK_HOURS);
  const renderWindowStart = addHours(referenceDate, -CENTER_RENDER_TICK_INDEX * TICK_HOURS);
  const todayOutsideLeft = today.getTime() < visibleWindowStart.getTime();
  const todayOutsideRight = today.getTime() > visibleWindowEnd.getTime();
  const showTodayJump = todayOutsideLeft || todayOutsideRight;
  const ticks = Array.from({ length: RENDER_TICKS }, (_, index) => {
    const tickDate = addHours(renderWindowStart, index * TICK_HOURS);
    return {
      index,
      key: tickDate.toISOString(),
      date: tickDate,
      isDayTick: tickDate.getHours() === 0,
      isCenterTick: index === CENTER_RENDER_TICK_INDEX,
      isTodayTick: isSameLocalDay(tickDate, today)
    };
  });
  const dayLabels = ticks
    .filter((tick) => tick.isDayTick)
    .map((tick) => ({
      key: `label-${tick.key}`,
      label: isSameLocalDay(tick.date, today) ? (language === 'en' ? 'Today' : '今天') : language === 'en' ? WEEKDAYS_EN[tick.date.getDay()] : WEEKDAYS[tick.date.getDay()],
      isToday: isSameLocalDay(tick.date, today),
      startColumn: tick.index + 1,
      endColumn: Math.min(tick.index + TICKS_PER_DAY + 1, RENDER_TICKS + 1)
    }));
  const trackWidthPercent = ((RENDER_TICKS - 1) / (VISIBLE_TICKS - 1)) * 100;
  const baseOffsetPercent = -(BUFFER_TICKS * 100) / (RENDER_TICKS - 1);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const ruler = rulerRef.current;
      if (!dragState || !ruler) return;

      const width = Math.max(1, ruler.clientWidth);
      const deltaPx = event.clientX - dragState.startX;
      const tickSpacingPx = width / (VISIBLE_TICKS - 1);
      const snappedTicks = Math.round(deltaPx / tickSpacingPx);
      const deltaDays = (snappedTicks * TICK_HOURS) / 24;
      onChange(Math.max(-rangeDays, Math.min(rangeDays, dragState.startValue - deltaDays)));
    };

    const endDrag = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [onChange, rangeDays]);

  return (
    <div className="time-card">
      <div className="time-card-top">
        <span>{language === 'en' ? 'Timeline' : '时间轴'}</span>
        <strong>{formatSliderDate(currentDate)}</strong>
      </div>
      <div
        className={isDragging ? 'time-ruler is-dragging' : 'time-ruler'}
        ref={rulerRef}
        onPointerDown={(event) => {
          event.preventDefault();
          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startValue: value
          };
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
      >
        <div className="selected-date">{formatMonthDay(currentDate)}</div>
        {showTodayJump && (
          <button
            className={todayOutsideRight ? 'today-jump-button is-right is-accent' : 'today-jump-button is-left is-accent'}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              dragStateRef.current = null;
              setIsDragging(false);
              onChange(0);
            }}
            aria-label="回到今天"
          >
            <RotateCcw size={14} />
            <span>{language === 'en' ? 'Today' : '回到今天'}</span>
          </button>
        )}
        <div
          className="ruler-track"
          style={{
            width: `${trackWidthPercent}%`,
            transform: `translateX(${baseOffsetPercent}%)`
          }}
        >
          <div className="tick-row">
            {ticks.map((tick) => (
              <span
                className={tick.isDayTick ? 'ruler-tick is-day' : 'ruler-tick'}
                key={tick.key}
                data-center={tick.isCenterTick ? 'true' : undefined}
                data-today={tick.isTodayTick ? 'true' : undefined}
              />
            ))}
          </div>
          <div className="weekday-row">
            {dayLabels.map((dayLabel) => (
              <span
                className={dayLabel.isToday ? 'weekday-label is-today' : 'weekday-label'}
                key={dayLabel.key}
                style={{ gridColumn: `${dayLabel.startColumn} / ${dayLabel.endColumn}` }}
              >
                {dayLabel.label}
              </span>
            ))}
          </div>
        </div>
        <span className="today-marker" style={{ left: '50%' }} />
      </div>
    </div>
  );
}
