/**
 * Vercel Serverless Function — GET /api/health
 */

export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'TaskHawk',
    hasApiKey: !!process.env.OPENAI_API_KEY,
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString()
  });
}
