import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2, Sparkles, Trash2, ChevronDown,
  Mic, MicOff, Bell, BellOff,
  Paperclip, AudioLines,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopilotFollowUps from '@/components/copilot/CopilotFollowUps';
import CopilotHistory from '@/components/copilot/CopilotHistory';
import CopilotSlashCommands from '@/components/copilot/CopilotSlashCommands';
import { CopilotFileChips, CopilotFileContextIndicator, CopilotDragOverlay } from '@/components/copilot/CopilotFileHandler';
import ChatMessage from '@/components/copilot/ChatMessage';
import type { Msg } from '@/hooks/useCopilotState';
import { SUGGESTIONS } from '@/hooks/useCopilotState';

interface CopilotChatProps {
  // State
  messages: Msg[];
  input: string;
  isLoading: boolean;
  copiedIndex: number | null;
  isRecording: boolean;
  alertsEnabled: boolean;
  proactiveAlert: string | null;
  attachedFiles: File[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  isDraggingOver: boolean;
  showSlashCommands: boolean;
  fileContext: string | null;
  setFileContext: (v: string | null) => void;
  voiceMode: boolean;
  isSpeaking: boolean;
  marketReportSearch: { open: boolean; query: string; results: { content: string; preview: string; date: string; conversationId: string }[]; loading: boolean };
  setMarketReportSearch: React.Dispatch<React.SetStateAction<{ open: boolean; query: string; results: { content: string; preview: string; date: string; conversationId: string }[]; loading: boolean }>>;
  copilotName: string;
  conversationId: string | null;
  user: any;
  pitchDeckContent: string | null;
  setPitchDeckContent: (v: string | null) => void;
  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  // Actions
  setOpen: (v: boolean) => void;
  setAlertsEnabled: (v: boolean) => void;
  handleCopy: (content: string, index: number) => void;
  handleClear: () => void;
  handleLoadConversation: (convId: string, msgs: { role: string; content: string }[]) => void;
  handleNewConversation: () => void;
  togglePin: (index: number) => void;
  sendMessage: (text: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleInputChange: (value: string) => void;
  handleSlashSelect: (template: string) => void;
  handleFileDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchMarketReports: (query: string) => void;
  handleSelectReport: (report: { content: string; preview: string; date: string }) => void;
  // Export checkers
  hasEmailDraft: (content: string) => boolean;
  isMatrixReport: (content: string) => boolean;
  isCompReport: (content: string) => boolean;
  isCashflowReport: (content: string) => boolean;
  isExportableReport: (content: string) => boolean;
  handleExportWord: (content: string) => void;
  handleExportExcel: (content: string) => void;
  handleExportEmail: (content: string) => void;
  // Voice
  toggleVoiceMode: () => void;
  toggleVoice: () => void;
  // Drag
  setIsDraggingOver: (v: boolean) => void;
  setShowSlashCommands: (v: boolean) => void;
}

function CopilotChat(props: CopilotChatProps) {
  const {
    messages, input, isLoading, copiedIndex, isRecording, alertsEnabled, proactiveAlert,
    attachedFiles, setAttachedFiles, isDraggingOver, showSlashCommands, fileContext, setFileContext,
    voiceMode, isSpeaking, marketReportSearch, setMarketReportSearch, copilotName,
    conversationId, user, pitchDeckContent, setPitchDeckContent,
    scrollRef, inputRef, fileInputRef,
    setOpen, setAlertsEnabled, handleCopy, handleClear, handleLoadConversation, handleNewConversation,
    togglePin, sendMessage, handleKeyDown, handleInputChange, handleSlashSelect,
    handleFileDrop, handleFileSelect, searchMarketReports, handleSelectReport,
    hasEmailDraft, isMatrixReport, isCompReport, isCashflowReport, isExportableReport,
    handleExportWord, handleExportExcel, handleExportEmail,
    toggleVoiceMode, toggleVoice,
    setIsDraggingOver, setShowSlashCommands,
  } = props;

  return (
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
            <h3 className="text-sm font-semibold text-foreground">{copilotName}</h3>
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

      {/* Market Report Picker */}
      <AnimatePresence>
        {marketReportSearch.open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-0 z-30 bg-card flex flex-col"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground flex-1">Market Reports</h3>
              <button
                onClick={() => setMarketReportSearch({ open: false, query: '', results: [], loading: false })}
                className="rounded-md p-1 hover:bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-border">
              <input
                type="text"
                autoFocus
                placeholder="Search reports (e.g. vacancy, submarket, comp)..."
                value={marketReportSearch.query}
                onChange={e => {
                  const q = e.target.value;
                  setMarketReportSearch(prev => ({ ...prev, query: q }));
                  searchMarketReports(q);
                }}
                className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {marketReportSearch.loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Searching reports...</span>
                </div>
              ) : marketReportSearch.results.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No reports found</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Try asking Copilot to generate a market report first</p>
                </div>
              ) : (
                marketReportSearch.results.map((report, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleSelectReport(report)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/50 hover:border-primary/30 transition-all group"
                  >
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {report.preview}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {report.date} · {report.content.length > 1000 ? `${Math.round(report.content.length / 100) / 10}k chars` : `${report.content.length} chars`}
                    </p>
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <ChatMessage
              key={i}
              msg={msg}
              index={i}
              isLast={i === messages.length - 1}
              isLoading={isLoading}
              copiedIndex={copiedIndex}
              handleCopy={handleCopy}
              togglePin={togglePin}
              isMatrixReport={isMatrixReport}
              isCompReport={isCompReport}
              isCashflowReport={isCashflowReport}
              isExportableReport={isExportableReport}
              hasEmailDraft={hasEmailDraft}
              handleExportWord={handleExportWord}
              handleExportExcel={handleExportExcel}
              handleExportEmail={handleExportEmail}
              setPitchDeckContent={setPitchDeckContent}
            />
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
      <CopilotDragOverlay isDraggingOver={isDraggingOver} />

      {/* Input */}
      <div className="border-t border-border px-3 py-3 relative">
        {/* Slash commands popup */}
        <CopilotSlashCommands
          input={input}
          visible={showSlashCommands}
          onSelect={handleSlashSelect}
        />
        {/* Attached file chips */}
        <CopilotFileChips attachedFiles={attachedFiles} setAttachedFiles={setAttachedFiles} />
        {/* File context indicator */}
        <CopilotFileContextIndicator fileContext={fileContext} setFileContext={setFileContext} attachedFiles={attachedFiles} />
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef as React.RefObject<HTMLInputElement>}
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
  );
}

export default React.memo(CopilotChat);
