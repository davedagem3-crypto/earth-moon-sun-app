import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

export function snapDateToStep(date: Date, stepHours = 2): Date {
  const snapped = new Date(date);
  const totalMinutes = snapped.getHours() * 60 + snapped.getMinutes();
  const stepMinutes = stepHours * 60;
  const snappedMinutes = Math.round(totalMinutes / stepMinutes) * stepMinutes;

  snapped.setHours(0, 0, 0, 0);
  snapped.setMinutes(snappedMinutes, 0, 0);
  return snapped;
}

export function formatDateTime(date: Date): string {
  return dayjs(snapDateToStep(date)).format('YYYY/MM/DD，dddd，HH:00');
}

export function formatDateTimeLocale(date: Date, language: 'zh' | 'en'): string {
  const snapped = snapDateToStep(date);
  if (language === 'en') return dayjs(snapped).locale('en').format('YYYY/MM/DD, dddd, HH:00');
  return dayjs(snapped).locale('zh-cn').format('YYYY/MM/DD，dddd，HH:00');
}

export function formatDistance(value: number, language: 'zh' | 'en' = 'zh'): string {
  const rounded = Math.round(value);
  if (language === 'en') return `${rounded.toLocaleString('en-US')} km`;
  return `${rounded.toLocaleString('zh-CN')} 公里`;
}

export function formatSignedDays(value: number, language: 'zh' | 'en' = 'zh'): string {
  const rounded = Math.round(value);
  if (rounded === 0) return language === 'en' ? 'Today' : '今天';
  return language === 'en' ? `${rounded} days` : `${rounded} 天`;
}

export function formatSliderDate(date: Date): string {
  return dayjs(snapDateToStep(date)).format('YYYY/MM/DD HH:00');
}
