import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send, Loader2, Sparkles, Trash2, ChevronDown,
  Mic, MicOff, Copy, Check, Bell, BellOff,
  Paperclip, FileText, X, Pin, PinOff, ExternalLink, AudioLines,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildings } from '@/data/mockData';
import { usePipeline } from '@/hooks/usePipeline';
import { stageLabels } from '@/data/pipelineData';
import { leaseComps } from '@/data/pipelineData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CopilotFollowUps from '@/components/copilot/CopilotFollowUps';
import CopilotHistory from '@/components/copilot/CopilotHistory';
import CopilotSlashCommands from '@/components/copilot/CopilotSlashCommands';

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-copilot`;
const FILE_PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-parse-file`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-tts`;

type Msg = { role: 'user' | 'assistant'; content: string; fileName?: string; pinned?: boolean };

const SUGGESTIONS = [
  "What's my best next move with McKinsey?",
  "Draft a check-in email for Deloitte",
  "Which prospects are expiring soon?",
  "What are current Class A rents in East End?",
  "Move McKinsey to Meeting Held",
  "Create a follow-up task for Deloitte",
];

// Page context mapping
const PAGE_CONTEXT: Record<string, string> = {
  '/': 'User is on the Dashboard — showing overview of pipeline, tasks, and activity.',
  '/pipeline': 'User is on the Pipeline page — viewing the Kanban board of all deals.',
  '/prospects': 'User is on the Prospects page — browsing prospect lists and search.',
  '/map': 'User is on the Map View — exploring DC buildings on an interactive map.',
  '/news': 'User is on the News/Intel page — viewing market news and company intelligence.',
  '/tasks': 'User is on the Tasks page — managing follow-ups and to-dos.',
  '/scoop': 'User is on the Scoop Board — collaborative broker intelligence sharing.',
  '/activities': 'User is on the Activity Logger — tracking calls, tours, emails, meetings.',
  '/settings': 'User is on Settings — managing profile and preferences.',
};

export default function DealCopilot() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [proactiveAlert, setProactiveAlert] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [fileContext, setFileContext] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const currentSpokenTextRef = useRef('');
  const lastVoiceSentRef = useRef('');
  const lastVoiceSentAtRef = useRef(0);
  const { pipeline, refetch: refetchPipeline } = usePipeline();

  // Build context string from pipeline + buildings + page
  const buildContext = useCallback(() => {
    const parts: string[] = [];

    // Current page context
    const pageCtx = PAGE_CONTEXT[location.pathname];
    if (pageCtx) parts.push(`### Current Page\n${pageCtx}`);

    // Tenant detail page
    const tenantMatch = location.pathname.match(/\/building\/(.+)\/tenant\/(.+)/);
    if (tenantMatch) {
      const [, bId, tId] = tenantMatch;
      const building = buildings.find(b => b.id === bId);
      const tenant = building?.tenants.find(t => t.id === tId);
      if (tenant && building) {
        parts.push(`### Currently Viewing Prospect\n- **${tenant.name}** at ${building.name} | ${tenant.sqft.toLocaleString()} SF | Floor ${tenant.floor} | Lease expires: ${tenant.leaseExpiration} | Contact: ${tenant.contactName} (${tenant.contactTitle}) | Industry: ${tenant.industry} | Headcount: ${tenant.headcount}`);
      }
    }

    // Pipeline summary
    if (pipeline.length > 0) {
      parts.push('\n### Pipeline Deals');
      const stageGroups: Record<string, number> = {};
      pipeline.forEach(item => {
        const building = buildings.find(b => b.id === item.buildingId);
        const tenant = building?.tenants.find(t => t.id === item.tenantId);
        const name = item.isManual ? item.prospectName : tenant?.name;
        const company = item.isManual ? item.prospectCompany : building?.name;
        const sqft = item.isManual ? item.prospectSqft : tenant?.sqft;
        const expiry = tenant?.leaseExpiration || 'N/A';
        const stage = stageLabels[item.stage];
        stageGroups[item.stage] = (stageGroups[item.stage] || 0) + 1;
        const notes = item.notes.length > 0 ? ` | Notes: ${item.notes.slice(-2).join('; ')}` : '';
        const touchpoints = (item.sentTouchpoints || []).length;
        parts.push(`- **${name}** (tenant_id: ${item.tenantId}, building_id: ${item.buildingId}) at ${company} | ${sqft?.toLocaleString()} SF | Stage: ${stage} | Lease expires: ${expiry} | ${touchpoints} touchpoints sent${notes}`);
      });
      parts.push(`\nPipeline summary: ${Object.entries(stageGroups).map(([s, c]) => `${stageLabels[s as keyof typeof stageLabels]}: ${c}`).join(', ')}`);
    }

    // Buildings summary
    parts.push('\n### Key Buildings');
    buildings.forEach(b => {
      parts.push(`- **${b.name}** (id: ${b.id}, ${b.address}) | ${b.class} Class | ${b.sqft.toLocaleString()} SF | Vacancy: ${b.vacancyRate}% | Owner: ${b.owner} | ${b.tenants.length} tenants`);
    });

    // Top lease comps
    parts.push('\n### Recent Lease Comps');
    leaseComps.slice(0, 5).forEach(c => {
      parts.push(`- ${c.tenant} at ${c.building} | ${c.sqft.toLocaleString()} SF | $${c.rentPerSf}/SF | ${c.dealType} | ${c.submarket}`);
    });

    return parts.join('\n');
  }, [pipeline, location.pathname]);

  // Load conversation history
  useEffect(() => {
    if (!user || hasLoadedHistory) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from('copilot_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const convId = (data[0] as any).conversation_id;
        const { data: msgs } = await supabase
          .from('copilot_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          setConversationId(convId);
          setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content })));
        }
      }
      setHasLoadedHistory(true);
    };
    loadHistory();
  }, [user, hasLoadedHistory]);

  // Save message to DB
  const persistMessage = useCallback(async (msg: Msg, convId: string) => {
    if (!user) return;
    await supabase.from('copilot_messages').insert({
      user_id: user.id,
      conversation_id: convId,
      role: msg.role,
      content: msg.content,
    } as any);
  }, [user]);

  // Proactive alerts check
  useEffect(() => {
    if (!alertsEnabled || pipeline.length === 0) return;

    const now = new Date();
    const expiringThisMonth = pipeline.filter(item => {
      const building = buildings.find(b => b.id === item.buildingId);
      const tenant = building?.tenants.find(t => t.id === item.tenantId);
      if (!tenant) return false;
      const parts = tenant.leaseExpiration.split('/');
      if (parts.length < 2) return false;
      const expMonth = parseInt(parts[0]);
      const expYear = parseInt(parts[1]);
      return expYear === now.getFullYear() && expMonth === now.getMonth() + 1;
    });

    const overdueFollowUps = pipeline.flatMap(item =>
      (item.sentTouchpoints || [])
        .filter(tp => tp.followUpDate && tp.followUpDate < now.toISOString())
    );

    if (expiringThisMonth.length > 0 || overdueFollowUps.length > 0) {
      const alerts: string[] = [];
      if (expiringThisMonth.length > 0) alerts.push(`${expiringThisMonth.length} lease(s) expire this month`);
      if (overdueFollowUps.length > 0) alerts.push(`${overdueFollowUps.length} overdue follow-up(s)`);
      setProactiveAlert(alerts.join(' · '));
    }
  }, [pipeline, alertsEnabled]);

  // Auto-scroll smoothly
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keep voiceModeRef in sync
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Silence timer — after user stops speaking, auto-send after a pause
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef('');

  const normalizeSpeech = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isLikelyEcho = (heard: string, spoken: string) => {
    const h = normalizeSpeech(heard);
    const s = normalizeSpeech(spoken);
    if (!h || !s) return false;

    // Direct substring match catches most speaker feedback loops
    if (s.includes(h) || h.includes(s)) return true;

    const hWords = h.split(' ').filter(w => w.length > 2);
    const sWords = new Set(s.split(' ').filter(w => w.length > 2));
    if (hWords.length === 0) return false;

    const overlap = hWords.filter(w => sWords.has(w)).length;
    return overlap / hWords.length >= 0.7;
  };

  // Interrupt TTS — stop audio immediately and clear pending state
  const interruptTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
    currentSpokenTextRef.current = '';
    setIsSpeaking(false);
    pendingTranscriptRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Text-to-speech via ElevenLabs (does NOT restart listening — it's already running)
  const speakText = useCallback(async (text: string) => {
    if (!voiceModeRef.current) return;
    isSpeakingRef.current = true;
    currentSpokenTextRef.current = text;
    setIsSpeaking(true);

    try {
      const resp = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!resp.ok) throw new Error('TTS failed');

      const audioBlob = await resp.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        isSpeakingRef.current = false;
        currentSpokenTextRef.current = '';
        setIsSpeaking(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        isSpeakingRef.current = false;
        currentSpokenTextRef.current = '';
        setIsSpeaking(false);
        audioRef.current = null;
      };

      await audio.play();
    } catch (e) {
      console.error('TTS error:', e);
      isSpeakingRef.current = false;
      currentSpokenTextRef.current = '';
      setIsSpeaking(false);
    }
  }, []);

  // Start continuous listening (always-on mic for voice mode)
  const startContinuousListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    if (!voiceModeRef.current) return;

    // Stop any existing recognition first
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';


    recognition.onresult = (e: any) => {
      // Only process NEW results from this event
      let newFinal = '';
      let newInterim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += e.results[i][0].transcript;
        } else {
          newInterim += e.results[i][0].transcript;
        }
      }

      const heard = (newFinal || newInterim).trim();
      if (!heard) return;

      // If AI is speaking, ignore echoed bot audio; interrupt only on genuinely new user speech
      if (isSpeakingRef.current) {
        if (isLikelyEcho(heard, currentSpokenTextRef.current)) {
          return;
        }
        interruptTTS();
      }

      // Show current utterance in input
      setInput(heard);

      // Track final transcript for auto-send
      if (newFinal.trim()) {
        pendingTranscriptRef.current = newFinal.trim();

        // Reset silence timer — send after 1.2s of silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (pendingTranscriptRef.current && voiceModeRef.current) {
            const toSend = pendingTranscriptRef.current;
            pendingTranscriptRef.current = '';
            setInput('');

            // De-dupe accidental duplicate sends from recognition edge cases
            const now = Date.now();
            if (toSend === lastVoiceSentRef.current && now - lastVoiceSentAtRef.current < 2500) {
              return;
            }
            lastVoiceSentRef.current = toSend;
            lastVoiceSentAtRef.current = now;

            // Restart recognition to clear accumulated results buffer
            try { recognition.stop(); } catch {}

            sendMessage(toSend);
          }
        }, 1200);
      }
    };

    recognition.onend = () => {
      // Auto-restart if voice mode is still on (browser may stop it)
      if (voiceModeRef.current) {
        setTimeout(() => {
          if (voiceModeRef.current) {
            startContinuousListening();
          }
        }, 200);
      } else {
        setIsRecording(false);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('Speech recognition error:', e.error);
      if (voiceModeRef.current) {
        setTimeout(() => startContinuousListening(), 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {}
  }, [interruptTTS]);

  // Toggle voice mode on/off
  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) {
      // Turn off
      setVoiceMode(false);
      voiceModeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      pendingTranscriptRef.current = '';
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      interruptTTS();
      setIsRecording(false);
      setInput('');
      toast('Voice mode off');
    } else {
      // Turn on
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        toast.error('Voice not supported in this browser');
        return;
      }
      setVoiceMode(true);
      voiceModeRef.current = true;
      toast('🎙️ Voice mode on — always listening. Just talk to interrupt.');
      startContinuousListening();
    }
  }, [voiceMode, startContinuousListening, interruptTTS]);

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

  // Copy message
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Clear conversation
  const handleClear = async () => {
    setMessages([]);
    setFileContext(null);
    if (conversationId && user) {
      await supabase.from('copilot_messages').delete().eq('conversation_id', conversationId).eq('user_id', user.id);
    }
    setConversationId(null);
  };

  // Load a conversation from history
  const handleLoadConversation = (convId: string, msgs: { role: string; content: string }[]) => {
    setConversationId(convId);
    setMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    setFileContext(null);
  };

  // New conversation
  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setFileContext(null);
  };

  // Toggle pin on a message
  const togglePin = (index: number) => {
    setMessages(prev => prev.map((m, i) =>
      i === index ? { ...m, pinned: !m.pinned } : m
    ));
    toast.success(messages[index]?.pinned ? 'Unpinned' : 'Pinned');
  };

  // Check if message contains email draft
  const hasEmailDraft = (content: string) => {
    return content.toLowerCase().includes('subject:') && content.toLowerCase().includes('dear ');
  };

  // Export email draft
  const handleExportEmail = (content: string) => {
    // Extract subject and body from markdown
    const lines = content.split('\n');
    const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:') || l.toLowerCase().includes('**subject:'));
    const subject = subjectLine?.replace(/\*?\*?subject:\*?\*?\s*/i, '').trim() || '';
    navigator.clipboard.writeText(content);
    toast.success('Email draft copied — paste into your email composer');
  };

  // File handling
  const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndAttachFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndAttachFile(file);
    e.target.value = '';
  };

  const validateAndAttachFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 20MB)');
      return;
    }
    setAttachedFile(file);
    toast.success(`📎 ${file.name} attached`);
  };

  const sendFileMessage = async (question: string) => {
    if (!attachedFile || isLoading) return;

    const fileName = attachedFile.name;
    const userContent = question.trim() || `Analyze this document: ${fileName}`;
    const userMsg: Msg = { role: 'user', content: `📎 **${fileName}**\n${userContent}`, fileName };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const convId = conversationId || crypto.randomUUID();
    if (!conversationId) setConversationId(convId);
    await persistMessage({ role: 'user', content: userContent }, convId);

    let assistantSoFar = '';

    try {
      const formData = new FormData();
      formData.append('file', attachedFile);
      formData.append('question', userContent);
      formData.append('context', buildContext());

      const resp = await fetch(FILE_PARSE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `File analysis failed (${resp.status})`);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantSoFar += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                  }
                  return [...prev, { role: 'assistant', content: assistantSoFar }];
                });
              }
            } catch { /* partial */ }
          }
        }
      } else {
        const data = await resp.json();
        assistantSoFar = data.content || data.error || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar }]);
      }

      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);
      }
    } catch (e: any) {
      console.error('File analysis error:', e);
      toast.error(e.message || 'Failed to analyze file');
      if (!assistantSoFar) setMessages(prev => prev.slice(0, -1));
    }

    // Keep file context for multi-turn follow-ups
    if (assistantSoFar) {
      setFileContext(`Previously analyzed file "${fileName}". Summary:\n${assistantSoFar.slice(0, 2000)}`);
    }
    setAttachedFile(null);
    setIsLoading(false);
  };

  const sendMessage = async (text: string) => {
    // If file is attached, route to file handler
    if (attachedFile) {
      return sendFileMessage(text);
    }
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Generate or reuse conversation ID
    const convId = conversationId || crypto.randomUUID();
    if (!conversationId) setConversationId(convId);

    // Persist user message
    await persistMessage(userMsg, convId);

    let assistantSoFar = '';

    try {
      const resp = await fetch(COPILOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          context: voiceModeRef.current ? '' : (buildContext() + (fileContext ? `\n\n### Previous File Analysis\n${fileContext}` : '')),
          mode: 'tools',
          voiceMode: voiceModeRef.current,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const contentType = resp.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        // Tool results returned as JSON
        const data = await resp.json();
        assistantSoFar = data.content || 'Action completed.';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar }]);

        // Refresh pipeline if action was taken
        if (data.actions?.some((a: string) => ['move_deal_stage', 'add_deal_note'].includes(a))) {
          refetchPipeline();
        }
      } else {
        // Streaming response
        if (!resp.body) throw new Error('No response body');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantSoFar += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                  }
                  return [...prev, { role: 'assistant', content: assistantSoFar }];
                });
              }
            } catch { /* partial */ }
          }
        }
      }

      // Persist assistant message
      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);
      }

      // Refresh pipeline after any response (in case tools were called)
      refetchPipeline();

      // Voice mode: speak the response
      if (voiceModeRef.current && assistantSoFar) {
        speakText(assistantSoFar);
      }
    } catch (e: any) {
      console.error('Copilot error:', e);
      toast.error(e.message || 'Failed to get response');
      if (!assistantSoFar) {
        setMessages(prev => prev.slice(0, -1));
      }
      // Mic is already running continuously in voice mode — no restart needed
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setShowSlashCommands(false);
      sendMessage(input);
    }
    if (e.key === 'Escape') {
      setShowSlashCommands(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Show slash commands when input starts with /
    setShowSlashCommands(value.startsWith('/') && !value.includes(' '));
  };

  const handleSlashSelect = (template: string) => {
    setInput(template);
    setShowSlashCommands(false);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 p-0 relative"
            >
              <Sparkles className="h-6 w-6" />
              {proactiveAlert && alertsEnabled && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive animate-pulse" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col w-[420px] h-[620px] max-h-[80vh] rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden"
            onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDraggingOver(false); }}
            onDrop={handleFileDrop}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">DealFlow Copilot</h3>
                  <p className="text-[10px] text-muted-foreground">Strategy · Actions · Market Intel</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {/* Voice mode toggle */}
                <Button
                  variant={voiceMode ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 ${voiceMode ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'text-muted-foreground'}`}
                  onClick={toggleVoiceMode}
                  title={voiceMode ? 'End voice conversation' : 'Start voice conversation'}
                >
                  <AudioLines className={`h-3.5 w-3.5 ${voiceMode ? 'animate-pulse' : ''}`} />
                </Button>
                {user && (
                  <CopilotHistory
                    userId={user.id}
                    currentConversationId={conversationId}
                    onLoadConversation={handleLoadConversation}
                    onNewConversation={handleNewConversation}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  title={alertsEnabled ? 'Disable proactive alerts' : 'Enable proactive alerts'}
                >
                  {alertsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                </Button>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={handleClear}
                    title="Clear chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setOpen(false)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Voice mode indicator */}
            {voiceMode && (
              <div className="px-4 py-2 border-b border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <AudioLines className="h-4 w-4 text-primary" />
                      {isRecording && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-foreground">
                        {isSpeaking ? '🔊 Speaking...' : isRecording ? '🎙️ Listening...' : isLoading ? '🤔 Thinking...' : '🎙️ Ready'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleVoiceMode}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    End
                  </button>
                </div>
              </div>
            )}

            {/* Proactive alert banner */}
            {proactiveAlert && alertsEnabled && messages.length === 0 && (
              <div className="px-4 py-2 border-b border-warning/20 bg-warning/5">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-warning shrink-0" />
                  <p className="text-[11px] text-foreground">{proactiveAlert}</p>
                </div>
                <button
                  onClick={() => sendMessage(`I have ${proactiveAlert}. What should I prioritize?`)}
                  className="mt-1 text-[10px] text-primary hover:underline"
                >
                  Ask Copilot what to prioritize →
                </button>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth">
              {/* Pinned messages bar */}
              {messages.some(m => m.pinned) && (
                <div className="space-y-1.5 mb-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Pinned
                  </p>
                  {messages.filter(m => m.pinned).map((m, pi) => (
                    <div key={pi} className="text-[11px] text-foreground bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1.5 line-clamp-2">
                      {m.content.slice(0, 120)}…
                    </div>
                  ))}
                </div>
              )}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">How can I help?</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
                      I know your pipeline, can search live market data, execute actions, and draft outreach.
                    </p>
                  </div>
                  <div className="w-full space-y-1.5 mt-2">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
                        onClick={() => sendMessage(s)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border bg-secondary/30 text-xs text-foreground hover:bg-secondary/60 hover:scale-[1.01] active:scale-[0.99] transition-all"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300, duration: 0.25 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div className="relative">
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-secondary/50 text-foreground rounded-bl-md'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:text-sm [&>li]:text-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {/* Blinking cursor while streaming */}
                            {isLoading && i === messages.length - 1 && (
                              <span className="inline-block w-[2px] h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                      {/* Message actions for assistant */}
                      {msg.role === 'assistant' && !isLoading && (
                        <div className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                          <button
                            onClick={() => togglePin(i)}
                            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                            title={msg.pinned ? 'Unpin' : 'Pin'}
                          >
                            {msg.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                          {hasEmailDraft(msg.content) && (
                            <button
                              onClick={() => handleExportEmail(msg.content)}
                              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title="Export email draft"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(msg.content, i)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {copiedIndex === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedIndex === i ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-secondary/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map(dot => (
                        <motion.span
                          key={dot}
                          className="h-2 w-2 rounded-full bg-muted-foreground/50"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: dot * 0.15,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Follow-up suggestions after last assistant message */}
              {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                <CopilotFollowUps
                  lastMessage={messages[messages.length - 1].content}
                  onSelect={(text) => sendMessage(text)}
                  isLoading={isLoading}
                />
              )}
            </div>

            {/* Drag overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-2xl backdrop-blur-sm">
                <div className="text-center">
                  <FileText className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-primary">Drop file here</p>
                  <p className="text-[10px] text-muted-foreground">PDF, DOCX, TXT, CSV, JSON</p>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border px-3 py-3 relative">
              {/* Slash commands popup */}
              <CopilotSlashCommands
                input={input}
                visible={showSlashCommands}
                onSelect={handleSlashSelect}
              />
              {/* Attached file chip */}
              {attachedFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{attachedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {(attachedFile.size / 1024).toFixed(0)}KB
                  </span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* File context indicator */}
              {fileContext && !attachedFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-2.5 py-1">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">File context active — ask follow-up questions</span>
                  <button
                    onClick={() => setFileContext(null)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.csv,.json,.doc,.docx,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-10 w-10 rounded-xl p-0 shrink-0 ${isRecording ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'}`}
                  onClick={toggleVoice}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : isRecording ? 'Listening...' : 'Type / for commands...'}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[100px]"
                  style={{ minHeight: '40px' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 100) + 'px';
                  }}
                />
                <Button
                  size="sm"
                  className="h-10 w-10 rounded-xl p-0 shrink-0"
                  onClick={() => { setShowSlashCommands(false); sendMessage(input); }}
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-[9px] text-muted-foreground/60 text-center">
                Type <span className="font-mono text-muted-foreground/80">/</span> for commands · Drop files · Voice input · Pin responses
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
