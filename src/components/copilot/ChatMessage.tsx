import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Pin, PinOff } from 'lucide-react';
import { CopilotExportButtons } from '@/components/copilot/CopilotExports';
import type { Msg } from '@/hooks/useCopilotState';

interface ChatMessageProps {
  msg: Msg;
  index: number;
  isLast: boolean;
  isLoading: boolean;
  copiedIndex: number | null;
  handleCopy: (content: string, index: number) => void;
  togglePin: (index: number) => void;
  isMatrixReport: (content: string) => boolean;
  isCompReport: (content: string) => boolean;
  isCashflowReport: (content: string) => boolean;
  isExportableReport: (content: string) => boolean;
  hasEmailDraft: (content: string) => boolean;
  handleExportWord: (content: string) => void;
  handleExportExcel: (content: string) => void;
  handleExportEmail: (content: string) => void;
  setPitchDeckContent: (v: string | null) => void;
}

const ChatMessage = React.memo(function ChatMessage({
  msg, index, isLast, isLoading, copiedIndex,
  handleCopy, togglePin,
  isMatrixReport, isCompReport, isCashflowReport, isExportableReport, hasEmailDraft,
  handleExportWord, handleExportExcel, handleExportEmail, setPitchDeckContent,
}: ChatMessageProps) {
  return (
    <motion.div
      key={index}
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
              : 'bg-secondary text-secondary-foreground rounded-bl-md'
          }`}
        >
          {msg.role === 'assistant' ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-inherit [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:text-sm [&>li]:text-sm [&_*]:text-inherit [&_strong]:text-inherit [&_a]:text-primary [&_code]:text-orange-300 dark:[&_code]:text-orange-300">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {isLoading && isLast && (
                <span className="inline-block w-[2px] h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
        {msg.role === 'assistant' && !isLoading && (
          <div className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
            <button
              onClick={() => togglePin(index)}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              title={msg.pinned ? 'Unpin' : 'Pin'}
            >
              {msg.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
            <CopilotExportButtons
              content={msg.content}
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
            <button
              onClick={() => handleCopy(msg.content, index)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedIndex === index ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) => {
  // Only re-render if message content, pinned state, loading state, or copied state changed
  if (prev.msg.content !== next.msg.content) return false;
  if (prev.msg.pinned !== next.msg.pinned) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.isLast && prev.isLoading !== next.isLoading) return false;
  if (prev.copiedIndex === prev.index || next.copiedIndex === next.index) {
    if (prev.copiedIndex !== next.copiedIndex) return false;
  }
  return true;
});

export default ChatMessage;
