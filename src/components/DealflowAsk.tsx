import { useState, useRef } from 'react';
import { useAskDealflow } from '@/hooks/useAskDealflow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, RotateCcw, Zap } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Where are we with our active deals?',
  'Which deals are in the touring stage?',
  'What deals have we not touched recently?',
  'Summarize recent activity across all prospects',
];

export function DealflowAsk() {
  const [question, setQuestion] = useState('');
  const { ask, answer, sources, loading, error, reset } = useAskDealflow();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (q?: string) => {
    const finalQuestion = q ?? question;
    if (!finalQuestion.trim() || loading) return;
    await ask(finalQuestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (q: string) => {
    setQuestion(q);
    handleSubmit(q);
  };

  const handleReset = () => {
    setQuestion('');
    reset();
    inputRef.current?.focus();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Ask Dealflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your deals..."
            disabled={loading}
            className="text-sm"
          />
          <Button
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            size="icon"
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Suggested questions */}
        {!answer && !loading && !error && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => handleSuggestion(q)}
                className="px-2.5 py-1 text-xs rounded-full border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Searching your deals...</span>
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="space-y-2">
            <div className="bg-secondary/30 border border-border/50 rounded-lg p-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
            {sources.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Sources:</span>
                {sources.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {s.type} ({Math.round(s.similarity * 100)}%)
                  </Badge>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs h-7">
              <RotateCcw className="h-3 w-3 mr-1" />
              Ask another question
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <span className="text-xs text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs h-7 text-destructive">
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
