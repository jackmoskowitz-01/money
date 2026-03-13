import { motion } from 'framer-motion';

interface Props {
  lastMessage: string;
  onSelect: (text: string) => void;
  isLoading: boolean;
}

function generateSuggestions(content: string): string[] {
  const suggestions: string[] = [];
  const lower = content.toLowerCase();

  // Email draft detection
  if (lower.includes('subject:') || lower.includes('dear ') || (lower.includes('hi ') && lower.includes('best regards'))) {
    suggestions.push('Make it more concise', 'Adjust the tone to be warmer', 'Add a meeting request');
  }

  // Market data
  if (lower.match(/\$[\d,.]+\/sf/) || lower.includes('vacancy') || lower.includes('absorption')) {
    suggestions.push('Compare to last quarter', 'Which buildings have the best rates?');
  }

  // Deal/prospect/pipeline
  if (lower.match(/stage|pipeline|meeting|prospect|moved/)) {
    suggestions.push('What should I prioritize next?', 'Draft a follow-up email');
  }

  // Task created
  if (content.includes('✅') && lower.includes('task')) {
    suggestions.push('Show all my open tasks', 'What else needs attention this week?');
  }

  // Lease expiration
  if (lower.includes('expir') || lower.includes('lease')) {
    suggestions.push('Draft renewal outreach', 'Show all expiring leases');
  }

  // Search results / market intel
  if (lower.includes('source') || lower.includes('citation') || lower.includes('according to')) {
    suggestions.push('Dig deeper into this', 'How does this affect my pipeline?');
  }

  // Default fallbacks
  if (suggestions.length === 0) {
    suggestions.push('Tell me more', 'What should I do next?', 'Summarize my pipeline');
  }

  // Deduplicate and limit
  return [...new Set(suggestions)].slice(0, 3);
}

export default function CopilotFollowUps({ lastMessage, onSelect, isLoading }: Props) {
  if (isLoading || !lastMessage) return null;

  const suggestions = generateSuggestions(lastMessage);

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
      {suggestions.map((s, i) => (
        <motion.button
          key={s}
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.1, type: 'spring', damping: 20 }}
          onClick={() => onSelect(s)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors"
        >
          {s}
        </motion.button>
      ))}
    </div>
  );
}
