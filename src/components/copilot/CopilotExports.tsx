import React from 'react';
import { Download, ExternalLink, Maximize2 } from 'lucide-react';
import { isPitchDeck, parsePitchSlides, exportPitchToPptx } from '@/lib/exportPitchToPptx';
import { toast } from 'sonner';

interface CopilotExportButtonsProps {
  content: string;
  isMatrixReport: (content: string) => boolean;
  isCompReport: (content: string) => boolean;
  isCashflowReport: (content: string) => boolean;
  isExportableReport: (content: string) => boolean;
  hasEmailDraft: (content: string) => boolean;
  handleExportWord: (content: string) => void;
  handleExportExcel: (content: string) => void;
  handleExportEmail: (content: string) => void;
  setPitchDeckContent: (content: string | null) => void;
}

/** Export buttons that appear on assistant messages */
export function CopilotExportButtons({
  content,
  isMatrixReport,
  isCompReport,
  isCashflowReport,
  isExportableReport,
  hasEmailDraft,
  handleExportWord,
  handleExportExcel,
  handleExportEmail,
  setPitchDeckContent,
}: CopilotExportButtonsProps) {
  return (
    <>
      {isPitchDeck(content) ? (
        <button
          onClick={() => setPitchDeckContent(content)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Open pitch deck viewer"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Present</span>
        </button>
      ) : isCashflowReport(content) ? (
        <button
          onClick={() => handleExportExcel(content)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Export as Excel spreadsheet"
        >
          <Download className="h-3 w-3" />
          <span>Excel</span>
        </button>
      ) : isExportableReport(content) ? (
        <button
          onClick={() => handleExportWord(content)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Export as Word document"
        >
          <Download className="h-3 w-3" />
          <span>Word</span>
        </button>
      ) : null}
      {isPitchDeck(content) && (
        <button
          onClick={async () => {
            const slides = parsePitchSlides(content);
            await exportPitchToPptx(slides, 'Pitch_Deck');
            toast.success('PowerPoint downloaded');
          }}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Download as PowerPoint"
        >
          <Download className="h-3 w-3" />
          <span>PPTX</span>
        </button>
      )}
      {hasEmailDraft(content) && (
        <button
          onClick={() => handleExportEmail(content)}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Export email draft"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </>
  );
}

export default CopilotExportButtons;
