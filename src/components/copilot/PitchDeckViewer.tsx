import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { PitchSlide, exportPitchToPptx } from '@/lib/exportPitchToPptx';
import { toast } from 'sonner';

interface Props {
  slides: PitchSlide[];
  onClose: () => void;
}

export default function PitchDeckViewer({ slides, onClose }: Props) {
  const [current, setCurrent] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const slide = slides[current];
  if (!slide) return null;

  const handleExport = async () => {
    try {
      await exportPitchToPptx(slides, slide.title || 'Pitch_Deck');
      toast.success('PowerPoint downloaded');
    } catch (e) {
      console.error('PPTX export error:', e);
      toast.error('Failed to export PowerPoint');
    }
  };

  const containerClass = fullscreen
    ? 'absolute inset-0 z-[100] bg-black flex flex-col'
    : 'flex flex-col w-full rounded-xl overflow-hidden border border-border bg-card';

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border shrink-0">
        <span className="text-[11px] text-muted-foreground font-medium">
          Slide {current + 1} of {slides.length}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleExport} title="Download PowerPoint">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose} title="Close">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Slide canvas */}
      <div className={`relative flex-1 flex items-center justify-center ${fullscreen ? 'bg-black' : 'bg-muted/30'} overflow-hidden`}>
        <div className={`relative ${fullscreen ? 'w-[90vw] max-w-[1200px]' : 'w-full'}`} style={{ aspectRatio: '16/9' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={`absolute inset-0 rounded-lg overflow-hidden shadow-lg ${
                current === 0 ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
              }`}
            >
              {current === 0 ? (
                /* Cover slide */
                <div className="flex flex-col justify-center h-full px-[8%] py-[6%]">
                  <h1 className="text-[clamp(16px,3.5vw,36px)] font-bold leading-tight">{slide.title}</h1>
                  {slide.subtitle && (
                    <p className="mt-3 text-[clamp(10px,1.8vw,18px)] text-slate-400">{slide.subtitle}</p>
                  )}
                  <div className="mt-6 h-1 w-20 bg-blue-500 rounded-full" />
                </div>
              ) : (
                /* Content slide */
                <div className="flex flex-col h-full">
                  <div className="bg-slate-900 px-[6%] py-[3%]">
                    <h2 className="text-[clamp(12px,2.2vw,22px)] font-bold text-white">{slide.title}</h2>
                  </div>
                  <div className="flex-1 px-[6%] py-[4%] overflow-auto">
                    {slide.subtitle && (
                      <p className="text-[clamp(9px,1.3vw,14px)] text-slate-500 italic mb-3">{slide.subtitle}</p>
                    )}
                    {slide.bullets && (
                      <ul className="space-y-2">
                        {slide.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-[clamp(8px,1.2vw,13px)] text-slate-700">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {slide.table && (
                      <div className="mt-3 overflow-auto">
                        <table className="w-full text-[clamp(7px,1vw,11px)] border-collapse">
                          <thead>
                            <tr>
                              {slide.table.headers.map((h, i) => (
                                <th key={i} className="bg-blue-800 text-white px-2 py-1.5 text-left font-medium border border-slate-300">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {slide.table.rows.map((row, ri) => (
                              <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-2 py-1 border border-slate-200">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="px-[6%] py-1 text-right text-[clamp(7px,0.8vw,9px)] text-slate-400">
                    {current + 1}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation arrows */}
        {current > 0 && (
          <button
            onClick={() => setCurrent(c => c - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {current < slides.length - 1 && (
          <button
            onClick={() => setCurrent(c => c + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-secondary/30 border-t border-border">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`shrink-0 w-16 h-9 rounded border text-[6px] flex items-center justify-center overflow-hidden transition ${
              i === current ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-muted-foreground/50'
            } ${i === 0 ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
          >
            <span className="truncate px-1 font-medium">{s.title.slice(0, 20)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
