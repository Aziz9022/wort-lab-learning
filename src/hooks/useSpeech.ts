import { useCallback, useEffect, useState } from 'react';
import { speechService, type GermanVoiceInfo } from '../lib/speech';

export function useSpeech(preferredVoiceURI: string, defaultRate: number) {
  const [germanVoices, setGermanVoices] = useState<GermanVoiceInfo[]>(() =>
    speechService.getGermanVoices()
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(() => speechService.isSpeaking());
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setGermanVoices(speechService.getGermanVoices());
      setIsSpeaking(speechService.isSpeaking());
    };
    sync();
    return speechService.subscribe(sync);
  }, []);

  const refreshVoices = useCallback(() => {
    const list = speechService.refreshVoices();
    setGermanVoices(list);
    if (list.length > 0) setVoiceError(null);
    return list;
  }, []);

  const speak = useCallback(
    (text: string, opts?: { rate?: number; repeat?: number }) => {
      const res = speechService.speak(text, {
        voiceURI: preferredVoiceURI,
        rate: opts?.rate ?? defaultRate,
        repeat: opts?.repeat ?? 1,
      });
      if (!res.ok) {
        setVoiceError(res.error || 'Unable to play German audio.');
      } else {
        setVoiceError(null);
      }
      return res;
    },
    [preferredVoiceURI, defaultRate]
  );

  const speakSlow = useCallback(
    (text: string, repeat = 1) => {
      return speak(text, { rate: 0.65, repeat });
    },
    [speak]
  );

  const stop = useCallback(() => {
    speechService.stop();
  }, []);

  return {
    isSupported: speechService.isSupported(),
    germanVoices,
    hasGermanVoice: germanVoices.length > 0,
    isSpeaking,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    refreshVoices,
    speak,
    speakSlow,
    stop,
  };
}
