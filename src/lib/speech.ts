export interface GermanVoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  isDeDE: boolean;
  localService: boolean;
}

class GermanSpeechService {
  private listeners = new Set<() => void>();
  private voices: SpeechSynthesisVoice[] = [];
  private speaking = false;
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    this.initialized = true;
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length > 0) {
        this.voices = all;
        this.notify();
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    // Asynchronous voice loading fallback for mobile/Chromium
    setTimeout(loadVoices, 250);
    setTimeout(loadVoices, 1000);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  getGermanVoices(): GermanVoiceInfo[] {
    const german = this.voices.filter((v) => v.lang.toLowerCase().startsWith('de'));
    german.sort((a, b) => {
      const aDeDE = a.lang.toLowerCase() === 'de-de' ? 0 : 1;
      const bDeDE = b.lang.toLowerCase() === 'de-de' ? 0 : 1;
      if (aDeDE !== bDeDE) return aDeDE - bDeDE;
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return german.map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isDeDE: v.lang.toLowerCase() === 'de-de',
      localService: v.localService,
    }));
  }

  refreshVoices(): GermanVoiceInfo[] {
    if (this.isSupported()) {
      this.voices = window.speechSynthesis.getVoices();
      this.notify();
    }
    return this.getGermanVoices();
  }

  stop() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    this.speaking = false;
    this.notify();
  }

  /**
   * Speaks German text ONLY using an authentic German voice.
   * Never silently substitutes an English voice.
   */
  speak(
    text: string,
    options: {
      voiceURI?: string;
      rate?: number;
      repeat?: number;
      onEnd?: () => void;
    } = {}
  ): { ok: boolean; error?: string } {
    if (!this.isSupported()) {
      return { ok: false, error: 'Browser SpeechSynthesis is not supported on this device.' };
    }

    const germanVoices = this.getGermanVoices();
    if (germanVoices.length === 0) {
      return {
        ok: false,
        error:
          'No German (de-DE) text-to-speech voice was detected on your device. Install a German system voice in your OS or browser settings to enable pronunciation.',
      };
    }

    const selectedMeta =
      (options.voiceURI && germanVoices.find((v) => v.voiceURI === options.voiceURI)) ||
      germanVoices[0];

    const voiceObj = this.voices.find((v) => v.voiceURI === selectedMeta.voiceURI);
    if (!voiceObj) {
      return {
        ok: false,
        error: 'Selected German voice is unavailable. Refresh voices in Preferences.',
      };
    }

    this.stop();

    const cleanText = text.replace(/\s+-\s*$/, '').trim();
    const repeatCount = Math.max(1, Math.min(3, options.repeat ?? 1));
    const rate = Math.max(0.4, Math.min(1.5, options.rate ?? 0.95));

    let remaining = repeatCount;
    const speakNext = () => {
      if (remaining <= 0) {
        this.speaking = false;
        this.notify();
        options.onEnd?.();
        return;
      }
      remaining -= 1;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.voice = voiceObj;
      utterance.lang = voiceObj.lang || 'de-DE';
      utterance.rate = rate;
      utterance.onstart = () => {
        this.speaking = true;
        this.notify();
      };
      utterance.onend = () => {
        if (remaining > 0) {
          setTimeout(speakNext, 350);
        } else {
          this.speaking = false;
          this.notify();
          options.onEnd?.();
        }
      };
      utterance.onerror = () => {
        this.speaking = false;
        this.notify();
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
    return { ok: true };
  }
}

export const speechService = new GermanSpeechService();
