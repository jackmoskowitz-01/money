import { useCallback, useEffect } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/getAuthToken';

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-tts`;
const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;

interface CopilotVoiceProps {
  voiceMode: boolean;
  setVoiceMode: (v: boolean) => void;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  isSpeaking: boolean;
  setIsSpeaking: (v: boolean) => void;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text: string) => void;
  // Refs
  voiceModeRef: React.MutableRefObject<boolean>;
  isSpeakingRef: React.MutableRefObject<boolean>;
  currentSpokenTextRef: React.MutableRefObject<string>;
  lastVoiceSentRef: React.MutableRefObject<string>;
  lastVoiceSentAtRef: React.MutableRefObject<number>;
  ttsQueueRef: React.MutableRefObject<string[]>;
  ttsPlayingRef: React.MutableRefObject<boolean>;
  scribeConnectedRef: React.MutableRefObject<boolean>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  recognitionRef: React.MutableRefObject<any>;
  silenceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingTranscriptRef: React.MutableRefObject<string>;
  // Callback to register TTS chunk function
  onRegisterEnqueueTTS: (fn: (text: string) => void) => void;
}

export function useCopilotVoice({
  voiceMode,
  setVoiceMode,
  isRecording,
  setIsRecording,
  isSpeaking,
  setIsSpeaking,
  input,
  setInput,
  sendMessage,
  voiceModeRef,
  isSpeakingRef,
  currentSpokenTextRef,
  lastVoiceSentRef,
  lastVoiceSentAtRef,
  ttsQueueRef,
  ttsPlayingRef,
  scribeConnectedRef,
  audioRef,
  recognitionRef,
  silenceTimerRef,
  pendingTranscriptRef,
  onRegisterEnqueueTTS,
}: CopilotVoiceProps) {

  const normalizeSpeech = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const isLikelyEcho = (heard: string, spoken: string) => {
    const h = normalizeSpeech(heard);
    const s = normalizeSpeech(spoken);
    if (!h || !s) return false;
    if (s.includes(h) || h.includes(s)) return true;
    const hWords = h.split(' ').filter(w => w.length > 2);
    const sWords = new Set(s.split(' ').filter(w => w.length > 2));
    if (hWords.length === 0) return false;
    const overlap = hWords.filter(w => sWords.has(w)).length;
    return overlap / hWords.length >= 0.7;
  };

  // Interrupt TTS — stop audio immediately
  const interruptTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
    currentSpokenTextRef.current = '';
    setIsSpeaking(false);
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    pendingTranscriptRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Play a single TTS chunk
  const playTTSChunk = useCallback(async (text: string): Promise<void> => {
    if (!voiceModeRef.current) return;
    try {
      const authToken = await getAuthToken();
      const resp = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) throw new Error('TTS failed');
      const audioBlob = await resp.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      return new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(audioUrl); audioRef.current = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); audioRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (e) {
      console.error('TTS chunk error:', e);
    }
  }, []);

  // Process TTS queue sequentially
  const processTTSQueue = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    while (ttsQueueRef.current.length > 0 && voiceModeRef.current) {
      const chunk = ttsQueueRef.current.shift()!;
      currentSpokenTextRef.current = chunk;
      await playTTSChunk(chunk);
    }
    isSpeakingRef.current = false;
    currentSpokenTextRef.current = '';
    setIsSpeaking(false);
    ttsPlayingRef.current = false;
  }, [playTTSChunk]);

  // Queue text for chunked TTS
  const enqueueTTSChunk = useCallback((text: string) => {
    if (!voiceModeRef.current || !text.trim()) return;
    ttsQueueRef.current.push(text.trim());
    processTTSQueue();
  }, [processTTSQueue]);

  // Register the enqueueTTSChunk function with the parent
  useEffect(() => {
    onRegisterEnqueueTTS(enqueueTTSChunk);
  }, [enqueueTTSChunk, onRegisterEnqueueTTS]);

  // Speak full text by splitting into sentence chunks
  const speakText = useCallback(async (text: string) => {
    if (!voiceModeRef.current) return;
    const chunks = text.split(/(?<=\.)\s+|(?<=\?)\s+|(?<=!)\s+|\n\n+/).filter(c => c.trim().length > 10);
    if (chunks.length === 0) {
      enqueueTTSChunk(text);
    } else {
      chunks.forEach(c => enqueueTTSChunk(c));
    }
  }, [enqueueTTSChunk]);

  // ElevenLabs Scribe — realtime STT via useScribe hook
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: (data) => {
      if (!voiceModeRef.current) return;
      const text = data.text?.trim();
      if (!text) return;

      // Echo filter
      if (isSpeakingRef.current && isLikelyEcho(text, currentSpokenTextRef.current)) return;
      if (isSpeakingRef.current) interruptTTS();

      // De-dupe
      const now = Date.now();
      if (text === lastVoiceSentRef.current && now - lastVoiceSentAtRef.current < 2500) return;
      lastVoiceSentRef.current = text;
      lastVoiceSentAtRef.current = now;

      setInput('');
      sendMessage(text);
    },
    onPartialTranscript: (data) => {
      if (!voiceModeRef.current) return;
      const text = data.text?.trim();
      if (!text) return;
      if (isSpeakingRef.current && isLikelyEcho(text, currentSpokenTextRef.current)) return;
      if (isSpeakingRef.current) interruptTTS();
      setInput(text);
    },
  });

  // Toggle voice mode on/off — uses ElevenLabs Scribe
  const toggleVoiceMode = useCallback(async () => {
    if (voiceMode) {
      // Turn off
      setVoiceMode(false);
      voiceModeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      pendingTranscriptRef.current = '';
      interruptTTS();
      setIsRecording(false);
      setInput('');
      if (scribeConnectedRef.current) {
        try {
          scribe.disconnect();
        } catch {
          /* disconnect may throw if already closed */
        }
        scribeConnectedRef.current = false;
      }
      toast('Voice mode off');
    } else {
      // Turn on
      setVoiceMode(true);
      voiceModeRef.current = true;
      try {
        const authToken = await getAuthToken();
        const tokenResp = await fetch(SCRIBE_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!tokenResp.ok) throw new Error('Failed to get voice token');
        const { token } = await tokenResp.json();
        await scribe.connect({
          token,
          microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        scribeConnectedRef.current = true;
        setIsRecording(true);
        toast('🎙️ Voice mode on — just talk naturally. Interrupt anytime.');
      } catch (e: any) {
        console.error('Voice mode start error:', e);
        setVoiceMode(false);
        voiceModeRef.current = false;
        toast.error('Failed to start voice mode. Check your microphone.');
      }
    }
  }, [voiceMode, scribe, interruptTTS]);

  // Legacy voice input toggle (for manual mic button when not in voice mode)
  const toggleVoice = () => {
    if (voiceMode) return; // Handled by voice mode
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Voice recognition failed');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return {
    toggleVoiceMode,
    toggleVoice,
    interruptTTS,
    enqueueTTSChunk,
    speakText,
  };
}

export default useCopilotVoice;
