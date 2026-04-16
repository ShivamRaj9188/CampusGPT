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
   * @param onToken   Callback called with each streamed token
   * @param onDone    Callback called when streaming is complete
   * @param onError   Callback called with an error message if streaming fails
   * @returns AbortController — call .abort() to cancel the stream
   */
  stream: (
    question: string,
    mode: ChatMode,
    onToken: (token: string) => void,
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
          body: JSON.stringify({ question, mode }),
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
                onError(content.replace('[ERROR] ', ''));
                return;
              } else if (content) {
                onToken(content);
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
};
