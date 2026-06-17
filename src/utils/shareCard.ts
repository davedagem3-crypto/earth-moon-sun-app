import type { InterfaceLanguage } from '../App';
import type { AstronomySnapshot, ObserverLocation } from '../types';
import { formatDateTimeLocale } from './format';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

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

const TEXT = {
  zh: {
    title: '地月日运行模拟',
    subtitle: 'Earth · Moon · Sun',
    location: '观测地',
    phase: '月相',
    moonAge: '月龄',
    illumination: '照明',
    time: '时间',
    latitude: '纬度',
    longitude: '经度',
    generated: 'REAL-TIME CELESTIAL POSTCARD'
  },
  en: {
    title: 'Earth Moon Sun',
    subtitle: 'Orbital Simulation',
    location: 'Location',
    phase: 'Phase',
    moonAge: 'Moon age',
    illumination: 'Illumination',
    time: 'Time',
    latitude: 'Latitude',
    longitude: 'Longitude',
    generated: 'REAL-TIME CELESTIAL POSTCARD'
  }
} satisfies Record<InterfaceLanguage, Record<string, string>>;

type ShareCardInput = {
  language: InterfaceLanguage;
  observer: ObserverLocation;
  sceneCanvas: HTMLCanvasElement;
  snapshot: AstronomySnapshot;
};

function displayCity(name: string, language: InterfaceLanguage) {
  return language === 'en' ? CITY_EN[name] ?? name : name;
}

function displayPhase(name: string, language: InterfaceLanguage) {
  return language === 'en' ? PHASE_EN[name] ?? name : name;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawLabelValue(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
  ctx.fillStyle = 'rgba(143, 153, 194, 0.92)';
  ctx.font = '500 25px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = 'rgba(248, 250, 255, 0.94)';
  ctx.font = '540 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + width, y);
  ctx.textAlign = 'left';
}

function drawStarburst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity = 0.85) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(170, 184, 232, ${opacity})`;
  ctx.fillStyle = `rgba(170, 184, 232, ${opacity})`;
  ctx.lineWidth = Math.max(1, radius * 0.035);

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const length = i % 2 === 0 ? radius : radius * 0.48;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.12, Math.sin(angle) * radius * 0.12);
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDottedRule(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(155, 166, 214, 0.28)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.restore();
}

function drawPostcardFrame(ctx: CanvasRenderingContext2D, margin: number) {
  const outerX = 40;
  const outerY = 104;
  const outerWidth = CARD_WIDTH - 80;
  const outerHeight = CARD_HEIGHT - 168;
  const innerX = margin;
  const innerY = 124;
  const innerWidth = CARD_WIDTH - margin * 2;
  const innerHeight = CARD_HEIGHT - 246;

  ctx.save();
  ctx.strokeStyle = 'rgba(144, 156, 207, 0.78)';
  ctx.lineWidth = 2;
  roundRect(ctx, outerX, outerY, outerWidth, outerHeight, 34);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(226, 231, 246, 0.56)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, innerX, innerY, innerWidth, innerHeight, 24);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(144, 156, 207, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(116, 124);
  ctx.lineTo(502, 124);
  ctx.moveTo(578, 124);
  ctx.lineTo(CARD_WIDTH - 116, 124);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, 114, 18, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(144, 156, 207, 0.95)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, 114, 11, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(230, 235, 250, 0.92)';
  ctx.fill();

  drawStarburst(ctx, 78, 150, 28, 0.9);
  drawStarburst(ctx, CARD_WIDTH - 78, 150, 28, 0.9);
  drawStarburst(ctx, 61, 738, 18, 0.72);
  drawStarburst(ctx, CARD_WIDTH - 61, 738, 18, 0.72);
  drawStarburst(ctx, CARD_WIDTH / 2, CARD_HEIGHT - 136, 34, 0.86);
  drawStarburst(ctx, 76, CARD_HEIGHT - 430, 12, 0.72);
  drawStarburst(ctx, CARD_WIDTH - 76, CARD_HEIGHT - 430, 12, 0.72);
  ctx.restore();
}

function drawMoonPhaseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, illumination: number, moonAge: number) {
  const isWaxing = moonAge <= 29.530588853 / 2;
  const overlayShift = Math.min(radius * 2, Math.max(0, illumination * radius * 2));
  const shadowX = x + (isWaxing ? -overlayShift : overlayShift);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();

  const gradient = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.25, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.58, '#d9dde5');
  gradient.addColorStop(1, '#9fa7b2');
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(shadowX, y, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, progress: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(155, 166, 214, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(230, 235, 250, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width * Math.max(0.03, Math.min(1, progress)), y);
  ctx.stroke();
  ctx.restore();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createShareCard({ language, observer, sceneCanvas, snapshot }: ShareCardInput) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  const text = TEXT[language];
  const sceneImage = await loadImage(sceneCanvas.toDataURL('image/png'));
  const margin = 62;
  const visualTopHeight = Math.round(CARD_HEIGHT * 0.64);
  const sceneX = margin + 4;
  const sceneY = 144;
  const sceneWidth = CARD_WIDTH - margin * 2;
  const sceneHeight = visualTopHeight - 205;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(CARD_WIDTH / 2, 730, 40, CARD_WIDTH / 2, 730, 680);
  glow.addColorStop(0, 'rgba(92, 113, 186, 0.16)');
  glow.addColorStop(0.48, 'rgba(92, 113, 186, 0.045)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawPostcardFrame(ctx, margin);

  ctx.fillStyle = 'rgba(164, 174, 220, 0.9)';
  ctx.font = '560 25px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillText('EARTH · MOON · SUN', margin, 72);

  ctx.save();
  roundRect(ctx, sceneX, sceneY, sceneWidth - 8, sceneHeight, 22);
  ctx.clip();
  ctx.fillStyle = '#000000';
  ctx.fillRect(sceneX, sceneY, sceneWidth - 8, sceneHeight);
  drawCoverImage(ctx, sceneImage, sceneX, sceneY, sceneWidth - 8, sceneHeight);
  ctx.restore();

  ctx.strokeStyle = 'rgba(226, 231, 246, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin + 24, visualTopHeight - 18);
  ctx.lineTo(CARD_WIDTH - margin - 24, visualTopHeight - 18);
  ctx.stroke();

  const contentX = margin + 38;
  const contentWidth = CARD_WIDTH - contentX * 2;
  const panelY = visualTopHeight + 24;
  const city = displayCity(snapshot.observerName, language);
  const phase = displayPhase(snapshot.phaseName, language);
  const iconRadius = 54;

  ctx.fillStyle = 'rgba(142, 153, 207, 0.94)';
  ctx.font = '520 25px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif';
  ctx.fillText(text.phase, contentX, panelY);

  ctx.fillStyle = '#f8fbff';
  ctx.font = '650 64px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif';
  ctx.fillText(phase, contentX, panelY + 78);
  drawMoonPhaseIcon(ctx, CARD_WIDTH - contentX - iconRadius - 6, panelY + 48, iconRadius, snapshot.illumination, snapshot.moonAge);

  ctx.fillStyle = 'rgba(180, 184, 194, 0.72)';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif';
  const phaseMeta =
    language === 'en'
      ? `${text.moonAge} ${snapshot.moonAge.toFixed(1)} days · ${text.illumination} ${(snapshot.illumination * 100).toFixed(0)}%`
      : `${text.moonAge} ${snapshot.moonAge.toFixed(1)} 天 · ${text.illumination} ${(snapshot.illumination * 100).toFixed(0)}%`;
  ctx.fillText(phaseMeta, contentX, panelY + 118);
  drawProgressBar(ctx, contentX, panelY + 144, contentWidth, snapshot.illumination);

  drawDottedRule(ctx, contentX, panelY + 174, contentWidth);

  const rows = [
    [text.location, city],
    [text.time, formatDateTimeLocale(snapshot.date, language)],
    [text.latitude, observer.latitude.toFixed(4)],
    [text.longitude, observer.longitude.toFixed(4)]
  ];

  let y = panelY + 214;
  rows.forEach(([label, value], index) => {
    drawLabelValue(ctx, label, value, contentX, y, contentWidth);
    drawDottedRule(ctx, contentX, y + 30, contentWidth);
    y += 68;
  });

  ctx.fillStyle = 'rgba(164, 174, 220, 0.86)';
  ctx.font = '520 20px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillText(text.generated, margin + 18, CARD_HEIGHT - 48);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(164, 174, 220, 0.64)';
  ctx.fillText(text.title.toUpperCase(), CARD_WIDTH - margin - 18, CARD_HEIGHT - 48);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Unable to create JPG'));
    }, 'image/jpeg', 0.94);
  });

  const fileName = `earth-moon-sun-${snapshot.date.toISOString().slice(0, 10)}.jpg`;
  const file = new File([blob], fileName, { type: 'image/jpeg' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: text.title });
    return;
  }

  downloadBlob(blob, fileName);
}
