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

  res.write(`data: ${JSON.stringify({ status: 'connected', query })}\n\n`);

  try {
    const { response, modelUsed } = await callGeminiWithFallback({
      contents: [{ parts: [{ text: query }] }],
      stream: true,
    });

    res.write(`data: ${JSON.stringify({ status: 'model_selected', modelUsed })}\n\n`);

    let buffer = '';

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();

      // Split on blank lines (SSE event boundaries)
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const eventString of events) {
        if (!eventString.trim()) continue;

        for (const line of eventString.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;

          const rawData = line.replace(/^data:\s*/, '');
          if (rawData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(rawData);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          } catch {
            // ignore partial JSON — next chunk will complete it
          }
        }
      }
    });

    response.data.on('end', () => {
      res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
      res.end();
    });

    response.data.on('error', (err: Error) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    });

    // Clean up stream if client disconnects
    req.on('close', () => response.data.destroy?.());
  } catch (error: any) {
    const status = error.response?.status;
    const errorMsg =
      status === 503
        ? 'Gemini API is overloaded. Please try again in a moment.'
        : error.response?.data?.error?.message ?? error.message;

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: errorMsg, status })}\n\n`);
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
