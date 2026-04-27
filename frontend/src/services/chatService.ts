import { ChatMode } from '../types';

/**
 * chatService handles the streaming chat API.
 *
 * Since the /api/chat endpoint uses SSE (text/event-stream) over POST,
 * we cannot use EventSource (which only supports GET).
 * Instead we use the native fetch API with ReadableStream.
 *
 * SSE event format from backend:
 *   data:token\n\n   (each token)
 *   data:[DONE]\n\n  (stream complete)
 *   data:[ERROR]...\n\n (error signal)
 */
export const chatService = {

  /**
   * Streams a chat response from the backend, calling onToken for each
   * received token and onDone when the stream completes.
   *
   * @param question  The user's question
   * @param mode      The smart mode (EXPLAIN_CONCEPT | TEN_MARK | SHORT_NOTES)
   * @param history   Recent chat history to pass for multi-turn context
   * @param onToken   Callback called with each streamed token
   * @param onDone    Callback called when streaming is complete
   * @param onError   Callback called with an error message if streaming fails
   * @param onMetrics Callback called when pipeline metrics are received
   * @returns AbortController — call .abort() to cancel the stream
   */
  stream: (
    question: string,
    mode: ChatMode,
    history: { role: string; content: string }[],
    sessionId: string,
    onToken: (token: string) => void,
    onMetrics: (metrics: any) => void,
    onDone: () => void,
    onError: (message: string) => void
  ): AbortController => {
    const controller = new AbortController();
    const token = localStorage.getItem('campusgpt_token');

    (async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ question, mode, history, sessionId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          onError(`Server error ${response.status}: ${errorText}`);
          return;
        }

        if (!response.body) {
          onError('No response body from server');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Read chunks from the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode bytes to string (keep previous incomplete lines in buffer)
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines (split by \n)
          const lines = buffer.split('\n');
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            // SSE format: "data:content" (Spring's SseEmitter omits the space)
            if (line.startsWith('data:')) {
              const content = line.slice(5); // Remove "data:" prefix

              if (content === '[DONE]') {
                onDone();
                return;
              } else if (content.startsWith('[ERROR]')) {
                onError(content.replace('[ERROR]', '').trim());
                return;
              } else if (content.startsWith('[METRICS]')) {
                try {
                  const m = JSON.parse(content.replace('[METRICS]', '').trim());
                  onMetrics(m);
                } catch (e) {
                  console.error('Failed to parse metrics', e);
                }
              } else if (content) {
                // Decode newline placeholders safely 
                onToken(content.replace(/\[NEW\]/g, '\n'));
              }
            }
          }
        }

        onDone(); // Stream ended without explicit [DONE]

      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // User cancelled
        onError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    })();

    return controller;
  },

  /**
   * Fetches persistent chat history for the user.
   */
  getHistory: async (): Promise<{ role: string; content: string; createdAt: string; sessionId: string }[]> => {
    const token = localStorage.getItem('campusgpt_token');
    const response = await fetch('/api/chat/history', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  },

  /**
   * Deletes all chat history for the user.
   */
  clearHistory: async (): Promise<void> => {
    const token = localStorage.getItem('campusgpt_token');
    const response = await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to clear history');
  },

  /**
   * Deletes a specific chat session for the user.
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    const token = localStorage.getItem('campusgpt_token');
    const response = await fetch(`/api/chat/history/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete session');
  },
};
