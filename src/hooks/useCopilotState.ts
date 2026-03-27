import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatIntelligenceContext, type IntelligenceData } from '@/hooks/useIntelligence';
import { buildings } from '@/data/mockData';
import { usePipeline } from '@/hooks/usePipeline';
import { stageLabels } from '@/data/pipelineData';
import { leaseComps } from '@/data/pipelineData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LEASE_ABSTRACT_TEMPLATE, MATRIX_TEMPLATE, COMP_COMPARISON_TEMPLATE, CASHFLOW_TEMPLATE } from '@/lib/copilotTemplates';
import { parseSSEStream } from '@/lib/parseSSEStream';
import { getAuthToken } from '@/lib/getAuthToken';
import { useOrganizationId } from '@/hooks/useOrganization';
import { embedAfterSave } from '@/hooks/useAskDealflow';

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-copilot`;
const FILE_PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-parse-file`;

export type Msg = { role: 'user' | 'assistant'; content: string; fileName?: string; pinned?: boolean };

export const DEFAULT_SUGGESTIONS = [
  "What's my best next move with McKinsey?",
  "Draft a check-in email for Deloitte",
  "Analyze comps for McKinsey's deal",
  "Score the deal with Deloitte",
  "Compare my top 3 deals",
  "Which deals need follow-up?",
];

// Backward compatibility alias
export const SUGGESTIONS = DEFAULT_SUGGESTIONS;

export function getSuggestionsForPage(pathname: string): string[] {
  return CONTEXTUAL_SUGGESTIONS[pathname] || DEFAULT_SUGGESTIONS;
}

// Page context mapping
const PAGE_CONTEXT: Record<string, string> = {
  '/': 'User is on the Dashboard — showing overview of pipeline, tasks, and activity.',
  '/pipeline': 'User is on the Pipeline page — viewing the Kanban board of all deals.',
  '/prospects': 'User is on the Prospects page — browsing prospect lists and search.',
  '/prospect-table': 'User is on the Prospects CRM table — full book of business view with sorting/filtering.',
  '/map': 'User is on the Map View — exploring DC buildings on an interactive map.',
  '/news': 'User is on the News/Intel page — viewing market news and company intelligence.',
  '/tasks': 'User is on the Tasks page — managing follow-ups and to-dos.',
  '/scoop': 'User is on the Scoop Board — collaborative broker intelligence sharing.',
  '/activities': 'User is on the Activity Logger — tracking calls, tours, emails, meetings.',
  '/email-analytics': 'User is on Email Analytics — tracking email campaign performance.',
  '/loopnet': 'User is on LoopNet Search — searching for properties and tenants.',
  '/comp-tracker': 'User is on the Comp Tracker — monitoring competitive lease transactions.',
  '/lease-abstracts': 'User is on Lease Abstracts — managing lease document analysis.',
  '/alerts': 'User is on Alerts — viewing critical dates and notifications.',
  '/analytics': 'User is on Analytics — reviewing pipeline metrics, trends, and forecasts.',
  '/settings': 'User is on Settings — managing profile and preferences.',
};

// Proactive contextual suggestions per page
// (per Anthropic cookbook agent patterns — proactive not passive)
const CONTEXTUAL_SUGGESTIONS: Record<string, string[]> = {
  '/': [
    "Give me a morning briefing — what needs my attention today?",
    "Which deals are stale and need follow-up?",
    "Score all my active deals",
  ],
  '/pipeline': [
    "Which deal should I focus on next?",
    "Compare my top 3 deals",
    "Any deals stuck in the same stage too long?",
  ],
  '/prospect-table': [
    "Which prospects haven't been touched in 2+ weeks?",
    "Draft a re-engagement sequence for stale prospects",
    "Score and rank my prospects by priority",
  ],
  '/news': [
    "Any news signals matching my current prospects?",
    "Find expansion signals for companies over 20K SF",
    "Draft outreach based on the latest market news",
  ],
  '/scoop': [
    "Summarize the latest scoops from this week",
    "Any scoops that match my pipeline deals?",
    "What intel should I act on first?",
  ],
  '/tasks': [
    "What's overdue and what should I prioritize?",
    "Draft follow-up emails for my overdue tasks",
    "Create tasks for all stale deals",
  ],
  '/loopnet': [
    "Search for Class A office buildings in East End",
    "Find properties matching my 20K+ SF prospects",
    "Compare this building's comps to market average",
  ],
  '/activities': [
    "Summarize my outreach activity this week",
    "Which prospects have I not contacted recently?",
    "Log today's calls and meetings",
  ],
};

// Cresa-style lease abstract template structure

// Re-export templates for backward compatibility
export { LEASE_ABSTRACT_TEMPLATE, MATRIX_TEMPLATE, COMP_COMPARISON_TEMPLATE, CASHFLOW_TEMPLATE } from '@/lib/copilotTemplates';

export function useCopilotState() {
  const { user } = useAuth();
  const orgId = useOrganizationId();
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
  const [pitchDeckContent, setPitchDeckContent] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [marketReportSearch, setMarketReportSearch] = useState<{ open: boolean; query: string; results: { content: string; preview: string; date: string; conversationId: string }[]; loading: boolean }>({ open: false, query: '', results: [], loading: false });
  const [conversationMemory, setConversationMemory] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [brainEnabled, setBrainEnabled] = useState(false);
  const [brainContext, setBrainContext] = useState<string | null>(null);
  const [copilotName, setCopilotName] = useState('DealFlow Copilot');
  const [aiSettings, setAiSettings] = useState({
    aiAutoBrainExtraction: false,
    aiEmailPerformanceLoop: false,
    aiDealPatternLearning: false,
    aiActivityInsights: false,
    aiStyleTraining: false,
    aiScoopSynthesis: false,
    aiContactMemory: false,
  });
  const [intelligenceContext, setIntelligenceContext] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutoExportRef = useRef(false);
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const enqueueTTSChunkRef = useRef<((text: string) => void) | null>(null);
  const { pipeline, refetch: refetchPipeline } = usePipeline();

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // Register TTS chunk function from voice component
  const setEnqueueTTSChunk = useCallback((fn: (text: string) => void) => {
    enqueueTTSChunkRef.current = fn;
  }, []);

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

  // Load conversation history - only load today's conversation, otherwise start fresh
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
        const lastMessageDate = new Date(data[0].created_at);
        const today = new Date();
        const isToday = lastMessageDate.toDateString() === today.toDateString();

        if (isToday) {
          const convId = data[0].conversation_id;
          const { data: msgs } = await supabase
            .from('copilot_messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

          if (msgs && msgs.length > 0) {
            setConversationId(convId);
            setMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
          }
        }
      }
      setHasLoadedHistory(true);
    };
    loadHistory();
  }, [user, hasLoadedHistory]);

  // Determine current prospect/entity name from URL for scoped memory
  const currentEntityName = useMemo(() => {
    const tenantMatch = location.pathname.match(/\/building\/(.+)\/tenant\/(.+)/);
    if (tenantMatch) {
      const [, bId, tId] = tenantMatch;
      const building = buildings.find(b => b.id === bId);
      const tenant = building?.tenants.find(t => t.id === tId);
      if (tenant) return tenant.name;
    }
    const prospectMatch = location.pathname.match(/\/prospect\/(.+)/);
    if (prospectMatch) {
      const pId = decodeURIComponent(prospectMatch[1]);
      const deal = pipeline.find(p => p.tenantId === pId);
      if (deal?.prospectName) return deal.prospectName;
    }
    return null;
  }, [location.pathname, pipeline]);

  // Reload settings every time copilot is opened or entity changes
  useEffect(() => {
    if (!user || !open) return;
    const loadMemoryAndSettings = async () => {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('copilot_memory, copilot_name, brain_enabled, ai_auto_brain_extraction, ai_email_performance_loop, ai_deal_pattern_learning, ai_activity_insights, ai_style_training, ai_scoop_synthesis, ai_contact_memory')
        .eq('user_id', user.id)
        .single();

      const s = settings;
      const enabled = s?.copilot_memory ?? true;
      const brainOn = s?.brain_enabled ?? false;
      setMemoryEnabled(enabled);
      setBrainEnabled(brainOn);
      setCopilotName(s?.copilot_name?.trim() || 'DealFlow Copilot');

      const newAiSettings = {
        aiAutoBrainExtraction: s?.ai_auto_brain_extraction ?? false,
        aiEmailPerformanceLoop: s?.ai_email_performance_loop ?? false,
        aiDealPatternLearning: s?.ai_deal_pattern_learning ?? false,
        aiActivityInsights: s?.ai_activity_insights ?? false,
        aiStyleTraining: s?.ai_style_training ?? false,
        aiScoopSynthesis: s?.ai_scoop_synthesis ?? false,
        aiContactMemory: s?.ai_contact_memory ?? false,
      };
      setAiSettings(newAiSettings);

      // Fetch intelligence data if any flywheel is enabled
      const anyFlywheelEnabled = Object.values(newAiSettings).some(v => v);
      if (anyFlywheelEnabled) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const intelResp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intelligence-gather`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({}),
              }
            );
            if (intelResp.ok) {
              const intelData = await intelResp.json() as IntelligenceData;
              const parts: string[] = ['## Intelligence Insights (auto-computed from your data)\n'];
              const perfOn = newAiSettings.aiEmailPerformanceLoop;

              if (perfOn && intelData.emailStats.totalSent > 0) {
                const es = intelData.emailStats;
                parts.push(`### Email Performance (${es.totalSent} emails)`);
                parts.push(`- Reply rate: ${es.replyRate}% | Avg response: ${es.avgResponseHours}h`);
                if (es.bestTemplates.length > 0) parts.push(`- Best templates: ${es.bestTemplates.slice(0, 3).map(t => `"${t.template}" (${t.replyRate}%)`).join(', ')}`);
                if (es.bestTones.length > 0) parts.push(`- Best tones: ${es.bestTones.slice(0, 3).map(t => `${t.tone} (${t.replyRate}%)`).join(', ')}`);
                if (es.bestReasons.length > 0) parts.push(`- Best reasons: ${es.bestReasons.slice(0, 3).map(r => `"${r.reason}" (${r.replyRate}%)`).join(', ')}`);
                if (es.industryPerformance.length > 0) parts.push(`- Industry response: ${es.industryPerformance.slice(0, 3).map(i => `${i.industry} ${i.replyRate}%`).join(', ')}`);
                parts.push(`- IMPORTANT: Reference these stats when drafting emails. Use the best-performing templates and tones.`);
              }

              if (perfOn && intelData.styleFingerprint.avgWordCount > 0) {
                parts.push(`\n### Your Communication Style`);
                parts.push(`- Avg email: ${intelData.styleFingerprint.avgWordCount} words | Dominant tone: ${intelData.styleFingerprint.dominantTone}`);
                parts.push(`- IMPORTANT: Match this style when drafting emails unless told otherwise.`);
              }

              if (perfOn && intelData.dealPatterns.totalDeals > 0) {
                const dp = intelData.dealPatterns;
                parts.push(`\n### Deal Patterns (${dp.totalDeals} deals)`);
                parts.push(`- Win rate: ${dp.winRate}%`);
                if (dp.avgTouchpointsToWin > 0) parts.push(`- Avg touchpoints to win: ${dp.avgTouchpointsToWin}`);
                if (dp.avgDaysToWin > 0) parts.push(`- Avg days to win: ${dp.avgDaysToWin}`);
                if (dp.outcomeReasons.length > 0) parts.push(`- Win/loss reasons: ${dp.outcomeReasons.slice(0, 5).map(r => `"${r.reason}" (${r.count}x)`).join(', ')}`);
              }

              if (perfOn && intelData.activityPatterns.totalActivities > 0) {
                const ap = intelData.activityPatterns;
                parts.push(`\n### Activity Patterns (${ap.totalActivities} activities)`);
                const topDay = Object.entries(ap.byDayOfWeek).sort(([,a],[,b]) => b - a);
                if (topDay.length > 0) parts.push(`- Most active: ${topDay.slice(0, 3).map(([d,c]) => `${d} (${c})`).join(', ')}`);
                const topHour = Object.entries(ap.byHour).sort(([,a],[,b]) => b - a);
                if (topHour.length > 0) parts.push(`- Peak hours: ${topHour.slice(0, 3).map(([h,c]) => `${h} (${c})`).join(', ')}`);
              }

              const marketOn = newAiSettings.aiScoopSynthesis;

              if (marketOn && intelData.scoopTrends.totalScoops > 0) {
                const st = intelData.scoopTrends;
                parts.push(`\n### Market Intel Trends (${st.totalScoops} scoops)`);
                if (st.topTags.length > 0) parts.push(`- Trending: ${st.topTags.slice(0, 5).map(t => `#${t.tag} (${t.count})`).join(', ')}`);
                if (st.recentHighlights.length > 0) parts.push(`- Recent: ${st.recentHighlights.slice(0, 3).join(' | ')}`);
              }

              if (marketOn && intelData.contactDensity.totalContacts > 0) {
                parts.push(`\n### Contact Intelligence (${intelData.contactDensity.totalContacts} contacts tracked)`);
              }

              if (parts.length > 1) {
                setIntelligenceContext(parts.join('\n'));
              }
            }
          }
        } catch (err) {
          console.error('Intelligence fetch error:', err);
        }
      } else {
        setIntelligenceContext(null);
      }

      // Load brain context if enabled
      if (brainOn) {
        const { data: brainFacts } = await supabase
          .from('copilot_brain')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (brainFacts && brainFacts.length > 0) {
          const facts = brainFacts;
          const categories = new Map<string, string[]>();
          facts.forEach(f => {
            const list = categories.get(f.category) || [];
            list.push(`- ${f.fact}${f.prospect_name ? ` (re: ${f.prospect_name})` : ''}`);
            categories.set(f.category, list);
          });

          const brainParts: string[] = [];
          for (const [cat, items] of categories) {
            const label = cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            brainParts.push(`**${label}:**\n${items.slice(0, 10).join('\n')}`);
          }

          setBrainContext(`### Smart Memory - Persistent Knowledge\nYou have a persistent smart memory that stores learned facts about this user and their deals. Reference this knowledge naturally. When you learn NEW facts from the conversation (preferences, deal outcomes, strategies that worked, prospect details), remember them for future use.\n\n${brainParts.join('\n\n')}`);
        } else {
          setBrainContext(`### Smart Memory - Active\nYour smart memory is active but empty. As you converse, learn and store facts about the user's preferences, deal patterns, prospect details, and strategies that work.`);
        }
      } else {
        setBrainContext(null);
      }

      if (!enabled) { setConversationMemory(null); return; }

      if (!currentEntityName) { setConversationMemory(null); return; }

      const { data: recentMsgs } = await supabase
        .from('copilot_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!recentMsgs || recentMsgs.length === 0) { setConversationMemory(null); return; }

      const msgs = recentMsgs;
      const entityLower = currentEntityName.toLowerCase();

      const conversations = new Map<string, any[]>();
      msgs.forEach(m => {
        const list = conversations.get(m.conversation_id) || [];
        list.push(m);
        conversations.set(m.conversation_id, list);
      });

      const relevantMsgs: any[] = [];
      for (const [, convMsgs] of conversations) {
        const mentionsEntity = convMsgs.some(m => m.content.toLowerCase().includes(entityLower));
        if (mentionsEntity) relevantMsgs.push(...convMsgs);
      }

      if (relevantMsgs.length === 0) { setConversationMemory(null); return; }

      const memoryParts: string[] = [];
      const allUserMsgs = relevantMsgs.filter(m => m.role === 'user').map(m => m.content);

      const notePatterns = allUserMsgs.filter(m =>
        /note|remember|funny|joke|lol|haha|btw|fyi/i.test(m)
      ).slice(0, 5);
      if (notePatterns.length > 0) {
        memoryParts.push(`**Personal notes about ${currentEntityName}:**\n${notePatterns.map(n => `- "${n.slice(0, 150)}"`).join('\n')}`);
      }

      const recentTopics: string[] = [];
      let convCount = 0;
      for (const [, convMsgs] of conversations) {
        if (convCount >= 5) break;
        const mentionsEntity = convMsgs.some(m => m.content.toLowerCase().includes(entityLower));
        if (!mentionsEntity) continue;
        const firstUserMsg = convMsgs.find(m => m.role === 'user');
        if (firstUserMsg) {
          const date = new Date(firstUserMsg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          recentTopics.push(`- ${date}: "${firstUserMsg.content.slice(0, 100)}"`);
          convCount++;
        }
      }
      if (recentTopics.length > 0) {
        memoryParts.push(`**Past conversations about ${currentEntityName}:**\n${recentTopics.join('\n')}`);
      }

      const draftMsgs = allUserMsgs.filter(m => /draft|email|outreach|tone|write/i.test(m));
      if (draftMsgs.length > 0) {
        memoryParts.push(`**Outreach history:** ${draftMsgs.length} draft/email requests about ${currentEntityName}`);
      }

      if (memoryParts.length > 0) {
        setConversationMemory(`### Memory: ${currentEntityName}\nYou have memory of past conversations about **${currentEntityName}** specifically. Use this to personalize responses, reference prior discussions about this prospect, and if there's anything funny in the notes - work it in naturally.\n\n${memoryParts.join('\n\n')}`);
      } else {
        setConversationMemory(null);
      }
    };
    loadMemoryAndSettings();
  }, [user, currentEntityName, open]);

  // Save message to DB
  const persistMessage = useCallback(async (msg: Msg, convId: string) => {
    if (!user) return;
    await supabase.from('copilot_messages').insert({
      user_id: user.id,
      conversation_id: convId,
      role: msg.role,
      content: msg.content,
    });
  }, [user]);

  // Proactive alerts check
  useEffect(() => {
    if (!alertsEnabled) return;

    const checkAlerts = async () => {
      const now = new Date();
      const alerts: string[] = [];

      if (pipeline.length > 0) {
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

        const staleDeals = pipeline.filter(item => {
          if (['won', 'closed', 'lost'].includes(item.stage)) return false;
          const lastActivity = new Date(item.lastActivity);
          const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / 86400000);
          return daysSince >= 7;
        });

        if (expiringThisMonth.length > 0) alerts.push(`${expiringThisMonth.length} lease(s) expire this month`);
        if (overdueFollowUps.length > 0) alerts.push(`${overdueFollowUps.length} overdue follow-up(s)`);
        if (staleDeals.length > 0) alerts.push(`${staleDeals.length} deal(s) need attention`);
      }

      if (user) {
        const { data: critDates } = await supabase
          .from('critical_dates')
          .select('*')
          .eq('user_id', user.id)
          .eq('acknowledged', false);

        if (critDates && critDates.length > 0) {
          const urgentDates = critDates.filter(d => {
            const target = new Date(d.date_value + 'T00:00:00');
            const daysUntil = Math.ceil((target.getTime() - now.getTime()) / 86400000);
            return daysUntil <= d.remind_days_before && daysUntil >= -7;
          });
          if (urgentDates.length > 0) {
            const critical = urgentDates.filter(d => {
              const daysUntil = Math.ceil((new Date(d.date_value + 'T00:00:00').getTime() - now.getTime()) / 86400000);
              return daysUntil <= 14;
            });
            if (critical.length > 0) {
              alerts.push(`${critical.length} critical date(s) within 2 weeks`);
            } else {
              alerts.push(`${urgentDates.length} critical date(s) approaching`);
            }
          }
        }
      }

      if (alerts.length > 0) {
        setProactiveAlert(alerts.join(' . '));
      }
    };

    checkAlerts();
  }, [pipeline, alertsEnabled, user]);

  useEffect(() => {
    const handleSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        copilotName?: string;
        copilotMemory?: boolean;
        brainEnabled?: boolean;
        aiSettings?: {
          aiAutoBrainExtraction: boolean;
          aiEmailPerformanceLoop: boolean;
          aiDealPatternLearning: boolean;
          aiActivityInsights: boolean;
          aiStyleTraining: boolean;
          aiScoopSynthesis: boolean;
          aiContactMemory: boolean;
        };
      };

      if (detail.copilotName) setCopilotName(detail.copilotName);
      if (typeof detail.copilotMemory === 'boolean') setMemoryEnabled(detail.copilotMemory);
      if (typeof detail.brainEnabled === 'boolean') setBrainEnabled(detail.brainEnabled);
      if (detail.aiSettings) setAiSettings(detail.aiSettings);
    };

    window.addEventListener('copilot-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('copilot-settings-updated', handleSettingsUpdate);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollToBottom();
        inputRef.current?.focus();
      }, 150);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Copy message
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Clear conversation
  const handleClear = async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setIsLoading(false);
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

  // Check if message is a comp / financial analysis report
  const isCompReport = (content: string) => {
    const lc = content.toLowerCase();
    return (lc.includes('financial analysis') || lc.includes('comp analysis') || lc.includes('lease comparison') || lc.includes('total term value') || lc.includes('cumulative rent') || /npv\s*(at|@)/i.test(content)) && content.includes('|');
  };

  // Check if message is a cashflow report
  const isCashflowReport = (content: string) => {
    if (isCompReport(content)) return false;
    const lc = content.toLowerCase();
    return (lc.includes('cash flow') || lc.includes('cashflow')) &&
      (lc.includes('base rent') || lc.includes('compilation') || lc.includes('total monthly cost') || lc.includes('total annual cost') || lc.includes('escalation'));
  };

  // Check if message is a substantial report
  const isExportableReport = (content: string) => {
    const len = content.length;
    if (len < 300) return false;
    const hasStructure = (content.match(/^#{1,3}\s/gm) || []).length >= 3;
    const hasTable = content.includes('|') && content.includes('---');
    return hasStructure || hasTable;
  };

  // Export message as Word document
  const handleExportWord = async (content: string) => {
    const { exportToWord } = await import('@/lib/exportToWord');
    const { exportMatrixToWord } = await import('@/lib/exportMatrixToWord');
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

  // Export cashflow as Excel
  const handleExportExcel = async (content: string) => {
    const { exportCashflowToExcel } = await import('@/lib/exportCashflowToExcel');
    const h1Match = content.match(/^#\s+(.+)/m);
    const filename = h1Match?.[1]?.slice(0, 50) || 'Cash_Flow_Analysis';
    try {
      await exportCashflowToExcel(content, filename);
      toast.success('Excel file downloaded');
    } catch (e) {
      console.error('Excel export error:', e);
      toast.error('Failed to export Excel file');
    }
  };

  // Export email draft
  const handleExportEmail = (content: string) => {
    const lines = content.split('\n');
    const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:') || l.toLowerCase().includes('**subject:'));
    const subject = subjectLine?.replace(/\*?\*?subject:\*?\*?\s*/i, '').trim() || '';
    navigator.clipboard.writeText(content);
    toast.success('Email draft copied - paste into your email composer');
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
    });
    if (error) {
      toast.error('Failed to save template');
      console.error('Template save error:', error);
    } else {
      toast.success(`Template "${name}" saved! It will be used automatically for future requests.`);
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
      data.map(t => `\n**Template: "${t.name}"** (type: ${t.template_type}, from: ${t.original_filename})\n\`\`\`\n${t.parsed_structure}\n\`\`\``).join('\n');
  };

  // File handling
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

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
      return [...prev, file];
    });
  };

  const sendFileMessage = async (question: string) => {
    if (attachedFiles.length === 0 || isLoading) return;

    const fileNames = attachedFiles.map(f => f.name);
    const fileLabel = fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`;
    const userContent = question.trim() || `Analyze ${fileLabel}`;
    const isTemplateSave = userContent.toLowerCase().includes('save') && userContent.toLowerCase().includes('template');
    const isAbstract = /abstract/i.test(userContent) || /\/abstract/i.test(userContent);
    const isCashflow = /\/cashflow/i.test(userContent) || (/cash\s*flow/i.test(userContent) && /analy/i.test(userContent));
    const isMatrix = /\/matrix/i.test(userContent) || (/matrix/i.test(userContent) && /deal\s*terms/i.test(userContent)) || /summary\s*of\s*proposals/i.test(userContent);
    const isComp = !isMatrix && !isCashflow && (/\/comp/i.test(userContent) || (/comp/i.test(userContent) && /compar/i.test(userContent)) || /compare.*offers?/i.test(userContent) || /comparison/i.test(userContent));
    const fileChips = fileNames.map(n => `**${n}**`).join('\n');
    const userMsg: Msg = { role: 'user', content: `${fileChips}\n${userContent}`, fileName: fileNames[0] };
    // Auto-export abstracts, comps, matrices, cashflows to Word
    pendingAutoExportRef.current = isAbstract || isComp || isMatrix || isCashflow;
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const convId = conversationId || crypto.randomUUID();
    if (!conversationId) setConversationId(convId);
    await persistMessage({ role: 'user', content: userContent }, convId);

    let assistantSoFar = '';
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authToken = await getAuthToken();

      const formData = new FormData();
      attachedFiles.forEach(f => formData.append('file', f));
      if (isTemplateSave) {
        formData.append('question', `Extract the EXACT structure, layout, formatting, and field labels from this template document. Preserve all headers, sections, field names, column names, and formatting patterns. Output a clear structural blueprint that can be replicated. Include:\n1. Document title/header format\n2. All section headers in order\n3. Field labels and their expected value types\n4. Table structures with column names\n5. Any footer/signature blocks\n\nDo NOT fill in values - just show the template skeleton.`);
      } else if (isAbstract) {
        formData.append('question', `Run a complete lease abstract on this document.\n\n${LEASE_ABSTRACT_TEMPLATE}`);
      } else if (isMatrix) {
        formData.append('question', `Create a Summary of Proposals deal terms matrix from these documents. Number of files attached: ${attachedFiles.length}.\n\n${MATRIX_TEMPLATE}`);
      } else if (isComp) {
        formData.append('question', `Run a complete Comparison of Options analysis on these documents.\n\n${COMP_COMPARISON_TEMPLATE}`);
      } else if (isCashflow) {
        formData.append('question', `Run a complete Cash Flow Analysis on this lease document.\n\n${CASHFLOW_TEMPLATE}`);
      } else {
        formData.append('question', userContent);
      }
      formData.append('context', buildContext());

      const resp = await fetch(FILE_PARSE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `File analysis failed (${resp.status})`);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && resp.body) {
        let rafPending = false;
        await parseSSEStream(resp.body.getReader(), (content) => {
          assistantSoFar += content;
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            });
          }
        }, controller.signal);
        // Final flush after stream ends
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      } else {
        const data = await resp.json();
        assistantSoFar = data.content || data.error || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar }]);
      }

      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);
      }

      // Fire-and-forget: embed parsed document content for RAG search
      if (assistantSoFar && fileNames.length > 0) {
        for (const fileName of fileNames) {
          embedAfterSave('document', `doc-${fileName}-${Date.now()}`, {
            content: assistantSoFar,
            filename: fileName,
            title: fileName.replace(/\.[^.]+$/, ''),
          });
        }
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

      // Auto-extract critical dates from lease abstracts
      if (isAbstract && assistantSoFar && user) {
        try {
          const tenantMatch = location.pathname.match(/\/building\/(.+)\/tenant\/(.+)/);
          let prospectName = '';
          let buildingName = '';
          let prospectId = '';
          if (tenantMatch) {
            const [, bId, tId] = tenantMatch;
            const building = buildings.find(b => b.id === bId);
            const tenant = building?.tenants.find(t => t.id === tId);
            prospectName = tenant?.name || '';
            buildingName = building?.name || '';
            prospectId = tId;
          }

          const extractResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-critical-dates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              leaseText: assistantSoFar.slice(0, 15000),
              prospectName,
              buildingName,
              prospectId,
            }),
          });

          if (extractResp.ok) {
            const extractData = await extractResp.json();
            if (extractData.dates?.length > 0) {
              const rows = extractData.dates.map((d: any) => ({
                user_id: user.id,
                prospect_id: prospectId || null,
                prospect_name: prospectName || 'Unknown',
                building_name: buildingName || 'Unknown',
                date_type: d.date_type,
                date_value: d.date_value,
                description: d.description,
                remind_days_before: d.remind_days_before || 30,
                source: 'abstract',
                lease_abstract_id: null,
                acknowledged: false,
              }));
              await supabase.from('critical_dates').insert(rows);
              toast.success(`${extractData.dates.length} critical dates extracted and tracked`, {
                description: 'View them on your Dashboard',
              });
            }
          }
        } catch (err) {
          console.error('Critical date extraction failed:', err);
        }

        // Also extract structured lease data in parallel
        try {
          const parseResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-lease-abstract`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              abstractText: assistantSoFar.slice(0, 15000),
              prospectName,
              buildingName,
            }),
          });

          if (parseResp.ok) {
            const parsed = await parseResp.json();
            const abstractRow = {
              user_id: user.id,
              prospect_id: prospectId || null,
              prospect_name: parsed.prospect_name || prospectName || 'Unknown',
              building_name: parsed.building_name || buildingName || 'Unknown',
              building_address: parsed.building_address || '',
              tenant_name: parsed.tenant_name || '',
              landlord_name: parsed.landlord_name || '',
              premises_sf: parsed.premises_sf || null,
              floor_suite: parsed.floor_suite || '',
              lease_type: parsed.lease_type || '',
              commencement_date: parsed.commencement_date || null,
              expiration_date: parsed.expiration_date || null,
              term_months: parsed.term_months || null,
              base_rent_psf: parsed.base_rent_psf || null,
              rent_schedule: parsed.rent_schedule || [],
              escalation_type: parsed.escalation_type || '',
              escalation_rate: parsed.escalation_rate || null,
              free_rent_months: parsed.free_rent_months || 0,
              ti_allowance_psf: parsed.ti_allowance_psf || null,
              parking_spaces: parsed.parking_spaces || null,
              parking_rate: parsed.parking_rate || null,
              renewal_options: parsed.renewal_options || [],
              expansion_options: parsed.expansion_options || [],
              termination_options: parsed.termination_options || [],
              operating_expenses: parsed.operating_expenses || '',
              security_deposit: parsed.security_deposit || '',
              assignment_subletting: parsed.assignment_subletting || '',
              notable_clauses: parsed.notable_clauses || '',
              source_filename: fileNames[0] || '',
              raw_abstract: assistantSoFar,
              completeness_score: parsed.completeness_score || 0,
            };
            await supabase.from('lease_abstracts' as any).insert(abstractRow as any);
            toast.success('Structured lease abstract saved', {
              description: 'View it on the Lease Abstracts page',
              action: {
                label: 'View',
                onClick: () => window.location.href = '/lease-abstracts',
              },
            });

            // Append a link to the chat
            setMessages(prev => {
              const viewLink = '\n\n---\n[View Parsed Abstract](/lease-abstracts)';
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + viewLink } : m);
              }
              return prev;
            });
          }
        } catch (err) {
          console.error('Structured lease parsing failed:', err);
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('File analysis error:', e);
      toast.error(e.message || 'Failed to analyze file');
      if (!assistantSoFar) setMessages(prev => prev.slice(0, -1));
    }

    if (assistantSoFar) {
      setFileContext(`Previously analyzed files: ${fileNames.join(', ')}. Summary:\n${assistantSoFar.slice(0, 2000)}`);
    }
    setAttachedFiles([]);
    setIsLoading(false);
    abortControllerRef.current = null;
  };

  // Market report search
  const searchMarketReports = useCallback(async (query: string) => {
    if (!user) return;
    setMarketReportSearch(prev => ({ ...prev, open: true, query, loading: true, results: [] }));

    const { data } = await supabase
      .from('copilot_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data) {
      setMarketReportSearch(prev => ({ ...prev, loading: false }));
      return;
    }

    const reportKeywords = ['market', 'report', 'analysis', 'comp', 'submarket', 'vacancy', 'lease', 'trend', 'forecast', 'overview', 'summary', 'abstract', 'cash flow', 'matrix'];
    const searchLower = query.toLowerCase();

    const reports = data
      .filter(m => {
        const content = m.content.toLowerCase();
        const isReport = content.length > 300 && (content.includes('##') || content.includes('**') || content.includes('| '));
        const matchesSearch = !searchLower || reportKeywords.some(k => content.includes(k)) || content.includes(searchLower);
        return isReport && matchesSearch;
      })
      .map(m => {
        const headingMatch = m.content.match(/^#{1,3}\s+(.+)/m) || m.content.match(/\*\*(.+?)\*\*/);
        const preview = headingMatch ? headingMatch[1].slice(0, 80) : m.content.slice(0, 80);
        return {
          content: m.content,
          preview,
          date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          conversationId: m.conversation_id,
        };
      })
      .slice(0, 20);

    setMarketReportSearch(prev => ({ ...prev, loading: false, results: reports }));
  }, [user]);

  const handleSelectReport = (report: { content: string; preview: string; date: string }) => {
    setMarketReportSearch({ open: false, query: '', results: [], loading: false });
    setMessages(prev => [
      ...prev,
      { role: 'user', content: `Pull up this market report: "${report.preview}"` },
      { role: 'assistant', content: `**Market Report** (${report.date})\n\n${report.content}` },
    ]);
  };

  const sendMessage = async (text: string) => {
    // Intercept /market report command
    if (/^\/?market\s+report/i.test(text.trim())) {
      const query = text.trim().replace(/^\/?market\s+report\s*/i, '');
      setInput('');
      setShowSlashCommands(false);
      searchMarketReports(query);
      return;
    }

    // If files are attached, route to file handler
    if (attachedFiles.length > 0) {
      return sendFileMessage(text);
    }
    if (!text.trim()) return;
    if (isLoadingRef.current) {
      if (!voiceModeRef.current) return;
      return;
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    const isAutoExport = /^\/?comp\b/i.test(text.trim()) || /^compare\s+(these\s+)?lease/i.test(text.trim()) || /financial\s+analysis/i.test(text.trim()) || /abstract/i.test(text.trim()) || /lease\s*summary/i.test(text.trim());
    pendingAutoExportRef.current = isAutoExport;
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const convId = conversationIdRef.current || crypto.randomUUID();
    if (!conversationIdRef.current) setConversationId(convId);

    await persistMessage(userMsg, convId);

    let assistantSoFar = '';

    try {
      // RAG: retrieve relevant embedded context for this question
      let ragCtx = '';
      if (!voiceModeRef.current && orgId) {
        try {
          const ragToken = await getAuthToken();
          const ragResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ask`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ragToken}`,
            },
            body: JSON.stringify({ question: text, topK: 5, threshold: 0.4, retrieveOnly: true }),
          });
          if (ragResp.ok) {
            const ragData = await ragResp.json();
            if (ragData.chunks?.length > 0) {
              ragCtx = '\n\n### RAG Retrieved Context (relevant embedded deal data)\nUse this data to give specific, grounded answers. Reference names, numbers, and details from these records.\n' +
                ragData.chunks.map((c: any, i: number) => {
                  const meta = c.metadata || {};
                  const metaParts = [
                    meta.tenant && `Tenant: ${meta.tenant}`,
                    meta.stage && `Stage: ${meta.stage}`,
                    meta.sf && `SF: ${Number(meta.sf).toLocaleString()}`,
                    meta.category && `Category: ${meta.category}`,
                  ].filter(Boolean).join(' | ');
                  return `[${i + 1}] [${c.type.toUpperCase()}]${metaParts ? ` (${metaParts})` : ''} (${Math.round(c.similarity * 100)}% match)\n${c.content}`;
                }).join('\n\n');
            }
          }
        } catch {
          // RAG retrieval is best-effort — don't block the copilot
        }
      }

      const templateCtx = voiceModeRef.current ? '' : await loadTemplates();
      const memoryCtx = memoryEnabled && conversationMemory ? `\n\n${conversationMemory}` : '';
      const brainCtx = brainEnabled && brainContext ? `\n\n${brainContext}` : '';

      let brokerProfileCtx = '';
      if (!voiceModeRef.current && user) {
        const { data: bp } = await supabase
          .from('user_settings')
          .select('specialties, years_experience, deal_size_sweet_spot, asset_classes, communication_persona_enabled, writing_style_sample, jargon_level, humor_preference, followup_cadence, target_submarkets, key_competitors, buildings_repped, landlord_relationships, quarterly_focus, revenue_target, deal_count_goal, personal_pitch, brokerage')
          .eq('user_id', user.id)
          .single();

        if (bp) {
          const s = bp;
          const parts: string[] = [];
          if (s.specialties) parts.push(`- **Specialties:** ${s.specialties}`);
          if (s.years_experience) parts.push(`- **Experience:** ${s.years_experience} years`);
          if (s.deal_size_sweet_spot) parts.push(`- **Deal Size Sweet Spot:** ${s.deal_size_sweet_spot}`);
          if (s.asset_classes) parts.push(`- **Asset Classes:** ${s.asset_classes}`);
          if (s.brokerage) parts.push(`- **Brokerage:** ${s.brokerage}`);
          if (s.personal_pitch) parts.push(`- **Elevator Pitch:** ${s.personal_pitch}`);
          if (s.target_submarkets) parts.push(`- **Target Submarkets:** ${s.target_submarkets}`);
          if (s.key_competitors) parts.push(`- **Competitors:** ${s.key_competitors}`);
          if (s.buildings_repped) parts.push(`- **Buildings Repped:** ${s.buildings_repped}`);
          if (s.landlord_relationships) parts.push(`- **Landlord Relationships:** ${s.landlord_relationships}`);
          if (s.quarterly_focus) parts.push(`- **This Quarter's Focus:** ${s.quarterly_focus}`);
          if (s.revenue_target) parts.push(`- **Revenue Target:** ${s.revenue_target}`);
          if (s.deal_count_goal) parts.push(`- **Deal Count Goal:** ${s.deal_count_goal}`);

          if (parts.length > 0) {
            brokerProfileCtx = `\n\n### Broker Profile\nThis is who you're working with. Tailor all advice, strategy, and priorities to THIS broker's strengths, market, and goals. Reference their expertise when relevant.\n${parts.join('\n')}`;
          }

          if (s.communication_persona_enabled) {
            const personaParts: string[] = [];
            personaParts.push(`- **Jargon Level:** ${s.jargon_level}`);
            personaParts.push(`- **Humor:** ${s.humor_preference}`);
            personaParts.push(`- **Follow-Up Cadence:** ${s.followup_cadence}`);
            if (s.writing_style_sample) {
              personaParts.push(`- **Writing Style Sample (mirror this voice):**\n> ${s.writing_style_sample.split('\n').join('\n> ')}`);
            }
            brokerProfileCtx += `\n\n### Communication Persona - ACTIVE\nMirror this broker's communication style in ALL drafts, emails, and responses.\n${personaParts.join('\n')}`;
          }
        }
      }

      // Live data awareness when brain is enabled
      let liveDataCtx = '';
      if (brainEnabled && !voiceModeRef.current) {
        const { data: critDates } = await supabase
          .from('critical_dates')
          .select('*')
          .eq('user_id', user!.id)
          .eq('acknowledged', false)
          .order('date_value', { ascending: true })
          .limit(20);

        if (critDates && critDates.length > 0) {
          const dateLines = critDates.map(d => {
            const target = new Date(d.date_value + 'T00:00:00');
            const days = Math.ceil((target.getTime() - Date.now()) / 86400000);
            return `- ${d.prospect_name}: ${d.date_type.replace(/_/g, ' ')} in ${days}d (${d.date_value}) - ${d.description}`;
          });
          liveDataCtx += `\n\n### Live Critical Dates\n${dateLines.join('\n')}`;
        }

        const { data: recentActs } = await supabase
          .from('activities')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50);

        if (recentActs && recentActs.length > 0) {
          const actLines = recentActs.slice(0, 10).map(a => `- ${a.type}: ${a.title} (${new Date(a.timestamp).toLocaleDateString()})`);
          liveDataCtx += `\n\n### Recent Activities\n${actLines.join('\n')}`;

          const now = new Date();
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
          const last30 = recentActs.filter(a => new Date(a.timestamp) >= thirtyDaysAgo);
          const typeCounts: Record<string, number> = {};
          last30.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
          const total = last30.length;
          if (total > 0) {
            const breakdown = Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => `- ${type}: ${count} (${Math.round(count / total * 100)}%)`)
              .join('\n');
            liveDataCtx += `\n\n### Time Allocation (Last 30 Days)\nTotal activities: ${total}\n${breakdown}\nUse this to coach the user on how they spend their time. If they're heavy on emails but light on tours, suggest rebalancing. If they haven't made calls in a while, flag it. Be specific and actionable.`;
          }
        }

        const { data: pendingTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('completed', false)
          .order('due_date', { ascending: true })
          .limit(10);

        if (pendingTasks && pendingTasks.length > 0) {
          const taskLines = pendingTasks.map(t => `- ${t.title} (due: ${new Date(t.due_date).toLocaleDateString()}, priority: ${t.priority})`);
          liveDataCtx += `\n\n### Pending Tasks\n${taskLines.join('\n')}`;
        }

        // Trigger Stacking
        const triggerAlerts: string[] = [];
        const pipelineDeals = pipeline || [];

        for (const deal of pipelineDeals) {
          const signals: string[] = [];
          let urgency = 0;

          if (critDates && critDates.length > 0) {
            const matchingDates = critDates.filter(d =>
              (d.prospect_name && deal.prospectName && d.prospect_name.toLowerCase().includes(deal.prospectName.toLowerCase())) ||
              (d.prospect_id && d.prospect_id === deal.tenantId)
            );
            matchingDates.forEach(d => {
              const days = Math.ceil((new Date(d.date_value + 'T00:00:00').getTime() - Date.now()) / 86400000);
              if (days <= 90) {
                signals.push(`lease ${d.date_type.replace(/_/g, ' ')} in ${days}d`);
                urgency += days <= 30 ? 3 : days <= 60 ? 2 : 1;
              }
            });
          }

          const daysSinceActivity = Math.floor((Date.now() - new Date(deal.lastActivity).getTime()) / 86400000);
          if (daysSinceActivity >= 7 && !['won', 'closed', 'lost'].includes(deal.stage)) {
            signals.push(`${daysSinceActivity}d since last touch`);
            urgency += daysSinceActivity >= 14 ? 2 : 1;
          }

          if (['proposal', 'negotiation', 'loi'].includes(deal.stage)) {
            signals.push(`in ${deal.stage} stage`);
            urgency += 1;
          }

          const overdueTP = (deal.sentTouchpoints || []).filter(
            (tp: any) => tp.followUpDate && tp.followUpDate < new Date().toISOString()
          );
          if (overdueTP.length > 0) {
            signals.push(`${overdueTP.length} overdue follow-up(s)`);
            urgency += overdueTP.length;
          }

          if (deal.prospectSqft && deal.prospectSqft >= 10000) {
            signals.push(`${deal.prospectSqft.toLocaleString()} SF prospect`);
            urgency += 1;
          }

          if (signals.length >= 2) {
            const name = deal.prospectName || deal.prospectCompany || deal.tenantId;
            triggerAlerts.push(`- **${name}** (urgency: ${urgency}) - ${signals.join(' + ')}`);
          }
        }

        if (triggerAlerts.length > 0) {
          triggerAlerts.sort((a, b) => {
            const aUrg = parseInt(a.match(/urgency: (\d+)/)?.[1] || '0');
            const bUrg = parseInt(b.match(/urgency: (\d+)/)?.[1] || '0');
            return bUrg - aUrg;
          });
          liveDataCtx += `\n\n### Trigger Stacking - Strike Now Alerts\nThese deals have MULTIPLE converging signals. Prioritize them aggressively. When the user asks "what should I do" or "who should I call", lead with these. Be specific about WHY each deal is hot.\n${triggerAlerts.slice(0, 8).join('\n')}`;
        }
      }

      const intelligenceCtx = intelligenceContext ? `\n\n${intelligenceContext}` : '';
      const fullContext = voiceModeRef.current ? '' : (buildContext() + ragCtx + (fileContext ? `\n\n### Previous File Analysis\n${fileContext}` : '') + templateCtx + memoryCtx + brainCtx + liveDataCtx + brokerProfileCtx + intelligenceCtx);

      const authToken = await getAuthToken();

      // Context compaction: when conversation exceeds threshold, summarize older messages
      // (per Anthropic cookbook context_compaction pattern)
      const MAX_API_MESSAGES = 30;
      const COMPACTION_THRESHOLD = 40;
      let apiMessages: Msg[];

      if (updatedMessages.length > COMPACTION_THRESHOLD) {
        // Summarize older messages into a single context message
        const olderMessages = updatedMessages.slice(0, -MAX_API_MESSAGES);
        const recentMessages = updatedMessages.slice(-MAX_API_MESSAGES);
        const pinnedMessages = updatedMessages.filter(m => m.pinned);

        const summaryParts = olderMessages
          .filter(m => m.content.length > 20)
          .map(m => `${m.role === 'user' ? 'Broker' : 'Copilot'}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
          .join('\n');

        const compactionMsg: Msg = {
          role: 'user',
          content: `[CONVERSATION HISTORY SUMMARY - Earlier in this conversation, the following was discussed:\n${summaryParts}\n\nPlease continue from where we left off.]`,
        };

        apiMessages = [compactionMsg, ...new Set([...pinnedMessages, ...recentMessages])];
      } else {
        const pinnedMessages = updatedMessages.filter(m => m.pinned);
        const recentMessages = updatedMessages.slice(-MAX_API_MESSAGES);
        apiMessages = [...new Set([...pinnedMessages, ...recentMessages])];
      }

      const resp = await fetch(COPILOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          context: fullContext,
          mode: 'tools',
          voiceMode: voiceModeRef.current,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const contentType = resp.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await resp.json();
        assistantSoFar = data.content || 'Action completed.';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar }]);

        if (data.actions?.some((a: string) => ['move_deal_stage', 'add_deal_note'].includes(a))) {
          refetchPipeline();
        }
      } else {
        if (!resp.body) throw new Error('No response body');
        let ttsBuffer = '';
        let rafPending = false;

        await parseSSEStream(resp.body.getReader(), (content) => {
          assistantSoFar += content;
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            });
          }

          // Chunked TTS: queue sentences as they complete during streaming
          if (voiceModeRef.current && enqueueTTSChunkRef.current) {
            ttsBuffer += content;
            const sentenceMatch = ttsBuffer.match(/^(.*?[.!?])\s+(.*)$/s);
            if (sentenceMatch) {
              const completeSentence = sentenceMatch[1].trim();
              ttsBuffer = sentenceMatch[2];
              if (completeSentence.length > 10) {
                enqueueTTSChunkRef.current(completeSentence);
              }
            }
          }
        }, controller.signal);

        // Final flush after stream ends
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });

        // Flush remaining TTS buffer
        if (voiceModeRef.current && ttsBuffer.trim().length > 5 && enqueueTTSChunkRef.current) {
          enqueueTTSChunkRef.current(ttsBuffer.trim());
        }
      }

      // Persist assistant message
      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);
        if (pendingAutoExportRef.current && isExportableReport(assistantSoFar)) {
          pendingAutoExportRef.current = false;
          setTimeout(() => handleExportWord(assistantSoFar), 500);
        }
      }

      // Brain learning
      if ((brainEnabled || aiSettings.aiAutoBrainExtraction) && assistantSoFar && user) {
        (async () => {
          try {
            const userText = text.trim();
            if (userText.length < 15 && assistantSoFar.length < 100) return;

            const learnResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-copilot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                messages: [
                  { role: 'user', content: userText },
                  { role: 'assistant', content: assistantSoFar.slice(0, 3000) },
                ],
                context: `Extract any new learnable facts from this exchange. Categories: deal_pattern, user_preference, prospect_insight, strategy, market_knowledge, personal_note. Only extract genuinely new, useful facts - not generic observations. Return JSON array of objects with {category, fact, prospect_name?} or empty array [] if nothing worth learning.`,
                mode: 'brain_extract',
              }),
            });

            if (learnResp.ok) {
              const learnData = await learnResp.json();
              const content = learnData.content || '';
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const facts = JSON.parse(jsonMatch[0]);
                if (Array.isArray(facts) && facts.length > 0) {
                  const rows = facts.slice(0, 5).map((f: any) => ({
                    user_id: user.id,
                    category: f.category || 'general',
                    fact: f.fact,
                    prospect_name: f.prospect_name || null,
                    prospect_id: null,
                    context: userText.slice(0, 200),
                    source: 'conversation',
                    confidence: 0.8,
                    ...(orgId ? { organization_id: orgId } : {}),
                  }));
                  await supabase.from('copilot_brain').insert(rows);
                }
              }
            }
          } catch (err) {
            console.error('Brain learning error:', err);
          }
        })();
      }

      refetchPipeline();
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Copilot error:', e);
      toast.error(e.message || 'Failed to get response');
      if (!assistantSoFar) {
        setMessages(prev => prev.slice(0, -1));
      }
    }
    setIsLoading(false);
    abortControllerRef.current = null;
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
    setShowSlashCommands(value.startsWith('/') && !value.includes(' '));
  };

  const handleSlashSelect = (template: string) => {
    setInput(template);
    setShowSlashCommands(false);
    inputRef.current?.focus();
  };

  return {
    // Auth
    user,
    location,
    navigate,
    // UI state
    open, setOpen,
    messages, setMessages,
    input, setInput,
    isLoading, setIsLoading,
    conversationId, setConversationId,
    copiedIndex, setCopiedIndex,
    isRecording, setIsRecording,
    alertsEnabled, setAlertsEnabled,
    proactiveAlert, setProactiveAlert,
    attachedFiles, setAttachedFiles,
    isDraggingOver, setIsDraggingOver,
    showSlashCommands, setShowSlashCommands,
    fileContext, setFileContext,
    pitchDeckContent, setPitchDeckContent,
    voiceMode, setVoiceMode,
    isSpeaking, setIsSpeaking,
    marketReportSearch, setMarketReportSearch,
    copilotName,
    // Refs
    scrollRef,
    inputRef,
    pendingAutoExportRef,
    recognitionRef,
    fileInputRef,
    audioRef,
    voiceModeRef,
    isSpeakingRef,
    currentSpokenTextRef,
    lastVoiceSentRef,
    lastVoiceSentAtRef,
    ttsQueueRef,
    ttsPlayingRef,
    scribeConnectedRef,
    messagesRef,
    isLoadingRef,
    conversationIdRef,
    silenceTimerRef,
    pendingTranscriptRef,
    // Pipeline
    pipeline,
    refetchPipeline,
    // Actions
    buildContext,
    persistMessage,
    scrollToBottom,
    handleCopy,
    handleClear,
    handleLoadConversation,
    handleNewConversation,
    togglePin,
    hasEmailDraft,
    isMatrixReport,
    isCompReport,
    isCashflowReport,
    isExportableReport,
    handleExportWord,
    handleExportExcel,
    handleExportEmail,
    handleFileDrop,
    handleFileSelect,
    validateAndAttachFile,
    sendFileMessage,
    searchMarketReports,
    handleSelectReport,
    sendMessage,
    handleKeyDown,
    handleInputChange,
    handleSlashSelect,
    // Settings
    memoryEnabled,
    brainEnabled,
    aiSettings,
    intelligenceContext,
    conversationMemory,
    brainContext,
    // TTS callback registration
    setEnqueueTTSChunk,
  };
}
