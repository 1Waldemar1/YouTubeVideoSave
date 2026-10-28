import { SampleVideo, VideoInfo, VideoFormat } from '../types';

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Официальный клип)',
    channel: 'Rick Astley',
    channelUrl: 'https://www.youtube.com/@RickAstleyYT',
    views: '1.5 млрд',
    duration: '3:33',
    durationSec: 213,
    publishDate: '25 окт. 2009',
    category: 'Музыка',
    description: 'Официальный музыкальный клип "Never Gonna Give You Up" певца Рика Эстли.',
    sourceLang: 'en',
    sourceLangLabel: '🇺🇸 Английский',
  },
  {
    id: 'korean_sample',
    title: 'Уличная еда в Сеуле: Ттокпокки и Кимбап (Корейский влог)',
    channel: 'Seoul Foodie Tour',
    channelUrl: 'https://www.youtube.com',
    views: '2.4 млн',
    duration: '3:15',
    durationSec: 195,
    publishDate: '18 авг. 2024',
    category: 'Корея / Влог',
    description: 'Традиционные уличные блюда Южной Кореи: пряные рисовые клецки ттокпокки, рыбный суп омук и кимбап.',
    sourceLang: 'ko',
    sourceLangLabel: '🇰🇷 Корейский',
  },
  {
    id: 'japanese_sample',
    title: 'Ночной Токио: Огни Сибуя и лучшие раменные столицы',
    channel: 'Tokyo After Dark',
    channelUrl: 'https://www.youtube.com',
    views: '1.8 млн',
    duration: '4:10',
    durationSec: 250,
    publishDate: '05 сен. 2024',
    category: 'Япония / Город',
    description: 'Прогулка по неоновым улочкам Токио, перекрестку Сибуя и скрытым гастрономическим жемчужинам.',
    sourceLang: 'ja',
    sourceLangLabel: '🇯🇵 Японский',
  },
  {
    id: 'jNQXAC9IVRw',
    title: 'Me at the zoo (Первое видео на YouTube)',
    channel: 'jawed',
    channelUrl: 'https://www.youtube.com/@jawed',
    views: '335 млн',
    duration: '0:19',
    durationSec: 19,
    publishDate: '24 апр. 2005',
    category: 'История',
    description: 'Самое первое видео, загруженное на YouTube сооснователем сервиса Джаведом Каримом.',
    sourceLang: 'en',
    sourceLangLabel: '🇺🇸 Английский',
  },
  {
    id: 'jbNokzUKPKI',
    title: 'ULTIMATE Raid Bonus Chest Buying Guide! Lost Ark 2026',
    channel: 'ImDefild',
    channelUrl: 'https://www.youtube.com/@ImDefild',
    views: '45 тыс.',
    duration: '8:59',
    durationSec: 539,
    publishDate: '2026',
    category: 'Гайд / Lost Ark',
    description: 'Полный разбор окупаемости и ценности покупки всех бонусных сундуков в рейдах: расчет золота, дроп ядер, браслеты и тактика для основы и твинков.',
    sourceLang: 'en',
    sourceLangLabel: '🇺🇸 Английский',
  },
];

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If already an 11-character video ID or preset id
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) || trimmed === 'korean_sample' || trimmed === 'japanese_sample') {
    return trimmed;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function generateFormats(durationSec: number = 240): VideoFormat[] {
  return [
    {
      id: 'mp4-1080p',
      type: 'video',
      label: '1080p Full HD',
      resolution: '1920x1080',
      container: 'MP4',
      fps: 60,
      hasAudio: true,
      estimatedSizeMb: Math.round((durationSec * 2.8) / 10) / 10 + 15,
      qualityScore: 98,
      isPopular: true,
      badge: 'Лучшее качество',
    },
    {
      id: 'mp4-720p',
      type: 'video',
      label: '720p HD',
      resolution: '1280x720',
      container: 'MP4',
      fps: 30,
      hasAudio: true,
      estimatedSizeMb: Math.round((durationSec * 1.4) / 10) / 10 + 8,
      qualityScore: 85,
      isPopular: true,
      badge: 'Рекомендуемое',
    },
    {
      id: 'mp4-480p',
      type: 'video',
      label: '480p SD',
      resolution: '854x480',
      container: 'MP4',
      fps: 30,
      hasAudio: true,
      estimatedSizeMb: Math.round((durationSec * 0.8) / 10) / 10 + 4,
      qualityScore: 65,
      isPopular: false,
    },
    {
      id: 'mp4-360p',
      type: 'video',
      label: '360p Эконом',
      resolution: '640x360',
      container: 'MP4',
      fps: 30,
      hasAudio: true,
      estimatedSizeMb: Math.round((durationSec * 0.45) / 10) / 10 + 2,
      qualityScore: 45,
      isPopular: false,
      badge: 'Быстрое',
    },
    {
      id: 'mp3-320',
      type: 'audio',
      label: 'MP3 Высокое качество',
      bitrate: '320 кбит/с',
      container: 'MP3',
      estimatedSizeMb: Math.round((durationSec * 0.32) / 8 * 10) / 10 + 0.5,
      qualityScore: 95,
      isPopular: true,
      badge: 'HQ Аудио',
    },
    {
      id: 'mp3-192',
      type: 'audio',
      label: 'MP3 Стандартное',
      bitrate: '192 кбит/с',
      container: 'MP3',
      estimatedSizeMb: Math.round((durationSec * 0.19) / 8 * 10) / 10 + 0.3,
      qualityScore: 78,
      isPopular: false,
    },
    {
      id: 'm4a-128',
      type: 'audio',
      label: 'M4A / AAC',
      bitrate: '128 кбит/с',
      container: 'M4A',
      estimatedSizeMb: Math.round((durationSec * 0.13) / 8 * 10) / 10 + 0.2,
      qualityScore: 72,
      isPopular: false,
    },
    {
      id: 'wav-lossless',
      type: 'audio',
      label: 'WAV Без потерь (Lossless PCM)',
      bitrate: '1411 кбит/с',
      container: 'WAV',
      estimatedSizeMb: Math.round((durationSec * 1.41) / 8 * 10) / 10 + 2,
      qualityScore: 99,
      isPopular: false,
    },
  ];
}
