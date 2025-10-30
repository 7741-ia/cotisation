// Simple AI assistant widget.
// - Mode "local" : small rule-based assistant (works offline, safe for GitHub Pages)
// - Mode "openai": forwards user messages to OpenAI ChatCompletions using a user-provided key
// The user must enter their OpenAI API key at runtime if they want to use the cloud mode.

(function(){
  const css = `
  #aiWidgetBtn{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:28px;background:#0b5cff;color:white;border:none;box-shadow:0 6px 18px rgba(11,92,255,0.24);cursor:pointer;z-index:9999}
  #aiWidgetPanel{position:fixed;right:18px;bottom:86px;width:360px;max-height:70vh;border-radius:8px;background:white;box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:9999;display:none;overflow:hidden;display:flex;flex-direction:column}
  #aiWidgetHeader{background:#0b5cff;color:white;padding:10px;font-weight:600}
  #aiWidgetMessages{padding:10px;overflow:auto;flex:1;font-size:13px}
  #aiWidgetInput{display:flex;border-top:1px solid #eee}
  #aiWidgetInput input{flex:1;padding:8px;border:0}
  #aiWidgetInput button{background:#0b5cff;color:#fff;border:0;padding:8px 12px}
  #aiWidgetMode{font-size:12px;margin-left:8px;color:#fff;opacity:.9}
  .ai-msg{margin-bottom:8px}
  .ai-msg.user{text-align:right}
  .ai-msg .bubble{display:inline-block;padding:8px 10px;border-radius:6px;max-width:80%}
  .ai-msg.user .bubble{background:#0b5cff;color:#fff}
  .ai-msg.bot .bubble{background:#f1f1f1;color:#111}
  #aiKeyRow{padding:8px;border-top:1px solid #eee;font-size:12px}
  #aiKeyRow input{width:100%;padding:6px}
  `;

  const style = document.createElement('style'); style.innerText = css; document.head.appendChild(style);

  const btn = document.createElement('button'); btn.id='aiWidgetBtn'; btn.title='Assistant'; btn.innerText='AI'; document.body.appendChild(btn);

  const panel = document.createElement('div'); panel.id='aiWidgetPanel';
  panel.innerHTML = `
    <div id="aiWidgetHeader">Assistant <span id="aiWidgetMode">(local)</span></div>
    <div id="aiWidgetMessages"></div>
    <div id="aiKeyRow">Mode cloud (OpenAI): collez votre clé API ici (optionnel)<br><input id="aiKeyInput" placeholder="sk-... (optional)" /></div>
    <div id="aiWidgetInput"><input id="aiInput" placeholder="Posez une question sur l'app ou demandez de l'aide" /><button id="aiSend">Envoyer</button></div>
  `;
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#aiWidgetMessages');
  const modeEl = panel.querySelector('#aiWidgetMode');
  const keyInput = panel.querySelector('#aiKeyInput');
  const input = panel.querySelector('#aiInput');
  const send = panel.querySelector('#aiSend');

  // load saved key if any (localStorage)
  try{ const saved = localStorage.getItem('openai_key'); if(saved) { keyInput.value = saved; modeEl.innerText='(openai)'; } }catch(e){}

  function appendMessage(text, who='bot'){ const d = document.createElement('div'); d.className='ai-msg '+(who==='user'?'user':'bot'); const bubble = document.createElement('span'); bubble.className='bubble'; bubble.innerText = text; d.appendChild(bubble); messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight; }

  function localAnswer(q){ q = String(q||'').toLowerCase(); if(!q) return "Dis-moi ce que tu veux faire (ex: ajouter membre, exporter CSV, créer compte)."; if(q.includes('ajout')||q.includes('ajouter')||q.includes('nouveau')) return "Pour ajouter un membre, va sur le tableau de bord et utilise le formulaire 'Ajouter membre'. Si vous utilisez la version serveur, le membre sera sauvegardé dans data.json; en mode statique il est stocké dans localStorage."; if(q.includes('export')) return "Cliquez sur Exporter CSV pour télécharger les données. Si vous hébergez sur GitHub Pages, utilisez l'option locale (les exports sont générés côté client)."; if(q.includes('mot de passe')||q.includes('reset')) return "La réinitialisation de mot de passe est simulée dans l'app locale. En production, remplacez-la par un service d'email sécurisé."; if(q.includes('héberg')||q.includes('github')) return "Sur GitHub Pages l'application peut fonctionner en mode statique, mais le serveur Node (`server.js`) ne fonctionnera pas. Pour garder la persistance côté serveur, déployez le serveur sur Render, Fly or Heroku."; return "Je peux aider sur l'utilisation de l'app et expliquer comment déployer. Pour des réponses plus avancées, collez une clé OpenAI dans le champ 'Mode cloud' (optionnel) et changez le mode en openai." }

  async function callOpenAI(prompt){
    // If a proxy URL is provided via global `window.OPENAI_PROXY_URL`, use it (safer: keeps key on server).
    const proxy = window.OPENAI_PROXY_URL || '';
    if(proxy){
      const res = await fetch(proxy, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt, model: 'gpt-3.5-turbo', max_tokens: 400 }) });
      if(!res.ok){ const txt = await res.text(); throw new Error('Proxy error '+res.status+': '+txt); }
      const j = await res.json(); // expect { text: '...' } or { result: '...' }
      return j.text || j.result || JSON.stringify(j);
    }

    const key = keyInput.value.trim(); if(!key) throw new Error('Clé OpenAI manquante'); // simple Chat Completions v1
    const body = { model: 'gpt-3.5-turbo', messages:[{role:'user',content:prompt}], max_tokens:400 };
    const res = await fetch('https://api.openai.com/v1/chat/completions',{ method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+key }, body: JSON.stringify(body) });
    if(!res.ok){ const txt = await res.text(); throw new Error('OpenAI error '+res.status+': '+txt); }
    const j = await res.json(); return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || JSON.stringify(j);
  }

  btn.addEventListener('click', ()=>{ panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; input.focus(); });

  keyInput.addEventListener('change', ()=>{ try{ if(keyInput.value.trim()) localStorage.setItem('openai_key', keyInput.value.trim()); else localStorage.removeItem('openai_key'); }catch(e){} modeEl.innerText = keyInput.value.trim() ? '(openai)' : '(local)'; });

  send.addEventListener('click', async ()=>{ const text = input.value.trim(); if(!text) return; appendMessage(text,'user'); input.value=''; try{ if(keyInput.value.trim()){ appendMessage('...', 'bot'); const last = messagesEl.querySelectorAll('.ai-msg.bot .bubble'); const placeholder = last[last.length-1]; const answer = await callOpenAI(text); placeholder.innerText = answer; } else { const ans = localAnswer(text); appendMessage(ans,'bot'); } }catch(e){ appendMessage('Erreur: '+e.message,'bot'); } });

  // keyboard enter
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); send.click(); } });

  // helper: brief welcome
  appendMessage("Bonjour — je peux aider à utiliser l'app. Posez une question ou collez une clé OpenAI pour activer le mode cloud.", 'bot');
})();
