/**
 * Parse an SSE (Server-Sent Events) stream from an LLM API response.
 * Extracts delta content chunks from the stream and calls onChunk for each.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (content: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }

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
        if (jsonStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch { /* partial JSON, skip */ }
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    throw e;
  }
}
