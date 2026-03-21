import React from 'react';
import { FileText, X } from 'lucide-react';

interface CopilotFileHandlerProps {
  attachedFiles: File[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  fileContext: string | null;
  setFileContext: (v: string | null) => void;
  isDraggingOver: boolean;
  setIsDraggingOver: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Attached file chips display */
export function CopilotFileChips({ attachedFiles, setAttachedFiles }: Pick<CopilotFileHandlerProps, 'attachedFiles' | 'setAttachedFiles'>) {
  if (attachedFiles.length === 0) return null;
  return (
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
  );
}

/** File context indicator */
export function CopilotFileContextIndicator({ fileContext, setFileContext, attachedFiles }: Pick<CopilotFileHandlerProps, 'fileContext' | 'setFileContext' | 'attachedFiles'>) {
  if (!fileContext || attachedFiles.length > 0) return null;
  return (
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
  );
}

/** Drag overlay */
export function CopilotDragOverlay({ isDraggingOver }: { isDraggingOver: boolean }) {
  if (!isDraggingOver) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-2xl backdrop-blur-sm">
      <div className="text-center">
        <FileText className="h-10 w-10 text-primary mx-auto mb-2" />
        <p className="text-sm font-medium text-primary">Drop file here</p>
        <p className="text-[10px] text-muted-foreground">PDF, DOCX, XLSX, TXT, CSV, JSON</p>
      </div>
    </div>
  );
}

export default CopilotFileChips;
