// Vercel serverless function: server-side LLM call. The API key never reaches the browser.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  const prompt = typeof req.body === 'string' ? JSON.parse(req.body || '{}').prompt : req.body && req.body.prompt;
  if (!prompt || prompt.length > 200000) return res.status(400).json({ error: 'Invalid prompt.' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'Upstream error' });
    res.status(200).json({ text: (j.content || []).map(c => c.text || '').join('') });
  } catch (e) {
    res.status(502).json({ error: 'Upstream request failed.' });
  }
};
