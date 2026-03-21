import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parsePitchSlides } from '@/lib/exportPitchToPptx';
import PitchDeckViewer from '@/components/copilot/PitchDeckViewer';
import CopilotChat from '@/components/copilot/CopilotChat';
import { useCopilotVoice } from '@/components/copilot/CopilotVoice';
import { useCopilotState } from '@/hooks/useCopilotState';

export default function DealCopilot() {
  const state = useCopilotState();

  const voice = useCopilotVoice({
    voiceMode: state.voiceMode,
    setVoiceMode: state.setVoiceMode,
    isRecording: state.isRecording,
    setIsRecording: state.setIsRecording,
    isSpeaking: state.isSpeaking,
    setIsSpeaking: state.setIsSpeaking,
    input: state.input,
    setInput: state.setInput,
    sendMessage: state.sendMessage,
    voiceModeRef: state.voiceModeRef,
    isSpeakingRef: state.isSpeakingRef,
    currentSpokenTextRef: state.currentSpokenTextRef,
    lastVoiceSentRef: state.lastVoiceSentRef,
    lastVoiceSentAtRef: state.lastVoiceSentAtRef,
    ttsQueueRef: state.ttsQueueRef,
    ttsPlayingRef: state.ttsPlayingRef,
    scribeConnectedRef: state.scribeConnectedRef,
    audioRef: state.audioRef,
    recognitionRef: state.recognitionRef,
    silenceTimerRef: state.silenceTimerRef,
    pendingTranscriptRef: state.pendingTranscriptRef,
    onRegisterEnqueueTTS: state.setEnqueueTTSChunk,
  });

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!state.open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => state.setOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 p-0 relative"
            >
              <Sparkles className="h-6 w-6" />
              {state.proactiveAlert && state.alertsEnabled && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive animate-pulse" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {state.open && (
          <CopilotChat
            messages={state.messages}
            input={state.input}
            isLoading={state.isLoading}
            copiedIndex={state.copiedIndex}
            isRecording={state.isRecording}
            alertsEnabled={state.alertsEnabled}
            proactiveAlert={state.proactiveAlert}
            attachedFiles={state.attachedFiles}
            setAttachedFiles={state.setAttachedFiles}
            isDraggingOver={state.isDraggingOver}
            showSlashCommands={state.showSlashCommands}
            fileContext={state.fileContext}
            setFileContext={state.setFileContext}
            voiceMode={state.voiceMode}
            isSpeaking={state.isSpeaking}
            marketReportSearch={state.marketReportSearch}
            setMarketReportSearch={state.setMarketReportSearch}
            copilotName={state.copilotName}
            conversationId={state.conversationId}
            user={state.user}
            pitchDeckContent={state.pitchDeckContent}
            setPitchDeckContent={state.setPitchDeckContent}
            scrollRef={state.scrollRef}
            inputRef={state.inputRef}
            fileInputRef={state.fileInputRef}
            setOpen={state.setOpen}
            setAlertsEnabled={state.setAlertsEnabled}
            handleCopy={state.handleCopy}
            handleClear={state.handleClear}
            handleLoadConversation={state.handleLoadConversation}
            handleNewConversation={state.handleNewConversation}
            togglePin={state.togglePin}
            sendMessage={state.sendMessage}
            handleKeyDown={state.handleKeyDown}
            handleInputChange={state.handleInputChange}
            handleSlashSelect={state.handleSlashSelect}
            handleFileDrop={state.handleFileDrop}
            handleFileSelect={state.handleFileSelect}
            searchMarketReports={state.searchMarketReports}
            handleSelectReport={state.handleSelectReport}
            hasEmailDraft={state.hasEmailDraft}
            isMatrixReport={state.isMatrixReport}
            isCompReport={state.isCompReport}
            isCashflowReport={state.isCashflowReport}
            isExportableReport={state.isExportableReport}
            handleExportWord={state.handleExportWord}
            handleExportExcel={state.handleExportExcel}
            handleExportEmail={state.handleExportEmail}
            toggleVoiceMode={voice.toggleVoiceMode}
            toggleVoice={voice.toggleVoice}
            setIsDraggingOver={state.setIsDraggingOver}
            setShowSlashCommands={state.setShowSlashCommands}
          />
        )}
      </AnimatePresence>

      {/* Pitch Deck Viewer */}
      {state.pitchDeckContent && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh]">
            <PitchDeckViewer
              slides={parsePitchSlides(state.pitchDeckContent)}
              onClose={() => state.setPitchDeckContent(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
