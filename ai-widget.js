
(function(){
  const css = `
  /* Floating button */
  #aiWidgetBtn{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:30px;background:linear-gradient(135deg,#0b5cff,#6b8cff);color:white;border:none;box-shadow:0 12px 30px rgba(11,92,255,0.28);cursor:pointer;z-index:99999;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;transition:transform .18s ease,box-shadow .18s ease}
  #aiWidgetBtn:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(11,92,255,0.34)}

  /* Panel */
  #aiWidgetPanel{position:fixed;right:20px;bottom:96px;width:380px;max-height:72vh;border-radius:12px;background:linear-gradient(180deg,#ffffff,#fbfdff);box-shadow:0 20px 50px rgba(7,34,77,0.18);z-index:99998;display:none;overflow:hidden;display:flex;flex-direction:column;transform-origin:bottom right;animation:panelEnter .28s ease both}
  @keyframes panelEnter{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
  #aiWidgetHeader{background:linear-gradient(90deg,#0b5cff,#6b8cff);color:white;padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:space-between}
  #aiWidgetHeader .title{display:flex;gap:8px;align-items:center}
  #aiWidgetHeader .dot{width:10px;height:10px;border-radius:6px;background:rgba(255,255,255,0.18);display:inline-block}

  #aiWidgetMessages{padding:12px;overflow:auto;flex:1;font-size:14px;background:linear-gradient(180deg,transparent,rgba(250,250,255,0.6));}
  .ai-msg{margin-bottom:12px;opacity:0;transform:translateY(6px);animation:msgEnter .22s ease forwards}
  @keyframes msgEnter{to{opacity:1;transform:none}}
  .ai-msg.user{text-align:right}
  .ai-msg .bubble{display:inline-block;padding:10px 12px;border-radius:12px;max-width:80%;line-height:1.3}
  .ai-msg.user .bubble{background:linear-gradient(90deg,#0b5cff,#6b8cff);color:#fff}
  .ai-msg.bot .bubble{background:#f6f9ff;color:#04283a;border:1px solid rgba(11,92,255,0.06)}

  /* Suggested chips */
  #aiSuggestions{display:flex;gap:8px;flex-wrap:wrap;padding:8px 12px}
  .ai-chip{background:#eef6ff;padding:6px 10px;border-radius:999px;color:#0b5cff;cursor:pointer;border:1px solid rgba(11,92,255,0.06);font-size:13px;transition:transform .12s ease}
  .ai-chip:hover{transform:translateY(-3px)}

  /* Input */
  #aiWidgetInput{display:flex;border-top:1px solid rgba(7,34,77,0.06);padding:8px}
  #aiWidgetInput input{flex:1;padding:10px;border-radius:8px;border:1px solid rgba(7,34,77,0.06);outline:none}
  #aiWidgetInput button{background:linear-gradient(90deg,#0b5cff,#6b8cff);color:#fff;border:0;padding:8px 14px;margin-left:8px;border-radius:8px;cursor:pointer}

  /* Typing indicator */
  .typing{display:inline-block;padding:8px 12px;border-radius:12px;background:#f1f5ff}
  .typing .dot{width:6px;height:6px;background:#6b8cff;border-radius:6px;display:inline-block;margin:0 2px;opacity:0;animation:blink 1s infinite}
  .typing .dot:nth-child(2){animation-delay:.15s}
  .typing .dot:nth-child(3){animation-delay:.3s}
  @keyframes blink{0%{opacity:0.2}50%{opacity:1}100%{opacity:0.2}}

  #aiKeyRow{padding:10px;border-top:1px solid rgba(7,34,77,0.04);font-size:13px}
  #aiKeyRow input{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(7,34,77,0.06)}
  .fade-out{opacity:0!important;transform:translateY(-8px)!important;transition:opacity .28s ease,transform .28s ease}
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
  // suggestions container (insert after messages)
  const suggestionsContainer = document.createElement('div'); suggestionsContainer.id = 'aiSuggestions'; panel.insertBefore(suggestionsContainer, panel.querySelector('#aiKeyRow'));

  const suggestedQuestions = [
    'Comment ajouter un membre ?',
    'Comment exporter les données en CSV ?',
    'Comment partager un membre en lecture seule ?',
    'Comment réinitialiser mon mot de passe ?',
    'Comment héberger l\'application sur GitHub Pages ?'
  ];
  function renderSuggestions(){ suggestionsContainer.innerHTML = ''; suggestedQuestions.forEach(q=>{ const c = document.createElement('div'); c.className='ai-chip'; c.innerText = q; c.addEventListener('click', ()=>{ input.value = q; send.click(); }); suggestionsContainer.appendChild(c); }); }

  // load saved key if any (localStorage)
  try{ const saved = localStorage.getItem('openai_key'); if(saved) { keyInput.value = saved; modeEl.innerText='(openai)'; } }catch(e){}

  function appendMessage(text, who='bot', opts){ const d = document.createElement('div'); d.className='ai-msg '+(who==='user'?'user':'bot'); const bubble = document.createElement('span'); bubble.className='bubble'; if(opts && opts.html) bubble.innerHTML = text; else bubble.innerText = text; d.appendChild(bubble); messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight; }

  // Local knowledge: only answer questions about this site/app.
  function localAnswer(q){
    const raw = String(q||'').trim();
    if(!raw) return "Dis-moi ce que tu veux faire (ex: ajouter un membre, exporter CSV, créer un compte).";
    const ql = raw.toLowerCase();
    // keywords relating to the app
    const siteKeywords = ['membre','export','csv','partager','mot de passe','réinitial','héberg','github','page','dashboard','cotisation','mensuelle','mensual','setup','installer','import','exporter','compte','login','connexion','déconnexion','catalogue'];
    const matches = siteKeywords.some(k => ql.includes(k));
    if(!matches){
      // refuse and suggest
      const msg = `Désolé — je ne réponds qu'aux questions concernant cette application. Voici quelques suggestions :`;
      appendMessage(msg,'bot');
      renderSuggestions();
      return null; // indicate off-topic so caller can avoid duplicating message
    }
    // Helpful targeted answers
    if(ql.includes('ajout')||ql.includes('ajouter')||ql.includes('nouveau')) return "Pour ajouter un membre : allez sur Tableau de bord → 'Ajouter un membre'. Remplissez le nom, montant initial (optionnel) et la cotisation mensuelle, puis cliquez 'Ajouter'. Si le serveur est activé, le membre sera sauvegardé côté serveur, sinon il restera en localStorage.";
    if(ql.includes('export')) return "Utilisez le bouton 'Exporter CSV' pour télécharger les données. Le fichier contient le total, la cotisation mensuelle, ce qui a été payé ce mois et le restant. Le CSV est compatible Excel (BOM + CRLF).";
    if(ql.includes('partag')) return "Pour partager un membre en lecture seule : cliquez sur 'Partager' dans la ligne du membre. Un lien sera copié dans votre presse-papiers pointant vers la page publique de visualisation (view.html?token=...).";
    if(ql.includes('mot de passe')||ql.includes('réinitial')||ql.includes('reset')) return "La réinitialisation de mot de passe est simulée : demandez un code et saisissez-le, puis définissez un nouveau mot de passe. En production, il faut implémenter l'envoi d'e-mails côté serveur.";
    if(ql.includes('héberg')||ql.includes('github')) return "Sur GitHub Pages, l'application frontend fonctionne en static-only (les données sont stockées en localStorage). Le serveur Node (`server.js`) ne tourne pas sur GitHub Pages — pour la persistance côté serveur déployez `server.js` sur Render/Heroku/Fly et configurez le proxy pour l'AI si besoin.";
    if(ql.includes('catalogue')||ql.includes('aide')) return "La page 'Catalogue' contient le guide rapide et les informations du créateur; vous pouvez y accéder depuis le menu principal.";
    // fallback helpful answer
    return "Je peux aider à utiliser l'application (ajout, export, partage, paramètres, hébergement). Tapez une question précise ou sélectionnez une suggestion ci-dessus.";
  }

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
    // Build a strict system prompt so the model only answers about this site
    const system = {
      role: 'system',
      content: 'You are a focused assistant for the "Cotisation" web app. ONLY answer questions that are explicitly about this web application, its UI, how to use features, import/export, deployment, and this repository. If a user asks something unrelated, reply briefly in French: "Désolé — je ne réponds qu\'aux questions concernant cette application. Voici quelques suggestions : [list suggestions]" and DO NOT provide external or unrelated advice. Keep answers concise and in French.'
    };
    const body = { model: 'gpt-3.5-turbo', messages:[system, {role:'user',content:prompt}], max_tokens:400 };
    const res = await fetch('https://api.openai.com/v1/chat/completions',{ method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+key }, body: JSON.stringify(body) });
    if(!res.ok){ const txt = await res.text(); throw new Error('OpenAI error '+res.status+': '+txt); }
    const j = await res.json(); return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || JSON.stringify(j);
  }

  btn.addEventListener('click', ()=>{ panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; input.focus(); });

  keyInput.addEventListener('change', ()=>{ try{ if(keyInput.value.trim()) localStorage.setItem('openai_key', keyInput.value.trim()); else localStorage.removeItem('openai_key'); }catch(e){} modeEl.innerText = keyInput.value.trim() ? '(openai)' : '(local)'; });

  // initial render of suggestions
  renderSuggestions();

  send.addEventListener('click', async ()=>{ const text = input.value.trim(); if(!text) return; 
      // create user message element so we can remove it later
      const userEl = document.createElement('div'); userEl.className = 'ai-msg user'; const userBubble = document.createElement('span'); userBubble.className='bubble'; userBubble.innerText = text; userEl.appendChild(userBubble); messagesEl.appendChild(userEl); messagesEl.scrollTop = messagesEl.scrollHeight;
      input.value='';
      try{
      // First try local responder which only answers site-related questions
      const local = localAnswer(text);
      if(local === null){ // off-topic: localAnswer already rendered suggestions
        // remove the last user question visually
        try{ userEl.classList.add('fade-out'); setTimeout(()=> userEl.remove(), 320); }catch(e){}
        return;
      }
      if(local && keyInput.value.trim() === ''){
        appendMessage(local,'bot');
        try{ userEl.classList.add('fade-out'); setTimeout(()=> userEl.remove(), 320); }catch(e){}
        return;
      }
      // If OpenAI/proxy is configured, show typing indicator and call remote
      const typing = document.createElement('div'); typing.className='ai-msg bot'; const tspan = document.createElement('span'); tspan.className='bubble typing'; tspan.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; typing.appendChild(tspan); messagesEl.appendChild(typing); messagesEl.scrollTop = messagesEl.scrollHeight;
      try{
        const answer = await callOpenAI(text);
        typing.remove();
        appendMessage(answer,'bot');
        // remove the user's question after responding
        try{ userEl.classList.add('fade-out'); setTimeout(()=> userEl.remove(), 320); }catch(e){}
      }catch(err){ typing.remove(); appendMessage('Erreur: '+err.message,'bot'); try{ userEl.classList.add('fade-out'); setTimeout(()=> userEl.remove(), 320); }catch(e){} }
    }catch(e){ appendMessage('Erreur interne: '+e.message,'bot'); try{ userEl.classList.add('fade-out'); setTimeout(()=> userEl.remove(), 320); }catch(ex){} } });

  // keyboard enter
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); send.click(); } });

  // helper: brief welcome
  appendMessage("Bonjour — je peux aider à utiliser l'app. Posez une question ou collez une clé OpenAI pour activer le mode cloud.", 'bot');
})();
