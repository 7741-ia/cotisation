// Minimal OpenAI proxy server
// Usage:
//   export OPENAI_API_KEY="sk-..."
//   node openai-proxy.js
// The server exposes POST /openai-proxy with body { prompt, model?, max_tokens? }
// and returns { text: '...' }

const express = require('express');
const app = express();
const port = process.env.PORT || 4000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if(!OPENAI_KEY){
  console.warn('WARNING: OPENAI_API_KEY not set. Proxy will return 500 for requests.');
}

app.use(express.json());
app.use(function(req,res,next){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); if(req.method==='OPTIONS') return res.sendStatus(200); next(); });

app.post('/openai-proxy', async (req, res) => {
  try{
    if(!OPENAI_KEY) return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY not set' });
    const { prompt, model='gpt-3.5-turbo', max_tokens=400 } = req.body || {};
    if(!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens })
    });
    if(!resp.ok){ const txt = await resp.text(); return res.status(502).json({ error: 'OpenAI error', detail: txt }); }
    const j = await resp.json();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return res.json({ text: text || JSON.stringify(j) });
  }catch(err){ console.error(err); return res.status(500).json({ error: String(err) }); }
});

app.get('/', (req,res)=> res.send('OpenAI proxy OK'));

app.listen(port, ()=> console.log(`OpenAI proxy listening on ${port} (proxy endpoint: /openai-proxy)`));
