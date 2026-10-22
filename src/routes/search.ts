// ─────────────────────────────────────────────
//  src/routes/search.ts
//  Only route definitions — clean and readable
// ─────────────────────────────────────────────

const express = require('express');
import { callGeminiWithFallback } from '../services/gemini.service';

const searchRouter = express.Router();

/**
 * GET /api/search?q=Your+Prompt
 * Streams the Gemini response as Server-Sent Events (SSE)
 */
searchRouter.get('/search', async (req: any, res: any) => {
  const query = (req.query.q as string) || 'Tell me an interesting fact in 2 lines!';

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
 let isClientDisconnected = false;
  let activeStream: any = null;

  // Track client disconnection and clean up resources
  req.on('close', () => {
    isClientDisconnected = true;
    if (activeStream) {
      activeStream.destroy?.();
    }
  });

  const sendEvent = (payload: object) => {
    if (!isClientDisconnected && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  sendEvent({ status: 'connected', query });

  try {
    const { response, modelUsed } = await callGeminiWithFallback({
      contents: [{ parts: [{ text: query }] }],
      stream: true,
    });

    if (isClientDisconnected) {
      response.data?.destroy?.();
      return;
    }

    activeStream = response.data;
    sendEvent({ status: 'model_selected', modelUsed });

    let buffer = '';
    let accumulatedText = '';
    let normalCompleted = false;

    response.data.on('data', (chunk: Buffer) => {
      if (isClientDisconnected) return;

      buffer += chunk.toString();

      // Split on blank lines (SSE event boundaries)
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const eventString of events) {
        if (!eventString.trim()) continue;

        for (const line of eventString.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;

          const rawData = line.replace(/^data:\s*/, '');
          if (rawData === '[DONE]') {
            normalCompleted = true;
            continue;
          }

          try {
            const parsed = JSON.parse(rawData);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              accumulatedText += textChunk;
              sendEvent({ text: textChunk });
            }
          } catch {
            // ignore partial JSON — next chunk will complete it
          }
        }
      }
    });

    response.data.on('end', () => {
      if (isClientDisconnected || res.writableEnded) return;

      if (normalCompleted) {
        sendEvent({
          status: 'completed',
          terminationReason: 'normal',
          fullText: accumulatedText,
        });
      } else {
        // Stream ended without [DONE] signal
        sendEvent({
          status: 'terminated',
          terminationReason: 'unexpected_stream_end',
          fullText: accumulatedText,
          warning: 'Stream closed before receiving completion signal.',
        });
      }
      res.end();
    });

    response.data.on('error', async (err: Error) => {
      if (isClientDisconnected || res.writableEnded) return;

      // Stream midway fail hua — recovery attempt (using fallback models)
      sendEvent({
        status: 'recovering',
        message: 'Mid-stream disruption detected. Attempting recovery with fallback model...',
        error: err.message,
      });

      try {
        // Recovery prompt includes already accumulated text context so far
        const continuationPrompt = accumulatedText
          ? `${query}\n\n[System note: Output previously cut off at: "${accumulatedText.slice(-200)}". Continue seamlessly without repeating earlier output.]`
          : query;

        const recoveryResult = await callGeminiWithFallback({
          contents: [{ parts: [{ text: continuationPrompt }] }],
          stream: true,
        });

        if (isClientDisconnected || res.writableEnded) {
          recoveryResult.response.data?.destroy?.();
          return;
        }

        activeStream = recoveryResult.response.data;
        sendEvent({
          status: 'recovered',
          modelUsed: recoveryResult.modelUsed,
        });

        let recoveryBuffer = '';
        let recoveryNormalCompleted = false;

        recoveryResult.response.data.on('data', (chunk: Buffer) => {
          if (isClientDisconnected) return;

          recoveryBuffer += chunk.toString();
          const events = recoveryBuffer.split(/\r?\n\r?\n/);
          recoveryBuffer = events.pop() ?? '';

          for (const eventString of events) {
            if (!eventString.trim()) continue;

            for (const line of eventString.split(/\r?\n/)) {
              if (!line.startsWith('data:')) continue;

              const rawData = line.replace(/^data:\s*/, '');
              if (rawData === '[DONE]') {
                recoveryNormalCompleted = true;
                continue;
              }

              try {
                const parsed = JSON.parse(rawData);
                const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  accumulatedText += textChunk;
                  sendEvent({ text: textChunk });
                }
              } catch {
                // ignore partial JSON
              }
            }
          }
        });

        recoveryResult.response.data.on('end', () => {
          if (isClientDisconnected || res.writableEnded) return;

          sendEvent({
            status: recoveryNormalCompleted ? 'completed' : 'terminated',
            terminationReason: recoveryNormalCompleted ? 'normal_after_recovery' : 'unexpected_stream_end',
            fullText: accumulatedText,
          });
          res.end();
        });

        recoveryResult.response.data.on('error', (recoveryErr: Error) => {
          if (isClientDisconnected || res.writableEnded) return;

          sendEvent({
            status: 'terminated',
            terminationReason: 'unexpected_error',
            error: recoveryErr.message,
            fullText: accumulatedText,
          });
          res.end();
        });
      } catch (recoveryErr: any) {
        if (!isClientDisconnected && !res.writableEnded) {
          sendEvent({
            status: 'terminated',
            terminationReason: 'unexpected_error',
            error: recoveryErr.message || err.message,
            fullText: accumulatedText,
          });
          res.end();
        }
      }
    });
  } catch (error: any) {
    const status = error.response?.status;
    const errorMsg =
      status === 503
        ? 'Gemini API is overloaded. Please try again in a moment.'
        : error.response?.data?.error?.message ?? error.message;

    if (!isClientDisconnected && !res.writableEnded) {
      sendEvent({
        status: 'terminated',
        terminationReason: 'connection_failed',
        error: errorMsg,
        httpStatus: status,
      });
      res.end();
    }
  }
});

/**
 * POST /api/search
 * Body: { contents: [{ parts: [{ text: "..." }] }] }
 * Returns full JSON response from Gemini
 */
searchRouter.post('/search', async (req: any, res: any) => {
  try {
    const { response, modelUsed } = await callGeminiWithFallback({
      contents: req.body?.contents ?? [{ parts: [{ text: 'Hello' }] }],
      stream: false,
    });

    return res.status(200).json({ modelUsed, ...response.data });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data ?? { message: error.message };
    return res.status(status).json(errorData);
  }
});

/**
 * GET /api/search/open
 * Redirects directly to the Gemini web app
 */
searchRouter.get('/search/open', (_req: any, res: any) => {
  res.redirect('https://gemini.google.com/app');
});

module.exports = searchRouter;
