const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data.json');

function hashPassword(password){
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return {salt, hash};
}

function verifyPassword(password, salt, hash){
  try{
    const h = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h,'hex'), Buffer.from(hash,'hex'));
  }catch(e){ return false; }
}

function readData(){
  try{
    const d = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
    // migrate adminAccounts if stored in plain password field
    if(Array.isArray(d.adminAccounts)){
      let migrated = false;
      d.adminAccounts = d.adminAccounts.map(a=>{
        if(a && a.password && !(a.salt && a.hash)){
          const {salt, hash} = hashPassword(String(a.password));
          migrated = true;
          return {id: a.id || Date.now(), salt, hash};
        }
        return a;
      });
      if(migrated) writeData(d);
    }
    return d;
  }catch(e){
    // default structure
    const def = {adminAccounts:[{id:Date.now(), ...hashPassword('bestking')}], members:[]};
    writeData(def);
    return def;
  }
}

function writeData(d){ fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8'); }

function sendJSON(res, obj, code=200){ res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); }

function serveStatic(req, res, pathname){
  if(pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, pathname);
  fs.readFile(filePath, (err, data) =>{
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const map = {'.html':'text/html','.js':'application/javascript','.css':'text/css', '.json':'application/json', '.csv':'text/csv'};
    res.writeHead(200, {'Content-Type': map[ext] || 'application/octet-stream'});
    res.end(data);
  });
}

const server = http.createServer((req, res) =>{
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if(pathname.startsWith('/api')){
    // simple API
    if(pathname === '/api/ping'){ sendJSON(res, {ok:true}); return; }

    if(pathname === '/api/members' && req.method === 'GET'){
      const d = readData(); sendJSON(res, {members: d.members}); return;
    }

    // /api/meta removed (About/Contact feature removed)

    if(pathname === '/api/login' && req.method === 'POST'){
      let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
        try{
          const j = JSON.parse(body);
          const d = readData();
          const ok = Array.isArray(d.adminAccounts) && d.adminAccounts.some(a=> a.salt && a.hash && verifyPassword(j.password, a.salt, a.hash));
          if(ok) sendJSON(res,{ok:true}); else sendJSON(res,{ok:false});
        }catch(e){ sendJSON(res,{ok:false},400); }
      }); return;
    }

    if(pathname === '/api/members' && req.method === 'POST'){
      let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
        try{ 
          const j = JSON.parse(body);
          const d = readData(); 
          const id = Date.now();
          // Support new member schema (payments, monthlyAmount, createdBy). Keep backward compatibility with legacy "amount".
          const payments = Array.isArray(j.payments) ? j.payments : ((j.amount || j.initialAmount) ? [{ id: Date.now(), amount: Number(j.amount||j.initialAmount)||0, date: new Date().toISOString(), by: j.createdBy || null }] : []);
          const m = { id, name: j.name || '', payments: payments, monthlyAmount: Number(j.monthlyAmount)||0, createdBy: j.createdBy || null };
          d.members.push(m); writeData(d); sendJSON(res,{ok:true, member:m}); 
        }catch(e){ sendJSON(res,{ok:false},400); }
      }); return;
    }

    // member specific routes: /api/members/:id
    const mMatch = pathname.match(/^\/api\/members\/(\d+)(?:\/amount)?$/);
    if(mMatch){
      const id = Number(mMatch[1]);
      if(req.method === 'DELETE'){
        const d = readData(); d.members = d.members.filter(x=> x.id !== id); writeData(d); sendJSON(res,{ok:true}); return;
      }

      if(pathname.endsWith('/amount') && req.method === 'POST'){
        let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
          try{ const j = JSON.parse(body); const d = readData(); const mem = d.members.find(x=> x.id === id); if(mem){ mem.amount = (Number(mem.amount)||0) + Number(j.delta||0); writeData(d); sendJSON(res,{ok:true}); } else sendJSON(res,{ok:false},404);
          }catch(e){ sendJSON(res,{ok:false},400); }
        }); return;
      }

      if(req.method === 'PUT'){
        let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
          try{ 
            const j = JSON.parse(body); const d = readData(); const mem = d.members.find(x=> x.id === id);
            if(mem){
              if(j.name!==undefined) mem.name = j.name;
              // legacy: replace with a single payment
              if(j.amount!==undefined){ mem.payments = [{ id: Date.now(), amount: Number(j.amount)||0, date: new Date().toISOString(), by: j.modifiedBy || null }]; }
              if(j.monthlyAmount!==undefined) mem.monthlyAmount = Number(j.monthlyAmount)||0;
              if(Array.isArray(j.payments)) mem.payments = j.payments;
              if(j.createdBy!==undefined) mem.createdBy = j.createdBy;
              writeData(d); sendJSON(res,{ok:true});
            } else sendJSON(res,{ok:false},404);
          }catch(e){ sendJSON(res,{ok:false},400); }
        }); return;
      }
    }

    if(pathname === '/api/import' && req.method === 'POST'){
      let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
        try{ 
          const j = JSON.parse(body); const d = readData();
          const toAdd = (j.members||[]).map((m,i)=>{
            const id = Date.now()+i;
            const payments = Array.isArray(m.payments) ? m.payments : ((m.amount||m.initialAmount) ? [{ id: Date.now()+i, amount: Number(m.amount||m.initialAmount)||0, date: new Date().toISOString(), by: m.createdBy || null }] : []);
            return { id, name: m.name||'', payments: payments, monthlyAmount: Number(m.monthlyAmount)||0, createdBy: m.createdBy || null };
          });
          d.members = d.members.concat(toAdd); writeData(d); sendJSON(res,{ok:true});
        }catch(e){ sendJSON(res,{ok:false},400); }
      }); return;
    }

    if(pathname === '/api/admins' && req.method === 'POST'){
      // create new admin - requires creatorPassword in body for auth
      let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
        try{
          const j = JSON.parse(body);
          const d = readData();
          if(!j.creatorPassword) { sendJSON(res,{ok:false, msg:'creatorPassword required'}, 401); return; }
          const ok = Array.isArray(d.adminAccounts) && d.adminAccounts.some(a=> a.salt && a.hash && verifyPassword(j.creatorPassword, a.salt, a.hash));
          if(!ok){ sendJSON(res,{ok:false, msg:'Unauthorized'}, 403); return; }
          const id = Date.now(); const {salt, hash} = hashPassword(String(j.password));
          d.adminAccounts = d.adminAccounts || []; d.adminAccounts.push({id, salt, hash}); writeData(d); sendJSON(res,{ok:true, id});
        }catch(e){ sendJSON(res,{ok:false},400); }
      }); return;
    }

    if(pathname === '/api/admins' && req.method === 'GET'){
      // list admin ids - requires header x-admin-pass
      const pass = req.headers['x-admin-pass'];
      const d = readData();
      if(!pass || !Array.isArray(d.adminAccounts) || !d.adminAccounts.some(a=> a.salt && a.hash && verifyPassword(pass, a.salt, a.hash))){ sendJSON(res,{ok:false, msg:'Unauthorized'},403); return; }
      const list = (d.adminAccounts||[]).map(a=>({id:a.id})); sendJSON(res,{admins:list}); return;
    }

    // delete admin
    const adminDelMatch = pathname.match(/^\/api\/admins\/(\d+)$/);
    if(adminDelMatch && req.method === 'DELETE'){
      const id = Number(adminDelMatch[1]);
      let body=''; req.on('data', c=> body+=c); req.on('end', ()=>{
        try{
          const j = body ? JSON.parse(body) : {};
          const creatorPass = j.creatorPassword || req.headers['x-admin-pass'];
          const d = readData();
          if(!creatorPass || !Array.isArray(d.adminAccounts) || !d.adminAccounts.some(a=> a.salt && a.hash && verifyPassword(creatorPass, a.salt, a.hash))){ sendJSON(res,{ok:false, msg:'Unauthorized'},403); return; }
          d.adminAccounts = (d.adminAccounts||[]).filter(a=> a.id !== id);
          writeData(d); sendJSON(res,{ok:true});
        }catch(e){ sendJSON(res,{ok:false},400); }
      }); return;
    }

    // /api/meta PUT removed

    if(pathname === '/api/export' && req.method === 'GET'){
      const d = readData();
      const rows = [];
      rows.push('Nom,Montant total,Mensuelle');
      d.members.forEach(m=>{
        const payments = Array.isArray(m.payments) ? m.payments : (m.amount ? [{amount: m.amount}] : []);
        const total = payments.reduce((s,p)=> s + (Number(p.amount)||0), 0);
        rows.push(`"${String(m.name).replace(/"/g,'""')}",${total},${m.monthlyAmount||0}`);
      });
      res.writeHead(200, {'Content-Type':'text/csv','Content-Disposition':'attachment; filename="cotisations.csv"'});
      res.end(rows.join('\n'));
      return;
    }

    sendJSON(res, {ok:false, msg:'Not Found'}, 404); return;
  }

  // static
  serveStatic(req, res, pathname);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`Server started on http://localhost:${PORT}`));
