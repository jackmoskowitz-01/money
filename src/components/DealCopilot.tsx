import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send, Loader2, Sparkles, Trash2, ChevronDown,
  Mic, MicOff, Copy, Check, Bell, BellOff,
  Paperclip, FileText, X, Pin, PinOff, ExternalLink, AudioLines, Download,
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
import { exportToWord } from '@/lib/exportToWord';
import { exportMatrixToWord } from '@/lib/exportMatrixToWord';
import CopilotHistory from '@/components/copilot/CopilotHistory';
import CopilotSlashCommands from '@/components/copilot/CopilotSlashCommands';
import { useScribe, CommitStrategy } from '@elevenlabs/react';

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-copilot`;
const FILE_PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-parse-file`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-tts`;
const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;
type Msg = { role: 'user' | 'assistant'; content: string; fileName?: string; pinned?: boolean };

const SUGGESTIONS = [
  "What's my best next move with McKinsey?",
  "Draft a check-in email for Deloitte",
  "Analyze comps for McKinsey's deal",
  "Score the deal with Deloitte",
  "Compare my top 3 deals",
  "Which deals need follow-up?",
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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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
  const ttsQueueRef = useRef<string[]>([]);
  const ttsPlayingRef = useRef(false);
  const scribeConnectedRef = useRef(false);
  const messagesRef = useRef<Msg[]>([]);
  const isLoadingRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const { pipeline, refetch: refetchPipeline } = usePipeline();

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

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

  // Proactive alerts check — includes smart follow-up reminders
  useEffect(() => {
    if (!alertsEnabled || pipeline.length === 0) return;

    const now = new Date();
    const alerts: string[] = [];

    // Check leases expiring this month
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

    // Check overdue follow-ups
    const overdueFollowUps = pipeline.flatMap(item =>
      (item.sentTouchpoints || [])
        .filter(tp => tp.followUpDate && tp.followUpDate < now.toISOString())
    );

    // Smart follow-up reminders: deals with no activity in 7+ days
    const staleDeals = pipeline.filter(item => {
      if (['won', 'closed', 'lost'].includes(item.stage)) return false;
      const lastActivity = new Date(item.lastActivity);
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / 86400000);
      return daysSince >= 7;
    });

    if (expiringThisMonth.length > 0) alerts.push(`${expiringThisMonth.length} lease(s) expire this month`);
    if (overdueFollowUps.length > 0) alerts.push(`${overdueFollowUps.length} overdue follow-up(s)`);
    if (staleDeals.length > 0) alerts.push(`${staleDeals.length} deal(s) need attention`);

    if (alerts.length > 0) {
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
  // Keep voiceModeRef in sync
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Silence timer — after user stops speaking, auto-send after a pause
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef('');

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
        try { scribe.disconnect(); } catch {}
        scribeConnectedRef.current = false;
      }
      toast('Voice mode off');
    } else {
      // Turn on
      setVoiceMode(true);
      voiceModeRef.current = true;
      try {
        const tokenResp = await fetch(SCRIBE_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

  // Check if message is a matrix report
  const isMatrixReport = (content: string) => {
    return /summary\s*of\s*proposals/i.test(content) && content.includes('|') && content.includes('---');
  };

  // Check if message is a substantial report (abstract, comp, commission, etc.)
  const isExportableReport = (content: string) => {
    const len = content.length;
    if (len < 300) return false;
    const hasStructure = (content.match(/^#{1,3}\s/gm) || []).length >= 3;
    const hasTable = content.includes('|') && content.includes('---');
    return hasStructure || hasTable;
  };

  // Export message as Word document
  const handleExportWord = async (content: string) => {
    // Derive filename from first heading or generic
    const h1Match = content.match(/^#\s+(.+)/m);
    const filename = h1Match?.[1]?.slice(0, 50) || 'Copilot_Report';
    try {
      if (isMatrixReport(content)) {
        await exportMatrixToWord(content, filename);
      } else {
        await exportToWord(content, filename);
      }
      toast.success('Word document downloaded');
    } catch (e) {
      console.error('Word export error:', e);
      toast.error('Failed to export document');
    }
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
  const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(f => validateAndAttachFile(f));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => validateAndAttachFile(f));
    e.target.value = '';
  };

  const validateAndAttachFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} too large (max 20MB)`);
      return;
    }
    setAttachedFiles(prev => {
      if (prev.length >= 10) {
        toast.error('Max 10 files allowed');
        return prev;
      }
      if (prev.some(f => f.name === file.name && f.size === file.size)) return prev;
      // File attached silently — no toast
      return [...prev, file];
    });
  };

  // Save a template from file analysis result
  const saveTemplate = async (name: string, structure: string, filename: string, templateType: string = 'general') => {
    if (!user) return;
    const { error } = await supabase.from('copilot_templates').insert({
      user_id: user.id,
      name,
      template_type: templateType,
      parsed_structure: structure,
      original_filename: filename,
    } as any);
    if (error) {
      toast.error('Failed to save template');
      console.error('Template save error:', error);
    } else {
      toast.success(`📋 Template "${name}" saved! It will be used automatically for future requests.`);
    }
  };

  // Load user templates for context
  const loadTemplates = async (): Promise<string> => {
    if (!user) return '';
    const { data } = await supabase
      .from('copilot_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!data || data.length === 0) return '';
    return '\n\n### User Output Templates\nThe user has saved these templates. When generating output that matches a template type, ALWAYS follow the template\'s structure and formatting exactly.\n' +
      (data as any[]).map((t: any) => `\n**Template: "${t.name}"** (type: ${t.template_type}, from: ${t.original_filename})\n\`\`\`\n${t.parsed_structure}\n\`\`\``).join('\n');
  };

  // Cresa-style lease abstract template structure
  const LEASE_ABSTRACT_TEMPLATE = `You are producing a professional Lease Summary / Abstract. Follow this EXACT structure and section order. Fill in every field from the lease document. If a field is not found in the lease, write "Silent in Lease."

## FORMAT:
---
# Lease Summary

**Company Name:** [Tenant Company]
**Building Name:** [Building/Property Name]
**Address:** [Full Address]
**Lease Type:** [Renewal / Expansion / New Lease]
**Abstract Date:** [Today's Date]

---

### Premises
- [X] rentable square feet
- Method of Measurement: [if stated]

### Amendments
List each amendment with page references and bullet-point summaries. If none, state "No amendments."

### Landlord
[Landlord entity name] | [City, ST]

### Term
- Duration: [X years]
- Commencement Date: [date]
- Expiration Date: [date]
- Article/Section/Page reference if available

### Size
[Rentable SF and Usable SF if stated]

### Rent Schedule

| Period | Rent/SF | Rent/Month | Rent/Year |
|--------|---------|------------|-----------|
| Year 1 | $XX.XX  | $XX,XXX.XX | $XXX,XXX.XX |
| Year 2 | ... | ... | ... |
[Continue for all years]

### Rent Payment Address
[Address or "Silent in Lease"]

### Lease Type
[Full Service / Net / Modified Gross / etc.]

### Electricity
[Included or separately metered, details]

### Abandonment
[Terms or "Silent in Lease"]

### Additional Provisions
[Key provisions or "Silent in Lease"]

### Alterations & Additions
[Terms or "Silent in Lease"]

### Landlord Services
[Services provided or "Silent in Lease"]

### Operating Expenses & Taxes
[Base year, cap, pass-through details or "Silent in Lease"]

### Exhibits
[List all exhibits referenced]

### Improvements / Tenant Improvements
[TI allowance, details or "Silent in Lease"]

### Parking
[Ratio, cost, reserved/unreserved or "Silent in Lease"]

### Right of Refusal
[Terms or "Silent in Lease"]

### Extension Option
[Terms, notice period, rent basis or "Silent in Lease"]

### Expansion Option
[Terms or "Silent in Lease"]

### Cancellation Option
[Terms, penalty or "Silent in Lease"]

### Holdover
[Rate, terms or "Silent in Lease"]

### Insurance – Landlord
[Requirements or "Silent in Lease"]

### Insurance – Tenant
[Requirements or "Silent in Lease"]

### Late Charge
[Percentage, grace period or "Silent in Lease"]

### Maintenance – Landlord
[Responsibilities or "Silent in Lease"]

### Maintenance – Tenant
[Responsibilities or "Silent in Lease"]

### Non-Disturbance
[Terms or "Silent in Lease"]

### Permitted Uses
[Permitted uses or "Silent in Lease"]

### Relocation
[Terms or "Silent in Lease"]

### Restoration
[Terms or "Silent in Lease"]

### Right to Audit
[Terms or "Silent in Lease"]

### Right to Offset
[Terms or "Silent in Lease"]

### Self-Help
[Terms or "Silent in Lease"]

### Assignment & Subletting
[Terms, consent requirements or "Silent in Lease"]

### Signage
[Terms or "Silent in Lease"]

### Security Deposit
[Amount, terms or "Silent in Lease"]

### Building Hours and Holidays
[Hours, holiday schedule or "Silent in Lease"]

### Notice to Landlord
[Notice address or "Silent in Lease"]

### Additional Lease Comments
[Any other notable terms]

---
*This document has been prepared based on available information and professional interpretation. Reasonable care has been taken to ensure its accuracy. We encourage every client to review the information prior to relying on it for action or decision-making.*
---

CRITICAL INSTRUCTIONS — MAXIMUM DETAIL:
1. Fill in EVERY section above. Do NOT skip or summarize — provide the FULL detail from the lease for each field.
2. For rent schedules: list EVERY year of the term with Rent/SF, Rent/Month, and Rent/Year. Calculate monthly and annual amounts if only per-SF rates are given. Show escalation percentages.
3. For each section, include the Article #, Section #, and Page # references from the lease when available.
4. Quote exact dollar amounts, dates, percentages, and square footage numbers — never round or approximate.
5. For options (extension, expansion, cancellation, ROFO/ROFR): include ALL details — notice periods, pricing mechanisms, number of options, option term lengths, and any conditions.
6. For insurance: list exact coverage types and minimum amounts required.
7. For operating expenses: include base year, cap rates, exclusions, gross-up provisions, and audit rights.
8. For TI/improvements: include exact allowance per SF, total amount, construction timeline, and any landlord contribution details.
9. For assignment/subletting: include consent requirements, recapture rights, profit sharing, and any pre-approved transfers.
10. List ALL exhibits and addenda referenced in the lease with brief descriptions.
11. Include any guarantor information, renewal rights, co-tenancy clauses, exclusive use provisions, or other non-standard terms under "Additional Lease Comments."
12. If a clause is complex, use sub-bullets to break it down — never collapse detail into a single line.
13. DO NOT write "See lease for details" — extract and state the actual details.`;

  // Deal Terms Matrix template (Summary of Proposals)
  const MATRIX_TEMPLATE = `You are producing a professional "Summary of Proposals" deal terms matrix. Follow this EXACT structure and formatting. Extract every detail from the attached lease/proposal documents.

## RULES:
- Create ONE column per offer/proposal attached. If a single building has multiple offer rounds (Landlord Offer #1A, #1B, etc.), each gets its own column.
- If only ONE document is attached, produce a single-column matrix (just the row labels on the left and one data column).
- If multiple documents are attached, produce as many columns as there are distinct offers — group columns by building address.
- Use EXACT dollar amounts, dates, percentages, and SF numbers from the documents. Never round or approximate.
- If a field is not stated in a document, write "Silent" or leave blank.
- The output MUST be a clean markdown table that exports perfectly to Word.

## FORMAT:

# Summary of Proposals

| | [Street Address, City, State] | [Street Address, City, State] | ... |
|---|---|---|---|
| **Lease Terms** | **[Offer Label #1]** | **[Offer Label #1]** | ... |
| **Premises:** | [XX,XXX RSF] | [XX,XXX RSF] | ... |
| **Term:** | [X years] | [X years] | ... |
| **Lease Commencement Date:** | [Month Day, Year] | [Month Day, Year] | ... |
| **Rental Abatement:** | [X months / None] | [X months / None] | ... |
| **Base Rental Rate:** | [$XX.XX/NNN or FS] | [$XX.XX/NNN or FS] | ... |
| **Average Annual Cost Over Term:** | [$XXX,XXX] | [$XXX,XXX] | ... |
| **Escalation:** | [X.XX%] | [X.XX%] | ... |
| **Operating Expenses & Real Estate Taxes:** | [$XX.XX PSF or included] | [$XX.XX PSF or included] | ... |
| **Tenant Improvement Allowance:** | [$XX.XX/PSF] | [$XX.XX/PSF] | ... |
| **Termination Option:** | [Terms / None] | [Terms / None] | ... |

CRITICAL INSTRUCTIONS:
1. Use the EXACT row labels shown above in bold. Do not rename or reorder them.
2. Use the PHYSICAL STREET ADDRESS (e.g. "4510 Buckeystown Pike, Frederick, MD") as column headers — NOT the building name or property name. Always include street number, street name, city, and state.
3. If a building has multiple offers (e.g., 5-year and 10-year), create separate columns under the same address header.
4. Calculate Average Annual Cost Over Term = (Base Rent × SF × Term Years, adjusted for escalations and abatement) ÷ Term Years. Show as a dollar amount.
5. Include ALL offers from ALL attached documents — never omit or merge columns.
6. Keep the table compact and clean — this is a one-page summary, not a detailed analysis.
7. After the table, optionally add a brief "Notes" section for any important caveats or conditions mentioned in the proposals.`;

  // Cresa-style Comparison of Options template
  const COMP_COMPARISON_TEMPLATE = `You are producing a professional "Comparison of Options" analysis. Follow this EXACT structure. Extract every detail from the attached lease offer documents.

## RULES:
- Create ONE column per offer/proposal. Group columns by building address.
- If a building has multiple rounds of offers (LL Offer #1, LL Offer #2, Counter #1, etc.), each round gets its own column — label them clearly.
- If comparing first-round offers from multiple buildings, show one column per building.
- ONLY include the number of columns needed — do NOT pad with empty columns.
- Use exact dollar amounts, dates, percentages, and SF numbers from the documents. Never round.

## FORMAT:

# [Client/Tenant Name]: Comparison of Options

## Assumptions

| | [Building 1 Address] | [Building 1 Address] | [Building 2 Address] | ... |
|---|---|---|---|---|
| | [Offer Label #1] | [Offer Label #2] | [Offer Label #1] | ... |
| Premises Size | [X,XXX SF] | ... | ... | ... |
| Lease Commencement | [date] | ... | ... | ... |
| Lease Expiration | [date] | ... | ... | ... |
| Lease Term | [X Yrs X Mo] | ... | ... | ... |
| Base Rent | [$XX.XX PSF, FS/NNN] | ... | ... | ... |
| Opex & Tax | [$XX.XX PSF or N/A] | ... | ... | ... |
| All-In Rent | [$XX.XX PSF] | ... | ... | ... |
| Rent Escalation | [X.XX%] | ... | ... | ... |
| Free Rent | [X Mos (details)] | ... | ... | ... |
| OpEx & Tax Base Amount | [$XX.XX PSF] | ... | ... | ... |
| Lease Type | [Full Service / Net / etc.] | ... | ... | ... |
| OpEx & Tax Increase % | [X.XX%] | ... | ... | ... |
| Improvement Allowance | [$XX.XX PSF] | ... | ... | ... |
| Buildout Cost | [$XX.XX PSF] | ... | ... | ... |
| Net Out of Pocket Cost Day 1 | [$XX.XX PSF] | ... | ... | ... |

## Comparable Term Totals ([shortest term] comparison)

| | [Building 1] | [Building 1] | [Building 2] | ... |
|---|---|---|---|---|
| | [Offer Label] | [Offer Label] | [Offer Label] | ... |
| Comparable Begin Period | [date] | ... | ... | ... |
| Comparable End Period | [date] | ... | ... | ... |
| Analysis Term | [X Yrs X Mo] | ... | ... | ... |
| Cumulative Rent | [$XXX,XXX] | ... | ... | ... |
| Average Annual Rent | [$XXX,XXX] | ... | ... | ... |
| Net Present Value | [$XXX,XXX] | ... | ... | ... |

## Full Term Totals

| | [Building 1] | [Building 1] | [Building 2] | ... |
|---|---|---|---|---|
| | [Offer Label] | [Offer Label] | [Offer Label] | ... |
| Full Term Commencement | [date] | ... | ... | ... |
| Full Term End Period | [date] | ... | ... | ... |
| Analysis Term | [X Yrs X Mo] | ... | ... | ... |
| Cumulative Rent | [$XXX,XXX] | ... | ... | ... |
| Average Annual Rent | [$XXX,XXX] | ... | ... | ... |
| Net Present Value | [$XXX,XXX] | ... | ... | ... |
| NPV Rate (for all options) | [X%] | | | |

## Detailed Cash Flow

For EACH offer, provide a separate cash flow table:

### [Building Address] — [Offer Label]

Premises Size: [X,XXX SF] | Base Rent: [$XX.XX PSF] | Term: [X Yrs X Mo] | Free Rent: [X Mos] | TI: [$XX.XX PSF]

| | Year 1 | Year 2 | Year 3 | ... |
|---|---|---|---|---|
| Beg | [date] | [date] | ... | ... |
| End | [date] | [date] | ... | ... |
| Base Rent & Esc. | [$XXX,XXX] | ... | ... | ... |
| Free Rent | [($XX,XXX)] | ... | ... | ... |
| OpEx & Taxes | [$X,XXX] | ... | ... | ... |
| Tenant Improvements | [$X,XXX or -] | ... | ... | ... |
| Buildout Costs | [$X,XXX or -] | ... | ... | ... |
| TI Allowance / Rent Credit | [($XX,XXX) or -] | ... | ... | ... |
| Annual Cost | [$XXX,XXX] | ... | ... | ... |
| Cumulative Cost | [$XXX,XXX] | ... | ... | ... |
| Annual Cost PSF | [$XX.XX] | ... | ... | ... |

NPV Over Full Term: $XXX,XXX

[Repeat for each offer]

## Footnotes

- [1] [Explanation of any credits, adjustments, or assumptions]
- [2] [Additional notes]

---

CRITICAL INSTRUCTIONS:
1. Extract and calculate ALL numbers — never leave blanks or write "see document."
2. If multiple rounds of offers exist for one building, show each round as a separate column.
3. If only first-round offers from different buildings, show one column per building — keep it clean.
4. Calculate cumulative rent, average annual rent, and NPV (use 8% discount rate unless specified otherwise).
5. Show rent escalations applied year-over-year in the cash flow tables.
6. Include ALL footnotes explaining credits, buildout assumptions, or special conditions.
7. For comparable term analysis, use the SHORTEST lease term among all options as the comparison period.
8. Label each column header clearly: building address on top, offer round/label below.`;


  const sendFileMessage = async (question: string) => {
    if (attachedFiles.length === 0 || isLoading) return;

    const fileNames = attachedFiles.map(f => f.name);
    const fileLabel = fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`;
    const userContent = question.trim() || `Analyze ${fileLabel}`;
    const isTemplateSave = userContent.toLowerCase().includes('save') && userContent.toLowerCase().includes('template');
    const isAbstract = /abstract/i.test(userContent) || /\/abstract/i.test(userContent);
    const isMatrix = /\/matrix/i.test(userContent) || (/matrix/i.test(userContent) && /deal\s*terms/i.test(userContent)) || /summary\s*of\s*proposals/i.test(userContent);
    const isComp = !isMatrix && (/\/comp/i.test(userContent) || (/comp/i.test(userContent) && /compar/i.test(userContent)) || /compare.*offers?/i.test(userContent) || /comparison/i.test(userContent));
    const fileChips = fileNames.map(n => `📎 **${n}**`).join('\n');
    const userMsg: Msg = { role: 'user', content: `${fileChips}\n${userContent}`, fileName: fileNames[0] };
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
      attachedFiles.forEach(f => formData.append('file', f));
      if (isTemplateSave) {
        formData.append('question', `Extract the EXACT structure, layout, formatting, and field labels from this template document. Preserve all headers, sections, field names, column names, and formatting patterns. Output a clear structural blueprint that can be replicated. Include:\n1. Document title/header format\n2. All section headers in order\n3. Field labels and their expected value types\n4. Table structures with column names\n5. Any footer/signature blocks\n\nDo NOT fill in values — just show the template skeleton.`);
      } else if (isAbstract) {
        formData.append('question', `Run a complete lease abstract on this document.\n\n${LEASE_ABSTRACT_TEMPLATE}`);
      } else if (isMatrix) {
        formData.append('question', `Create a Summary of Proposals deal terms matrix from these documents. Number of files attached: ${attachedFiles.length}.\n\n${MATRIX_TEMPLATE}`);
      } else if (isComp) {
        formData.append('question', `Run a complete Comparison of Options analysis on these documents.\n\n${COMP_COMPARISON_TEMPLATE}`);
      } else {
        formData.append('question', userContent);
      }
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

      // Auto-save template if this was a template save request
      if (isTemplateSave && assistantSoFar) {
        const nameMatch = userContent.match(/template\s+(?:called|named)\s+["']?([^"'\n]+)["']?/i);
        const templateName = nameMatch?.[1]?.trim() || fileNames[0].replace(/\.[^.]+$/, '');
        let templateType = 'general';
        if (/commission/i.test(userContent) || /commission/i.test(fileNames[0])) templateType = 'commission';
        else if (/abstract|loi|lease/i.test(userContent) || /abstract|loi|lease/i.test(fileNames[0])) templateType = 'deal_abstract';
        else if (/comp|comparison/i.test(userContent) || /comp/i.test(fileNames[0])) templateType = 'comp_report';
        else if (/proposal/i.test(userContent) || /proposal/i.test(fileNames[0])) templateType = 'proposal';
        
        await saveTemplate(templateName, assistantSoFar, fileNames[0], templateType);
      }
    } catch (e: any) {
      console.error('File analysis error:', e);
      toast.error(e.message || 'Failed to analyze file');
      if (!assistantSoFar) setMessages(prev => prev.slice(0, -1));
    }

    // Keep file context for multi-turn follow-ups
    if (assistantSoFar) {
      setFileContext(`Previously analyzed files: ${fileNames.join(', ')}. Summary:\n${assistantSoFar.slice(0, 2000)}`);
    }
    setAttachedFiles([]);
    setIsLoading(false);
  };

  const sendMessage = async (text: string) => {
    // If files are attached, route to file handler
    if (attachedFiles.length > 0) {
      return sendFileMessage(text);
    }
    if (!text.trim()) return;
    // In voice mode, queue if already loading; in text mode, block
    if (isLoadingRef.current) {
      if (!voiceModeRef.current) return;
      // Voice mode: skip duplicate sends while loading
      return;
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    // Use ref for latest messages to avoid stale closure
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Generate or reuse conversation ID
    const convId = conversationIdRef.current || crypto.randomUUID();
    if (!conversationIdRef.current) setConversationId(convId);

    // Persist user message
    await persistMessage(userMsg, convId);

    let assistantSoFar = '';

    try {
      // Load templates for context
      const templateCtx = voiceModeRef.current ? '' : await loadTemplates();
      const fullContext = voiceModeRef.current ? '' : (buildContext() + (fileContext ? `\n\n### Previous File Analysis\n${fileContext}` : '') + templateCtx);

      const resp = await fetch(COPILOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          context: fullContext,
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
        // Track sentence buffer for chunked TTS during streaming
        let ttsBuffer = '';

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

                // Chunked TTS: queue sentences as they complete during streaming
                if (voiceModeRef.current) {
                  ttsBuffer += content;
                  // Split on sentence boundaries
                  const sentenceMatch = ttsBuffer.match(/^(.*?[.!?])\s+(.*)$/s);
                  if (sentenceMatch) {
                    const completeSentence = sentenceMatch[1].trim();
                    ttsBuffer = sentenceMatch[2];
                    if (completeSentence.length > 10) {
                      enqueueTTSChunk(completeSentence);
                    }
                  }
                }
              }
            } catch { /* partial */ }
          }
        }

        // Flush remaining TTS buffer
        if (voiceModeRef.current && ttsBuffer.trim().length > 5) {
          enqueueTTSChunk(ttsBuffer.trim());
        }
      }

      // Persist assistant message
      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);
      }

      // Refresh pipeline after any response (in case tools were called)
      refetchPipeline();
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
                          {isExportableReport(msg.content) && (
                            <button
                              onClick={() => handleExportWord(msg.content)}
                              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title="Export as Word document"
                            >
                              <Download className="h-3 w-3" />
                              <span>Word</span>
                            </button>
                          )}
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
                  <p className="text-[10px] text-muted-foreground">PDF, DOCX, XLSX, TXT, CSV, JSON</p>
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
              {/* Attached file chips */}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1">
                      <FileText className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-[11px] text-foreground truncate max-w-[120px]">{file.name}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(0)}KB
                      </span>
                      <button
                        onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* File context indicator */}
              {fileContext && attachedFiles.length === 0 && (
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
                  accept=".pdf,.txt,.csv,.json,.doc,.docx,.md,.xlsx,.xls"
                  multiple
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
                  placeholder={attachedFiles.length > 0 ? `Ask about ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''}...` : isRecording ? 'Listening...' : 'Type / for commands...'}
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
                  disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
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
