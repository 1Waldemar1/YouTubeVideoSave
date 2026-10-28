export interface VideoFormat {
  id: string;
  type: 'video' | 'audio';
  label: string;
  resolution?: string;
  bitrate?: string;
  container: string;
  fps?: number;
  hasAudio?: boolean;
  estimatedSizeMb: number;
  qualityScore: number;
  isPopular?: boolean;
  badge?: string;
}

export interface VideoThumbnails {
  maxres: string;
  sd: string;
  hq: string;
  mq: string;
  default: string;
}

export interface SubtitleOption {
  lang: string;
  label: string;
  formats: string[];
}

export interface TranscriptCue {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  formattedStart: string;
  formattedEnd: string;
  originalText: string;
  translatedText: string;
  speaker?: string;
}

export interface VideoTranslation {
  videoId: string;
  sourceLang: string;
  targetLang: string;
  cues: TranscriptCue[];
  summaryRu?: string;
  translatedTitle?: string;
}

export interface VideoInfo {
  videoId: string;
  url: string;
  shortsUrl: string;
  title: string;
  channel: string;
  channelUrl: string;
  description: string;
  durationFormatted: string;
  durationSec: number;
  views: string;
  publishDate: string;
  htmlEmbed: string;
  thumbnails: VideoThumbnails;
  formats: VideoFormat[];
  subtitles: SubtitleOption[];
  detectedLanguage?: string;
  transcript?: TranscriptCue[];
}

export interface SavedItem {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  format: string;
  type: 'video' | 'audio' | 'thumbnail' | 'subtitles' | 'translation';
  fileSizeMb: number;
  timestamp: number;
  clipRange?: { start: number; end: number };
}

export interface SampleVideo {
  id: string;
  title: string;
  channel: string;
  channelUrl: string;
  views: string;
  duration: string;
  durationSec: number;
  publishDate: string;
  category: string;
  description: string;
  sourceLang: 'en' | 'ko' | 'ja' | 'es';
  sourceLangLabel: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

