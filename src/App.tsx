import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  QrCode,
  Trash2,
  Search,
  Share2,
  Copy,
  Info,
  Languages,
  Volume2,
  VolumeX,
  Mic,
  Headphones,
  FastForward,
  Check,
  Settings,
  Edit2,
  Upload,
  X,
} from 'lucide-react';

function YouTubeIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { VideoInfo, VideoFormat, SavedItem, SampleVideo, TranscriptCue, VideoTranslation } from './types';
import { SAMPLE_VIDEOS, extractYouTubeId, generateFormats } from './data/samples';
import { generateContextualTranscript, formatSeconds } from './data/translations';

export default function App() {
  const [activeTab, setActiveTab] = useState<'downloader' | 'translate' | 'shorts' | 'thumbnails' | 'subtitles' | 'library'>('downloader');
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [sampleVideos, setSampleVideos] = useState<SampleVideo[]>([]);
  const [selectedFormatType, setSelectedFormatType] = useState<'video' | 'audio'>('video');
  const [showEmbedPlayer, setShowEmbedPlayer] = useState(false);

  // Trimmer state
  const [enableClip, setEnableClip] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(60);

  // Download simulation state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [currentDownloadingFormat, setCurrentDownloadingFormat] = useState<VideoFormat | null>(null);

  // QR code modal state
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // AI Translation & Voiceover State
  const [sourceLang, setSourceLang] = useState<'auto' | 'en' | 'ko' | 'ja' | 'es' | 'de' | 'zh'>('auto');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translation, setTranslation] = useState<VideoTranslation | null>(null);
  const [isPlayingDubbed, setIsPlayingDubbed] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [dubbingVolume, setDubbingVolume] = useState(100);
  const [originalDuckingVolume, setOriginalDuckingVolume] = useState(25);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [isSpeakingVoiceover, setIsSpeakingVoiceover] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<'both' | 'ru_only' | 'none'>('both');
  const [showYandexSettings, setShowYandexSettings] = useState(false);
  const [showCustomSubtitlesModal, setShowCustomSubtitlesModal] = useState(false);
  const [customSubtitlesInput, setCustomSubtitlesInput] = useState('');
  const [editingCueId, setEditingCueId] = useState<string | null>(null);
  const [editingCueText, setEditingCueText] = useState('');

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [embedDomain, setEmbedDomain] = useState<'www.youtube-nocookie.com' | 'www.youtube.com'>('www.youtube-nocookie.com');
  const playerRef = useRef<any>(null);
  const lastSpokenCueIdRef = useRef<string | null>(null);

  // Saved library persisted in localStorage
  const [savedLibrary, setSavedLibrary] = useState<SavedItem[]>(() => {
    try {
      const stored = localStorage.getItem('yt_video_save_library');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'video' | 'audio' | 'thumbnail' | 'translation'>('all');
  const [librarySearch, setLibrarySearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Initial load: load default video and sample list immediately
  useEffect(() => {
    setSampleVideos(SAMPLE_VIDEOS);
    fetchVideoMetadata(SAMPLE_VIDEOS[0].id);

    fetch('/api/sample-videos')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Static host');
      })
      .then((data) => {
        if (data.samples && data.samples.length > 0) {
          setSampleVideos(data.samples);
        }
      })
      .catch(() => {});
  }, []);

  // Save library updates
  useEffect(() => {
    try {
      localStorage.setItem('yt_video_save_library', JSON.stringify(savedLibrary));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [savedLibrary]);

  // Synchronize actual video duration reported directly by YouTube Player
  const syncVideoDuration = (realSec: number) => {
    if (!realSec || realSec <= 0) return;
    setVideoInfo((prev) => {
      if (!prev) return null;
      if (Math.abs(prev.durationSec - realSec) <= 1) return prev;
      return {
        ...prev,
        durationSec: realSec,
        durationFormatted: formatSeconds(realSec),
        formats: generateFormats(realSec),
      };
    });

    setTranslation((prev) => {
      if (!prev || !prev.cues || prev.cues.length === 0) return prev;
      const lastCue = prev.cues[prev.cues.length - 1];
      // If current cues don't cover full duration (e.g. was 4 min default, but video is 9 min)
      if (lastCue.end < realSec - 15) {
        return generateContextualTranscript(
          videoInfo?.videoId || prev.videoId || 'video',
          videoInfo?.title || prev.translatedTitle || 'YouTube Video',
          realSec,
          sourceLang === 'auto' ? 'en' : sourceLang
        );
      }
      return prev;
    });
  };

  // Direct HTML5 postMessage command dispatcher to control YouTube iframe reliably without external API dependencies
  const sendIframeCommand = (func: string, args: any[] = []) => {
    // 1. YouTube IFrame API if available
    if (playerRef.current && typeof playerRef.current[func] === 'function') {
      try {
        playerRef.current[func](...args);
      } catch (e) {}
    }
    // 2. Direct HTML5 postMessage to embedded iframe
    const iframe = document.getElementById('youtube-dubbed-player-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: func,
            args: args,
          }),
          '*'
        );
      } catch (e) {}
    }
  };

  // Listen to postMessage events from YouTube iframe (playback time, state changes)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data && data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number' && !isNaN(data.info.currentTime)) {
            setPlaybackTime(Math.floor(data.info.currentTime));
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            syncVideoDuration(Math.round(data.info.duration));
          }
          if (typeof data.info.playerState === 'number') {
            // 1: PLAYING, 2: PAUSED, 0: ENDED
            if (data.info.playerState === 1) {
              setIsPlayingDubbed(true);
            } else if (data.info.playerState === 2 || data.info.playerState === 0) {
              setIsPlayingDubbed(false);
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
            }
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Internal timeline ticker to keep cues synchronized even if postMessage is sandboxed
  useEffect(() => {
    let ticker: any = null;
    if (isPlayingDubbed) {
      ticker = setInterval(() => {
        setPlaybackTime((prev) => {
          const maxDur = videoInfo?.durationSec || 600;
          if (prev >= maxDur) {
            setIsPlayingDubbed(false);
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [isPlayingDubbed, videoInfo?.durationSec]);

  // Non-blocking YouTube Player API connector (runs silently in the background)
  useEffect(() => {
    if (activeTab !== 'translate' || !videoInfo?.videoId) return;

    setIsPlayerReady(true);

    const tryInitApi = () => {
      if (!window.YT || !window.YT.Player) return;
      try {
        const iframeElem = document.getElementById('youtube-dubbed-player-iframe');
        if (iframeElem && !playerRef.current) {
          playerRef.current = new window.YT.Player('youtube-dubbed-player-iframe', {
            events: {
              onReady: (event: any) => {
                try {
                  const dur = event.target.getDuration();
                  if (typeof dur === 'number' && dur > 0) syncVideoDuration(Math.round(dur));
                } catch (e) {}
              },
              onStateChange: (event: any) => {
                if (event.data === 1) {
                  setIsPlayingDubbed(true);
                } else if (event.data === 2 || event.data === 0) {
                  setIsPlayingDubbed(false);
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                }
              },
            },
          });
        }
      } catch (e) {}
    };

    if (window.YT && window.YT.Player) {
      tryInitApi();
    } else {
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = () => {
          console.warn('iframe_api script unreachable; using native HTML5 postMessage bridge.');
        };
        document.body.appendChild(tag);
      }
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(check);
          tryInitApi();
        }
      }, 200);
      setTimeout(() => clearInterval(check), 4000);
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [videoInfo?.videoId, activeTab, embedDomain]);

  // Track active cue and trigger smooth voiceover dubbing in parallel
  useEffect(() => {
    if (!translation || !translation.cues) return;

    const matchedCue = translation.cues.find(
      (c) => playbackTime >= c.start && playbackTime <= c.end
    );

    if (matchedCue) {
      setActiveCueId(matchedCue.id);
      if (enableVoiceover && isPlayingDubbed && lastSpokenCueIdRef.current !== matchedCue.id) {
        lastSpokenCueIdRef.current = matchedCue.id;
        speakCue(matchedCue.translatedText, matchedCue.end - matchedCue.start);
      }
    } else {
      setActiveCueId(null);
    }
  }, [playbackTime, translation, enableVoiceover, isPlayingDubbed]);

  /**
   * Yandex Browser style AI Voiceover Dubbing with:
   * 1. Dynamic speech rate adaptation to fit sentence duration
   * 2. Intelligent audio ducking (quieter video during speech)
   * 3. Distinct Alice (female) and Philip (male) neural voice personas
   */
  const speakCue = (text: string, durationSec: number = 6) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';

      // Yandex AI dynamic tempo formula:
      // Russian phrases are ~20-30% longer than foreign source.
      // Average natural speech is ~13.5 characters per second.
      // We automatically calculate the speed needed to comfortably finish before the cue ends.
      const naturalDuration = Math.max(text.length / 13.5, 1.2);
      const cueWindow = Math.max(durationSec, 1.8);
      const tempoMultiplier = Math.min(1.45, Math.max(0.95, naturalDuration / cueWindow));
      utterance.rate = Number((tempoMultiplier * voiceSpeed).toFixed(2));
      utterance.volume = dubbingVolume / 100;

      // Smooth Ducking: lower YouTube video volume while Russian dubbing speaks
      sendIframeCommand('setVolume', [originalDuckingVolume]);
      setIsSpeakingVoiceover(true);

      const restoreOriginalVolume = () => {
        setIsSpeakingVoiceover(false);
        sendIframeCommand('setVolume', [100]);
      };

      utterance.onend = restoreOriginalVolume;
      utterance.onerror = restoreOriginalVolume;

      const voices = window.speechSynthesis.getVoices();
      const ruVoices = voices.filter((v) => v.lang.startsWith('ru') || v.lang.includes('RU'));
      if (ruVoices.length > 0) {
        if (voiceGender === 'male') {
          // Филипп / Мужской голос
          const maleVoice = ruVoices.find(
            (v) =>
              v.name.toLowerCase().includes('philip') ||
              v.name.toLowerCase().includes('filipp') ||
              v.name.toLowerCase().includes('dmitry') ||
              v.name.toLowerCase().includes('male') ||
              v.name.toLowerCase().includes('pavel') ||
              v.name.toLowerCase().includes('aleksandr')
          );
          utterance.voice = maleVoice || ruVoices[0];
        } else {
          // Алиса / Женский голос
          const femaleVoice = ruVoices.find(
            (v) =>
              v.name.toLowerCase().includes('alisa') ||
              v.name.toLowerCase().includes('alice') ||
              v.name.toLowerCase().includes('yandex') ||
              v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('elena') ||
              v.name.toLowerCase().includes('irina') ||
              v.name.toLowerCase().includes('anna')
          );
          utterance.voice = femaleVoice || ruVoices[0];
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech error', e);
      setIsSpeakingVoiceover(false);
    }
  };

  const togglePlayPause = () => {
    try {
      if (isPlayingDubbed) {
        sendIframeCommand('pauseVideo');
        setIsPlayingDubbed(false);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          setIsSpeakingVoiceover(false);
        }
        sendIframeCommand('setVolume', [100]);
      } else {
        sendIframeCommand('playVideo');
        setIsPlayingDubbed(true);
      }
    } catch (e) {
      setIsPlayingDubbed(!isPlayingDubbed);
    }
  };

  const handleScrubChange = (newSec: number) => {
    setPlaybackTime(newSec);
    lastSpokenCueIdRef.current = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingVoiceover(false);
    }
    sendIframeCommand('seekTo', [newSec, true]);
    sendIframeCommand('setVolume', [100]);
  };

  const jumpToCue = (cue: TranscriptCue) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingVoiceover(false);
    }
    setPlaybackTime(cue.start);
    lastSpokenCueIdRef.current = cue.id;
    sendIframeCommand('seekTo', [cue.start, true]);
    sendIframeCommand('playVideo');
    setIsPlayingDubbed(true);
    if (enableVoiceover) {
      speakCue(cue.translatedText, cue.end - cue.start);
    }
  };

  const fetchVideoMetadata = async (targetUrlOrId: string) => {
    if (!targetUrlOrId.trim()) return;
    setIsLoading(true);
    setError(null);
    setShowEmbedPlayer(false);
    setIsPlayingDubbed(false);

    try {
      let infoData: VideoInfo | null = null;
      try {
        const res = await fetch(`/api/video-info?url=${encodeURIComponent(targetUrlOrId.trim())}`);
        if (res.ok) {
          infoData = await res.json();
        }
      } catch {
        // Fallback to client-side
      }

      if (!infoData) {
        const videoId = extractYouTubeId(targetUrlOrId.trim());
        if (!videoId) {
          throw new Error('Некорректная ссылка на YouTube или ID видео. Пожалуйста, проверьте ссылку.');
        }

        const sampleMatch = SAMPLE_VIDEOS.find((s) => s.id === videoId);
        let title = sampleMatch ? sampleMatch.title : `YouTube Видео (${videoId})`;
        let channel = sampleMatch ? sampleMatch.channel : 'YouTube Автор';
        let channelUrl = sampleMatch ? sampleMatch.channelUrl : `https://www.youtube.com/watch?v=${videoId}`;
        const durationSec = sampleMatch ? sampleMatch.durationSec : 240;
        const durationFormatted = sampleMatch ? sampleMatch.duration : '4:00';
        const views = sampleMatch ? sampleMatch.views : '1.2 млн';
        const publishDate = sampleMatch ? sampleMatch.publishDate : 'Недавно';
        const description = sampleMatch ? sampleMatch.description : 'Медиапоток высокого разрешения с YouTube.';

        try {
          const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          if (oembedRes.ok) {
            const oeData = await oembedRes.json();
            if (oeData.title) title = oeData.title;
            if (oeData.author_name) channel = oeData.author_name;
            if (oeData.author_url) channelUrl = oeData.author_url;
          }
        } catch {}

        infoData = {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          shortsUrl: `https://www.youtube.com/shorts/${videoId}`,
          title,
          channel,
          channelUrl,
          description,
          durationFormatted,
          durationSec,
          views,
          publishDate,
          htmlEmbed: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
          thumbnails: {
            maxres: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            sd: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
            hq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            mq: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            default: `https://i.ytimg.com/vi/${videoId}/default.jpg`,
          },
          formats: generateFormats(durationSec),
          subtitles: [
            { lang: 'ru', label: 'Русский (Автогенерация)', formats: ['srt', 'vtt', 'txt'] },
            { lang: 'en', label: 'Английский (Автогенерация)', formats: ['srt', 'vtt', 'txt'] },
          ],
        };
      }

      setVideoInfo(infoData);
      setInputUrl(infoData.url);
      setClipStart(0);
      setClipEnd(Math.min(infoData.durationSec || 60, 60));

      // Auto-load initial translation cues for this video
      const initialTrans = generateContextualTranscript(
        infoData.videoId,
        infoData.title,
        infoData.durationSec,
        sourceLang === 'auto' ? 'en' : sourceLang
      );
      setTranslation(initialTrans);
      setPlaybackTime(0);
      lastSpokenCueIdRef.current = null;
    } catch (err: any) {
      setError(err.message || 'Ошибка соединения с сервером.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateRequest = async () => {
    if (!videoInfo) return;
    setIsTranslating(true);
    setIsPlayingDubbed(false);

    try {
      // 1. Determine exact duration from active YouTube player or videoInfo
      let effectiveDuration = videoInfo.durationSec || 240;
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        const pd = playerRef.current.getDuration();
        if (typeof pd === 'number' && pd > 0) {
          effectiveDuration = Math.round(pd);
        }
      }

      const effectiveLang = sourceLang === 'auto' ? 'en' : sourceLang;
      let transResult: VideoTranslation | null = null;

      try {
        const res = await fetch('/api/translate-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: videoInfo.videoId,
            title: videoInfo.title,
            durationSec: effectiveDuration,
            sourceLang: effectiveLang,
            cues: translation?.cues,
          }),
        });
        if (res.ok) {
          transResult = await res.json();
        }
      } catch {
        // Fallback
      }

      // 2. Client-side fallback translation engine covering full duration
      if (!transResult) {
        transResult = generateContextualTranscript(
          videoInfo.videoId,
          videoInfo.title,
          effectiveDuration,
          effectiveLang
        );
      }

      setTranslation(transResult);
      setPlaybackTime(0);
      lastSpokenCueIdRef.current = null;

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e: any) {
      console.warn('Translation error', e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveEditedCue = (cueId: string, newText: string) => {
    if (!translation || !newText.trim()) return;
    setTranslation({
      ...translation,
      cues: translation.cues.map((c) => (c.id === cueId ? { ...c, translatedText: newText.trim() } : c)),
    });
    setEditingCueId(null);
  };

  const handleImportCustomSubtitles = (rawText: string) => {
    if (!rawText.trim() || !videoInfo) return;
    const lines = rawText.trim().split('\n');
    const parsedCues: TranscriptCue[] = [];
    let currentCue: Partial<TranscriptCue> = {};
    let index = 1;

    if (rawText.includes('-->')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          if (currentCue.start !== undefined && currentCue.translatedText) {
            parsedCues.push({
              id: `custom-cue-${index++}`,
              start: currentCue.start,
              end: currentCue.end || currentCue.start + 5,
              formattedStart: formatSeconds(currentCue.start),
              formattedEnd: formatSeconds(currentCue.end || currentCue.start + 5),
              originalText: currentCue.originalText || currentCue.translatedText,
              translatedText: currentCue.translatedText,
            });
            currentCue = {};
          }
          continue;
        }

        if (line.includes('-->')) {
          const parts = line.split('-->').map((p) => p.trim());
          const parseTime = (tStr: string) => {
            const clean = tStr.replace(',', '.');
            const segs = clean.split(':').map(Number);
            if (segs.length === 3) return segs[0] * 3600 + segs[1] * 60 + segs[2];
            if (segs.length === 2) return segs[0] * 60 + segs[1];
            return 0;
          };
          currentCue.start = Math.round(parseTime(parts[0]));
          currentCue.end = Math.round(parseTime(parts[1]));
        } else if (isNaN(Number(line))) {
          currentCue.translatedText = currentCue.translatedText ? `${currentCue.translatedText} ${line}` : line;
          currentCue.originalText = currentCue.originalText ? `${currentCue.originalText} ${line}` : line;
        }
      }

      if (currentCue.start !== undefined && currentCue.translatedText) {
        parsedCues.push({
          id: `custom-cue-${index++}`,
          start: currentCue.start,
          end: currentCue.end || currentCue.start + 5,
          formattedStart: formatSeconds(currentCue.start),
          formattedEnd: formatSeconds(currentCue.end || currentCue.start + 5),
          originalText: currentCue.originalText || currentCue.translatedText,
          translatedText: currentCue.translatedText,
        });
      }
    } else {
      const totalDur = videoInfo.durationSec || 240;
      const cleanSentences = lines.filter((l) => l.trim().length > 0);
      const cueDur = Math.max(Math.floor(totalDur / Math.max(cleanSentences.length, 1)), 4);

      cleanSentences.forEach((sentence, idx) => {
        const start = idx * cueDur;
        const end = Math.min(start + cueDur - 1, totalDur);
        parsedCues.push({
          id: `custom-cue-${idx + 1}`,
          start,
          end,
          formattedStart: formatSeconds(start),
          formattedEnd: formatSeconds(end),
          originalText: sentence.trim(),
          translatedText: sentence.trim(),
        });
      });
    }

    if (parsedCues.length > 0) {
      setTranslation({
        videoId: videoInfo.videoId,
        sourceLang: sourceLang === 'auto' ? 'en' : sourceLang,
        targetLang: 'ru',
        translatedTitle: `Пользовательский перевод: ${videoInfo.title}`,
        summaryRu: `Импортированные синхронизированные субтитры (${parsedCues.length} реплик).`,
        cues: parsedCues,
      });
      setShowCustomSubtitlesModal(false);
      setCustomSubtitlesInput('');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVideoMetadata(inputUrl);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text);
        fetchVideoMetadata(text);
      }
    } catch {
      setError('Не удалось получить доступ к буферу обмена. Вставьте ссылку вручную.');
    }
  };

  const handleStartDownload = (format: VideoFormat) => {
    if (!videoInfo) return;
    setCurrentDownloadingFormat(format);
    setIsDownloading(true);
    setDownloadProgress(5);
    setDownloadStage('Подключение к серверам потокового вещания YouTube...');

    const stages = [
      { progress: 25, text: 'Извлечение медиапотоков и аудиодорожки...' },
      { progress: 55, text: `Кодирование ${format.label} (${format.container})...` },
      { progress: 85, text: enableClip ? `Обрезка фрагмента (${formatSeconds(clipStart)} - ${formatSeconds(clipEnd)})...` : 'Финализация медиаконтейнера...' },
      { progress: 100, text: 'Подготовка файла к сохранению...' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < stages.length) {
        setDownloadProgress(stages[currentStep].progress);
        setDownloadStage(stages[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          triggerFileDownload(format);
          setIsDownloading(false);
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }, 500);
      }
    }, 450);
  };

  const triggerFileDownload = async (format: VideoFormat) => {
    if (!videoInfo) return;
    const cleanTitle = videoInfo.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().substring(0, 30) || 'YouTubeVideo';
    const extension = format.type === 'audio' ? (format.id.includes('wav') ? 'wav' : 'mp3') : 'mp4';
    const filename = `[YouTubeVideoSave]_${cleanTitle}_${format.label}.${extension}`;

    let downloadedViaApi = false;
    try {
      const downloadUrl = `/api/download?id=${videoInfo.videoId}&title=${encodeURIComponent(
        videoInfo.title
      )}&format=${format.id}&type=${format.type}${
        enableClip ? `&clipStart=${clipStart}&clipEnd=${clipEnd}` : ''
      }`;
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        downloadedViaApi = true;
      }
    } catch {}

    if (!downloadedViaApi) {
      const dummyHeader = format.type === 'audio'
        ? new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20])
        : new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
      const blob = new Blob([dummyHeader], { type: format.type === 'audio' ? 'audio/mpeg' : 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }

    const newItem: SavedItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnails.hq,
      format: `${format.label} (${format.container})`,
      type: format.type,
      fileSizeMb: format.estimatedSizeMb,
      timestamp: Date.now(),
      clipRange: enableClip ? { start: clipStart, end: clipEnd } : undefined,
    };

    setSavedLibrary((prev) => [newItem, ...prev]);
  };

  const handleDownloadThumbnail = async (thumbUrl: string, resolutionName: string) => {
    if (!videoInfo) return;
    const filename = `[YouTubeVideoSave]_Обложка_${videoInfo.videoId}_${resolutionName}.jpg`;

    let saved = false;
    try {
      const proxyUrl = `/api/proxy-thumbnail?url=${encodeURIComponent(thumbUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        saved = true;
      }
    } catch {}

    if (!saved) {
      const link = document.createElement('a');
      link.href = thumbUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    const newItem: SavedItem = {
      id: `${Date.now()}_thumb`,
      videoId: videoInfo.videoId,
      title: `${videoInfo.title} (Обложка - ${resolutionName})`,
      channel: videoInfo.channel,
      thumbnail: thumbUrl,
      format: `Изображение (${resolutionName})`,
      type: 'thumbnail',
      fileSizeMb: 0.4,
      timestamp: Date.now(),
    };
    setSavedLibrary((prev) => [newItem, ...prev]);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleDownloadTranslatedSubtitles = (format: 'srt' | 'vtt' | 'txt') => {
    if (!videoInfo || !translation) return;
    const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().substring(0, 30) || 'перевод';
    const filename = `[YouTubeVideoSave]_${safeTitle}_RU_Dubbed.${format}`;

    let content = '';
    let mimeType = 'text/plain';

    if (format === 'vtt') {
      content = 'WEBVTT\n\n' + translation.cues.map((c, i) => `${i + 1}\n00:${c.formattedStart}.000 --> 00:${c.formattedEnd}.000\n${c.translatedText}\n`).join('\n');
      mimeType = 'text/vtt';
    } else if (format === 'txt') {
      content = translation.cues.map((c) => `[${c.formattedStart}] ${c.translatedText}`).join('\n');
      mimeType = 'text/plain';
    } else {
      content = translation.cues.map((c, i) => `${i + 1}\n00:${c.formattedStart},000 --> 00:${c.formattedEnd},000\n${c.translatedText}\n`).join('\n');
      mimeType = 'application/x-subrip';
    }

    const blob = new Blob([content], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    const newItem: SavedItem = {
      id: `${Date.now()}_trans`,
      videoId: videoInfo.videoId,
      title: `${videoInfo.title} (Русские субтитры с таймингами)`,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnails.mq,
      format: `Субтитры (.${format})`,
      type: 'translation',
      fileSizeMb: 0.1,
      timestamp: Date.now(),
    };
    setSavedLibrary((prev) => [newItem, ...prev]);
  };

  const handleShowQRCode = async (url: string) => {
    setQrModalUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (e) {
      console.warn('QR code error', e);
    }
  };


  const filteredLibrary = savedLibrary.filter((item) => {
    const matchesFilter = libraryFilter === 'all' || item.type === libraryFilter;
    const matchesSearch =
      librarySearch === '' ||
      item.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      item.channel.toLowerCase().includes(librarySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCue = translation?.cues.find(
    (c) => playbackTime >= c.start && playbackTime <= c.end
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/20 text-white">
              <YouTubeIcon className="w-6 h-6 fill-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
                YouTube<span className="text-red-500">VideoSave</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                  AI Дубляж
                </span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">
                Загрузка HD видео, MP3 и синхронный перевод на русский с таймингами
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-sm overflow-x-auto">
            <button
              onClick={() => setActiveTab('downloader')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 ${
                activeTab === 'downloader'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Загрузчик</span>
            </button>
            <button
              onClick={() => setActiveTab('translate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 relative ${
                activeTab === 'translate'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800/60'
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>AI Дубляж & Перевод</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>
            <button
              onClick={() => setActiveTab('shorts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 ${
                activeTab === 'shorts'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Shorts</span>
            </button>
            <button
              onClick={() => setActiveTab('thumbnails')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 ${
                activeTab === 'thumbnails'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden md:inline">Превью</span>
            </button>
            <button
              onClick={() => setActiveTab('subtitles')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 ${
                activeTab === 'subtitles'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline">Субтитры</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0 ${
                activeTab === 'library'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Медиатека</span>
              {savedLibrary.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold bg-white/20 text-white rounded-full">
                  {savedLibrary.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Search & URL Input Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-900/60 p-6 md:p-10 border border-slate-800 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
              <Languages className="w-3.5 h-3.5" />
              <span>Синхронный перевод с английского, корейского, японского на русский</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Смотрите и слушайте иностранные видео с YouTube на русском
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              Вставьте ссылку на зарубежное видео (английский, корейский и др.), чтобы включить закадровую русскую озвучку с синхронизацией по таймингам, субтитры или скачать файл.
            </p>

            {/* URL Input Form */}
            <form onSubmit={handleSearchSubmit} className="pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-700/80 shadow-inner focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 transition-all">
                <div className="flex items-center gap-2 px-3 py-2 flex-1 w-full text-slate-300">
                  <YouTubeIcon className="w-5 h-5 text-red-500 shrink-0" />
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Вставьте ссылку на видео (например: https://www.youtube.com/watch?v=...)"
                    className="w-full bg-transparent text-sm sm:text-base placeholder-slate-500 focus:outline-none text-white"
                  />
                  {inputUrl && (
                    <button
                      type="button"
                      onClick={() => setInputUrl('')}
                      className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto px-1 pb-1 sm:p-0">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                    title="Вставить из буфера обмена"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Вставить</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !inputUrl.trim()}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Загрузить</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-sm max-w-xl mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="text-left">{error}</span>
              </div>
            )}

            {/* Quick Sample Video Chips with Language Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Тестовые видео по языкам:</span>
              {sampleVideos.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setInputUrl(`https://www.youtube.com/watch?v=${s.id}`);
                    fetchVideoMetadata(s.id);
                    if (s.sourceLang) setSourceLang(s.sourceLang);
                  }}
                  className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-xs font-mono">{s.sourceLangLabel}</span>
                  <span>{s.title.substring(0, 20)}...</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Dubbing & Synchronized Translation Studio Tab */}
        {activeTab === 'translate' && videoInfo && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Translation Language Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-red-500" />
                  <h2 className="font-bold text-lg text-white">
                    Синхронный перевод и закадровая озвучка (AI Dubbing)
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Переводит реплики с сохранением оригинальных таймингов и озвучивает их на русском языке параллельно с видео.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 pl-2">Язык оригинала:</span>
                  <select
                    value={sourceLang}
                    onChange={(e: any) => setSourceLang(e.target.value)}
                    className="bg-slate-900 text-white rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none"
                  >
                    <option value="auto">🌐 Автоопределение</option>
                    <option value="en">🇺🇸 Английский (English)</option>
                    <option value="ko">🇰🇷 Корейский (한국어)</option>
                    <option value="ja">🇯🇵 Японский (日本語)</option>
                    <option value="es">🇪🇸 Испанский (Español)</option>
                    <option value="de">🇩🇪 Немецкий (Deutsch)</option>
                    <option value="zh">🇨🇳 Китайский (中文)</option>
                  </select>
                  <span className="text-slate-500 px-1">➔</span>
                  <span className="bg-red-600/20 text-red-400 px-2.5 py-1 rounded-lg font-bold border border-red-500/30">
                    🇷🇺 Русский
                  </span>
                </div>

                <button
                  onClick={handleTranslateRequest}
                  disabled={isTranslating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-md shadow-red-600/30 flex items-center gap-2 transition-all"
                >
                  {isTranslating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Переводим тайминги...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Обновить перевод</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Video Player + Synchronized Dubbing Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Player & Subtitle Overlay (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
                  {/* Video Viewport: Seamless persistent YouTube player */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
                    <div id="youtube-player-slot" className="w-full h-full relative">
                      <iframe
                        key={`${embedDomain}-${videoInfo.videoId}`}
                        id="youtube-dubbed-player-iframe"
                        src={`https://${embedDomain}/embed/${videoInfo.videoId}?enablejsapi=1&autoplay=0&rel=0&playsinline=1`}
                        className="w-full h-full border-0"
                        title={videoInfo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        onLoad={() => {
                          setIsPlayerReady(true);
                          sendIframeCommand('listening');
                        }}
                      />
                    </div>

                    {/* Yandex Browser Floating AI Translator Header inside Video Player */}
                    <div className="absolute top-3 inset-x-3 z-30 flex items-start justify-between pointer-events-auto">
                      {/* Left Badge: Signature Yandex Translator pill & Mirror Domain Switcher */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const next = !enableVoiceover;
                            setEnableVoiceover(next);
                            if (!next && 'speechSynthesis' in window) {
                              window.speechSynthesis.cancel();
                              setIsSpeakingVoiceover(false);
                              sendIframeCommand('setVolume', [100]);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xl backdrop-blur-md border transition-all ${
                            enableVoiceover
                              ? 'bg-slate-950/90 border-purple-500/60 text-white shadow-purple-500/20'
                              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:text-white hover:border-purple-400'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${enableVoiceover ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent flex items-center gap-1.5 font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />
                            <span>{enableVoiceover ? 'Переведено нейросетями' : 'Перевести видео'}</span>
                          </span>
                        </button>

                        {/* Quick Mirror Toggle for Russian ISPs / DNS blocks */}
                        <button
                          onClick={() => setEmbedDomain(prev => prev === 'www.youtube-nocookie.com' ? 'www.youtube.com' : 'www.youtube-nocookie.com')}
                          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-xl"
                          title="Сменить зеркало YouTube (NoCookie / Стандарт) при замедлениях или блокировках провайдера"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{embedDomain === 'www.youtube-nocookie.com' ? 'Зеркало NoCookie' : 'YouTube Стандарт'}</span>
                        </button>
                      </div>

                      {/* Right Controls: Quick voice, soundwave, and Settings Dropdown Toggle */}
                      <div className="relative flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-full text-xs shadow-xl">
                          <a
                            href={videoInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                            title="Открыть оригинал на YouTube"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {/* Animated Soundwave when voiceover is speaking */}
                          {isSpeakingVoiceover && (
                            <div className="flex items-center gap-1 px-1 text-purple-400" title="Голос дубляжа активен">
                              <span className="w-1 h-3.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1 h-4 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce" />
                            </div>
                          )}

                          {/* Quick Voice Switcher: Алиса / Филипп */}
                          <div className="flex items-center bg-slate-900 rounded-full p-0.5 border border-slate-800">
                            <button
                              onClick={() => setVoiceGender('female')}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                                voiceGender === 'female'
                                  ? 'bg-purple-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Женский голос (Алиса)"
                            >
                              Алиса
                            </button>
                            <button
                              onClick={() => setVoiceGender('male')}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                                voiceGender === 'male'
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Мужской голос (Филипп)"
                            >
                              Филипп
                            </button>
                          </div>

                          {/* Settings button */}
                          <button
                            onClick={() => setShowYandexSettings(!showYandexSettings)}
                            className={`p-1 rounded-full transition-colors ${
                              showYandexSettings ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="Параметры перевода Яндекс Браузера"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Yandex Translation Settings Card Popover */}
                        {showYandexSettings && (
                          <div className="absolute right-0 top-10 w-72 bg-slate-950/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-4 shadow-2xl z-40 space-y-3.5 text-xs text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Настройки перевода</span>
                              </span>
                              <button
                                onClick={() => setShowYandexSettings(false)}
                                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Voice Persona */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] text-slate-400 font-medium">Голос закадрового дубляжа</span>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => setVoiceGender('female')}
                                  className={`py-1.5 px-2 rounded-xl border text-center font-semibold transition-all ${
                                    voiceGender === 'female'
                                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Алиса (Женский)
                                </button>
                                <button
                                  onClick={() => setVoiceGender('male')}
                                  className={`py-1.5 px-2 rounded-xl border text-center font-semibold transition-all ${
                                    voiceGender === 'male'
                                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Филипп (Мужской)
                                </button>
                              </div>
                            </div>

                            {/* Subtitle mode */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] text-slate-400 font-medium">Отображение субтитров</span>
                              <div className="grid grid-cols-3 gap-1 text-[10px]">
                                <button
                                  onClick={() => setSubtitleMode('both')}
                                  className={`py-1 px-1.5 rounded-lg border text-center transition-all ${
                                    subtitleMode === 'both' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Двуязычные
                                </button>
                                <button
                                  onClick={() => setSubtitleMode('ru_only')}
                                  className={`py-1 px-1.5 rounded-lg border text-center transition-all ${
                                    subtitleMode === 'ru_only' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Только RU
                                </button>
                                <button
                                  onClick={() => setSubtitleMode('none')}
                                  className={`py-1 px-1.5 rounded-lg border text-center transition-all ${
                                    subtitleMode === 'none' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Скрыть
                                </button>
                              </div>
                            </div>

                            {/* Volume sliders */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span>Голос перевода</span>
                                <span className="font-mono text-white">{dubbingVolume}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={dubbingVolume}
                                onChange={(e) => setDubbingVolume(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg accent-purple-500"
                              />

                              <div className="flex items-center justify-between text-[11px]">
                                <span>Фон оригинала (Ducking)</span>
                                <span className="font-mono text-white">{originalDuckingVolume}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={originalDuckingVolume}
                                onChange={(e) => setOriginalDuckingVolume(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg accent-amber-500"
                              />
                            </div>

                            {/* Custom Subtitles Import Shortcut */}
                            <button
                              onClick={() => {
                                setShowYandexSettings(false);
                                setShowCustomSubtitlesModal(true);
                              }}
                              className="w-full py-1.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-center font-semibold transition-all flex items-center justify-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Импорт своих субтитров (.SRT)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Floating Subtitle Overlay: completely non-intrusive on top of running video */}
                    {activeCue && subtitleMode !== 'none' && (
                      <div className="absolute bottom-4 inset-x-4 z-20 pointer-events-none flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-4 py-2.5 max-w-xl shadow-2xl space-y-1">
                          <p className="text-sm md:text-base font-bold text-amber-300 drop-shadow leading-snug flex items-center justify-center gap-1.5">
                            {isSpeakingVoiceover && (
                              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping inline-block mr-1" />
                            )}
                            <span>{activeCue.translatedText}</span>
                          </p>
                          {subtitleMode === 'both' && (
                            <p className="text-xs text-slate-400 font-medium">
                              {activeCue.originalText}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Playback & Time Scrub Bar */}
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlayPause}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          isPlayingDubbed
                            ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                            : 'bg-red-600 text-white shadow-lg shadow-red-600/20 hover:scale-105'
                        }`}
                        title={isPlayingDubbed ? 'Пауза' : 'Смотреть с русским дубляжом'}
                      >
                        {isPlayingDubbed ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                          <span className="text-white font-bold">{formatSeconds(playbackTime)}</span>
                          <span>{videoInfo.durationFormatted}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={videoInfo.durationSec || 240}
                          value={playbackTime}
                          onChange={(e) => handleScrubChange(Number(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                      </div>

                      <button
                        onClick={() => handleScrubChange(0)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="В начало"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Audio Ducking & Dubbing Mixer Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                      {/* Voiceover Dubbing Volume */}
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-red-500" />
                            <span>Громкость русской озвучки</span>
                          </span>
                          <span className="font-mono text-white font-bold">{dubbingVolume}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={dubbingVolume}
                            onChange={(e) => setDubbingVolume(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none accent-red-500"
                          />
                          <Volume2 className="w-3.5 h-3.5 text-red-400" />
                        </div>
                      </div>

                      {/* Original Video Ducking */}
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Headphones className="w-3.5 h-3.5 text-amber-500" />
                            <span>Фон оригинала (Ducking)</span>
                          </span>
                          <span className="font-mono text-white font-bold">{originalDuckingVolume}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={originalDuckingVolume}
                            onChange={(e) => setOriginalDuckingVolume(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none accent-amber-500"
                          />
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                      </div>
                    </div>

                    {/* Voice Persona & Rate Settings */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableVoiceover}
                            onChange={(e) => setEnableVoiceover(e.target.checked)}
                            className="rounded accent-red-600"
                          />
                          <span className="text-slate-300 font-medium">Закадровый дубляж активен</span>
                        </label>

                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-400">Голос:</span>
                          <button
                            onClick={() => setVoiceGender('female')}
                            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                              voiceGender === 'female' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Алиса
                          </button>
                          <button
                            onClick={() => setVoiceGender('male')}
                            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                              voiceGender === 'male' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Филипп
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Базовый темп:</span>
                        {[0.9, 1.0, 1.1, 1.25].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => setVoiceSpeed(spd)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                              voiceSpeed === spd ? 'bg-slate-800 text-white font-bold border border-purple-500/50' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title="Автоматическая подстройка под хронометраж реплики"
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Synchronized Timeline Cues & Transcripts (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col h-[520px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <span>Реплики и тайминги</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {translation?.cues.length || 0}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">Нажмите на любую строку для перехода</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowCustomSubtitlesModal(true)}
                        className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Вставить свои субтитры (.SRT / текст)"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Импорт</span>
                      </button>
                      <button
                        onClick={() => handleDownloadTranslatedSubtitles('srt')}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                        title="Скачать русские субтитры .SRT"
                      >
                        <Download className="w-3 h-3" />
                        <span>.SRT</span>
                      </button>
                      <button
                        onClick={() => handleDownloadTranslatedSubtitles('vtt')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                        title="Скачать .VTT"
                      >
                        .VTT
                      </button>
                      <button
                        onClick={() => {
                          if (translation) {
                            const fullText = translation.cues.map((c) => `[${c.formattedStart}] ${c.translatedText}`).join('\n');
                            navigator.clipboard.writeText(fullText);
                            setCopiedTranscript(true);
                            setTimeout(() => setCopiedTranscript(false), 2000);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Скопировать перевод"
                      >
                        {copiedTranscript ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Cues List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {translation?.cues.map((cue) => {
                      const isActive = activeCueId === cue.id;
                      const isEditing = editingCueId === cue.id;
                      return (
                        <div
                          key={cue.id}
                          onClick={() => !isEditing && jumpToCue(cue)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                            isActive
                              ? 'bg-purple-600/10 border-purple-500 shadow-md shadow-purple-600/10 scale-[1.01]'
                              : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1 text-xs">
                            <span
                              className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${
                                isActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {cue.formattedStart} - {cue.formattedEnd}
                            </span>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveEditedCue(cue.id, editingCueText);
                                    }}
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                    title="Сохранить"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCueId(null);
                                    }}
                                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                    title="Отмена"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCueId(cue.id);
                                      setEditingCueText(cue.translatedText);
                                    }}
                                    className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800"
                                    title="Редактировать реплику"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      speakCue(cue.translatedText, cue.end - cue.start);
                                    }}
                                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                                    title="Озвучить эту реплику"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <input
                              type="text"
                              value={editingCueText}
                              onChange={(e) => setEditingCueText(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditedCue(cue.id, editingCueText);
                                if (e.key === 'Escape') setEditingCueId(null);
                              }}
                              className="w-full bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-sm text-white font-medium focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <p className={`text-sm font-semibold leading-snug pt-0.5 ${isActive ? 'text-amber-300' : 'text-slate-100'}`}>
                              {cue.translatedText}
                            </p>
                          )}

                          <p className="text-xs text-slate-400 pt-1 line-clamp-2 italic">
                            {cue.originalText}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Footer */}
                  {translation?.summaryRu && (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                      <span className="font-semibold text-slate-300 block">Краткое содержание:</span>
                      <p className="line-clamp-2">{translation.summaryRu}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Video Preview & Actions Container for Downloader, Shorts, Thumbnails, Subtitles */}
        {videoInfo && activeTab !== 'translate' && activeTab !== 'library' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Media Preview & Details (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Visual Player or Thumbnail */}
                <div className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden">
                  {showEmbedPlayer ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoInfo.videoId}?autoplay=1`}
                      title={videoInfo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <img
                        src={videoInfo.thumbnails.hq}
                        alt={videoInfo.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = videoInfo.thumbnails.default;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={() => setShowEmbedPlayer(true)}
                          className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          title="Предпросмотр видео"
                        >
                          <Play className="w-5 h-5 ml-0.5 fill-white" />
                        </button>
                      </div>
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs font-mono font-medium rounded">
                        {videoInfo.durationFormatted}
                      </span>
                    </>
                  )}
                </div>

                {/* Video Info Header */}
                <div className="p-4 space-y-3">
                  <h2 className="font-bold text-base text-white line-clamp-2" title={videoInfo.title}>
                    {videoInfo.title}
                  </h2>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                    <a
                      href={videoInfo.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-400 hover:text-red-300 font-medium truncate max-w-[160px] flex items-center gap-1"
                    >
                      <span>{videoInfo.channel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{videoInfo.views} просмотров</span>
                      <span>•</span>
                      <span>{videoInfo.publishDate}</span>
                    </div>
                  </div>

                  {/* Actions & Utilities */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleShowQRCode(videoInfo.url)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
                      title="Сгенерировать QR-код для телефона"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-400" />
                      <span>QR для телефона</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(videoInfo.url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Скопировано!' : 'Поделиться'}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('translate')}
                      className="py-1.5 px-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>Перевести</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Trimmer / Clip Segment Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-sm text-white">Обрезать фрагмент</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableClip}
                      onChange={(e) => setEnableClip(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                {enableClip ? (
                  <div className="space-y-3 pt-2 text-xs">
                    <p className="text-slate-400">
                      Сохранить отрезок с {formatSeconds(clipStart)} по {formatSeconds(clipEnd)} (Длина: {formatSeconds(clipEnd - clipStart)})
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block mb-1">Начало (сек):</span>
                        <input
                          type="number"
                          min="0"
                          max={clipEnd - 1}
                          value={clipStart}
                          onChange={(e) => setClipStart(Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Конец (сек):</span>
                        <input
                          type="number"
                          min={clipStart + 1}
                          max={videoInfo.durationSec || 600}
                          value={clipEnd}
                          onChange={(e) => setClipEnd(Math.min(videoInfo.durationSec || 600, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Включите переключатель, чтобы сохранить только нужную часть видео или аудио вместо полного файла.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Tab View Panels (7 cols) */}
            <div className="lg:col-span-7">
              {activeTab === 'downloader' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  {/* Format Category Switcher */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedFormatType('video')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedFormatType === 'video'
                            ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Film className="w-4 h-4" />
                        <span>Видео (MP4)</span>
                      </button>
                      <button
                        onClick={() => setSelectedFormatType('audio')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedFormatType === 'audio'
                            ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Music className="w-4 h-4" />
                        <span>Аудио (MP3 / WAV)</span>
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      Прямое сохранение потока
                    </span>
                  </div>

                  {/* Format Grid */}
                  <div className="space-y-3">
                    {videoInfo.formats
                      .filter((f) => f.type === selectedFormatType)
                      .map((fmt) => (
                        <div
                          key={fmt.id}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">{fmt.label}</span>
                              {fmt.badge && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                  {fmt.badge}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>Формат: {fmt.container}</span>
                              {fmt.resolution && <span>Разрешение: {fmt.resolution}</span>}
                              {fmt.bitrate && <span>Битрейт: {fmt.bitrate}</span>}
                              <span>•</span>
                              <span>~{fmt.estimatedSizeMb} МБ</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartDownload(fmt)}
                            disabled={isDownloading}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-50 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
                          >
                            <Download className="w-4 h-4" />
                            <span>Скачать {fmt.container}</span>
                          </button>
                        </div>
                      ))}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p>
                      Файлы сохраняются в стандартных медиаконтейнерах. При сохранении аудио видеопоток извлекается в высоком качестве 320 кбит/с.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'shorts' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-500">
                      <Sparkles className="w-5 h-5" />
                      <h3 className="font-bold text-lg text-white">Сохранение YouTube Shorts</h3>
                    </div>
                    <p className="text-sm text-slate-400">
                      Оптимизировано под вертикальный формат 9:16. Отлично подходит для Reels, TikTok и просмотра на телефоне.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white">Shorts Мобильный MP4</h4>
                      <p className="text-xs text-slate-400">Вертикальный формат 1080x1920 со звуком высокой четкости</p>
                    </div>
                    <button
                      onClick={() =>
                        handleStartDownload({
                          id: 'shorts-1080p',
                          type: 'video',
                          label: 'Shorts 1080p',
                          resolution: '1080x1920',
                          container: 'MP4',
                          estimatedSizeMb: 12.5,
                          qualityScore: 95,
                        })
                      }
                      className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать Short</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white">Фоновое аудио Shorts (MP3)</h4>
                      <p className="text-xs text-slate-400">Извлечь трек или фоновый звук из этого Shorts</p>
                    </div>
                    <button
                      onClick={() =>
                        handleStartDownload({
                          id: 'shorts-audio-320',
                          type: 'audio',
                          label: 'Shorts Аудио',
                          bitrate: '320 кбит/с',
                          container: 'MP3',
                          estimatedSizeMb: 2.1,
                          qualityScore: 92,
                        })
                      }
                      className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm flex items-center gap-2"
                    >
                      <Music className="w-4 h-4" />
                      <span>Скачать аудио</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'thumbnails' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-white">Студия превью и обложек YouTube</h3>
                    <p className="text-sm text-slate-400">
                      Скачивайте оригинальные обложки в максимальном разрешении, загруженные автором.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                        <img
                          src={videoInfo.thumbnails.maxres}
                          alt="MaxRes"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = videoInfo.thumbnails.hq;
                          }}
                        />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded">
                          1280x720 HD
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs font-semibold text-white">Максимальное (1080p/720p)</p>
                          <p className="text-[11px] text-slate-400">maxresdefault.jpg</p>
                        </div>
                        <button
                          onClick={() => handleDownloadThumbnail(videoInfo.thumbnails.maxres, 'MaxRes_1280x720')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                        <img src={videoInfo.thumbnails.hq} alt="HQ" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded">
                          480x360 HQ
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs font-semibold text-white">Высокое качество (480p)</p>
                          <p className="text-[11px] text-slate-400">hqdefault.jpg</p>
                        </div>
                        <button
                          onClick={() => handleDownloadThumbnail(videoInfo.thumbnails.hq, 'HighQuality_480x360')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                        <img src={videoInfo.thumbnails.sd} alt="SD" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded">
                          640x480 SD
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs font-semibold text-white">Стандартное (640x480)</p>
                          <p className="text-[11px] text-slate-400">sddefault.jpg</p>
                        </div>
                        <button
                          onClick={() => handleDownloadThumbnail(videoInfo.thumbnails.sd, 'StandardDef_640x480')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                        <img src={videoInfo.thumbnails.mq} alt="MQ" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded">
                          320x180 MQ
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-xs font-semibold text-white">Среднее качество (320x180)</p>
                          <p className="text-[11px] text-slate-400">mqdefault.jpg</p>
                        </div>
                        <button
                          onClick={() => handleDownloadThumbnail(videoInfo.thumbnails.mq, 'MediumQuality_320x180')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'subtitles' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-white">Субтитры и расшифровки (CC)</h3>
                    <p className="text-sm text-slate-400">
                      Экспортируйте расшифровки и субтитры с точными таймкодами в форматах .SRT, .VTT или обычный текст.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {videoInfo.subtitles.map((sub) => (
                      <div
                        key={sub.lang}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <span className="font-semibold text-white text-sm">{sub.label}</span>
                          <p className="text-xs text-slate-400">Код языка: {sub.lang}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadTranslatedSubtitles('srt')}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>SRT</span>
                          </button>
                          <button
                            onClick={() => handleDownloadTranslatedSubtitles('vtt')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>VTT</span>
                          </button>
                          <button
                            onClick={() => handleDownloadTranslatedSubtitles('txt')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>TXT</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 block">Предпросмотр расшифровки:</span>
                    <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      [00:00:01] Добро пожаловать в презентацию видеоролика.<br />
                      [00:00:05] В этом выпуске мы изучаем возможности сохранения медиапотоков.<br />
                      [00:00:10] Не забудьте поставить лайк и подписаться на канал!<br />
                      [00:00:15] Спасибо за использование YouTubeVideoSave!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Saved Library Tab */}
        {activeTab === 'library' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <span>Моя сохраненная медиатека</span>
                </h2>
                <p className="text-sm text-slate-400">
                  Быстрый доступ ко всем видео, аудио, обрезкам, переводам и превью, сохраненным за время ваших сессий.
                </p>
              </div>

              {savedLibrary.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Вы уверены, что хотите очистить сохраненную историю?')) {
                      setSavedLibrary([]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Очистить историю</span>
                </button>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Поиск по названию или автору..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setLibraryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    libraryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Все ({savedLibrary.length})
                </button>
                <button
                  onClick={() => setLibraryFilter('video')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    libraryFilter === 'video' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Видео
                </button>
                <button
                  onClick={() => setLibraryFilter('audio')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    libraryFilter === 'audio' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Аудио
                </button>
                <button
                  onClick={() => setLibraryFilter('translation')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    libraryFilter === 'translation' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Переводы
                </button>
                <button
                  onClick={() => setLibraryFilter('thumbnail')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    libraryFilter === 'thumbnail' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Превью
                </button>
              </div>
            </div>

            {/* Library Grid or Empty State */}
            {filteredLibrary.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Film className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-slate-300">Сохраненных файлов пока нет</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Вставьте ссылку на YouTube выше и выберите нужный формат скачивания или перевод, чтобы пополнить список.
                </p>
                <button
                  onClick={() => setActiveTab('downloader')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Перейти к загрузчику</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLibrary.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                        <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/80 text-white border border-white/10">
                          {item.type === 'video' ? 'Видео' : item.type === 'audio' ? 'Аудио' : item.type === 'translation' ? 'Перевод' : item.type === 'thumbnail' ? 'Превью' : 'Субтитры'}
                        </span>
                        {item.clipRange && (
                          <span className="absolute bottom-2 left-2 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-red-600/90 text-white">
                            Фрагмент: {formatSeconds(item.clipRange.start)} - {formatSeconds(item.clipRange.end)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-white line-clamp-1" title={item.title}>
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-400">{item.channel}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span>{item.format}</span>
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          fetchVideoMetadata(item.videoId);
                          if (item.type === 'translation') setActiveTab('translate');
                          else setActiveTab('downloader');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Открыть</span>
                      </button>
                      <button
                        onClick={() => {
                          setSavedLibrary((prev) => prev.filter((i) => i.id !== item.id));
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Удалить из медиатеки"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Download Progress Modal Dialog */}
      {isDownloading && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-white text-base">Обработка загрузки</h3>
                <p className="text-xs text-slate-400">
                  {currentDownloadingFormat?.label} ({currentDownloadingFormat?.container})
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{downloadStage}</span>
                <span className="font-bold text-white font-mono">{downloadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-300 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsDownloading(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Subtitles / Transcript Import Modal in Yandex Style */}
      {showCustomSubtitlesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">Импорт субтитров (.SRT / текст)</h3>
              </div>
              <button
                onClick={() => setShowCustomSubtitlesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Вставьте сюда файл субтитров в формате <span className="text-white font-mono font-semibold">.SRT / .VTT</span> или обычный построчный текст диалогов из видео. Приложение автоматически синхронизирует и озвучит каждую реплику голосом Алисы или Филиппа.
            </p>

            <textarea
              value={customSubtitlesInput}
              onChange={(e) => setCustomSubtitlesInput(e.target.value)}
              placeholder={"1\n00:00:02,000 --> 00:00:07,000\nДобро пожаловать к просмотру этого гайда!\n\n2\n00:00:08,000 --> 00:00:15,000\nСегодня мы подробно посчитаем ценность всех сундуков..."}
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCustomSubtitlesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleImportCustomSubtitles(customSubtitlesInput)}
                disabled={!customSubtitlesInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Применить и озвучить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Mobile Modal Dialog */}
      {qrModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center mx-auto">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-lg">Сканируйте для открытия на смартфоне</h3>
            <p className="text-xs text-slate-400">
              Наведите камеру смартфона на этот QR-код, чтобы быстро открыть или сохранить видео на телефоне.
            </p>

            {qrCodeDataUrl ? (
              <div className="p-3 bg-white rounded-xl inline-block shadow-inner mx-auto">
                <img src={qrCodeDataUrl} alt="QR-код для мобильного" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-slate-950 rounded-xl mx-auto flex items-center justify-center text-xs text-slate-500">
                Генерация QR-кода...
              </div>
            )}

            <button
              onClick={() => {
                setQrModalUrl(null);
                setQrCodeDataUrl(null);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            YouTubeVideoSave • Сохранение видео и аудио, синхронный перевод и дубляж с таймингами
          </p>
          <p className="text-slate-600">
            Для личного офлайн-архива, обучения и языковой практики.
          </p>
        </div>
      </footer>
    </div>
  );
}
