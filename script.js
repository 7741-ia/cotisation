// Helper: determine if current session is admin (works for local and API modes)
function isCurrentAdmin(){
  if(useApi){
    // when using API, successful admin login stores currentAdminPass
    return !!currentAdminPass;
  }
  return adminAccounts.some(a => a.password === currentAdminPass);
}

let useApi = false;
let adminAccounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]');
if(!Array.isArray(adminAccounts) || adminAccounts.length === 0){ adminAccounts = [{id: Date.now(), password: 'bestking'}]; localStorage.setItem('adminAccounts', JSON.stringify(adminAccounts)); }
let members = JSON.parse(localStorage.getItem('members') || '[]');
let currentAdminPass = null; // store the password used to log in (kept in memory only)
let startDate = JSON.parse(localStorage.getItem('startDate') || '{"month": 1, "year": 2025}');
let sortOrder = 'name'; // Default sort order

// Users and current user
let users = JSON.parse(localStorage.getItem('users') || '[]');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Global error capture: store the last error in localStorage for easier debugging
window.addEventListener('error', function (event) {
  const info = { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, stack: event.error && event.error.stack };
  try{ localStorage.setItem('lastError', JSON.stringify(info)); }catch(e){}
  console.error('Captured error', info);
});
window.addEventListener('unhandledrejection', function (event) {
  const info = { message: (event.reason && event.reason.message) || String(event.reason), stack: event.reason && event.reason.stack };
  try{ localStorage.setItem('lastError', JSON.stringify(info)); }catch(e){}
  console.error('Captured unhandledrejection', info);
});

function saveUsers(){
  localStorage.setItem('users', JSON.stringify(users));
  if(currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser)); else localStorage.removeItem('currentUser');
}

async function hashPassword(p){
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    // fallback
    return btoa(p);
  }
}

function showApp(){
  // Rediriger vers le tableau de bord
  window.location.href = 'dashboard.html';
}

function showLogin(){
  document.getElementById('loginArea').style.display = 'block';
  document.getElementById('appArea').style.display = 'none';
}

function continueAsGuest(){
  currentUser = {id: null, email: 'invité'};
  saveUsers();
  showApp();
  renderTable();
}

async function createUser(){
  const email = (document.getElementById('userEmail') || {value:''}).value.trim().toLowerCase();
  const pass = (document.getElementById('userPass') || {value:''}).value;
  if(!email || !pass){ alert('Entrez un email et un mot de passe'); return; }
  if(users.some(u=>u.email === email)){ alert('Cet email est déjà utilisé'); return; }
  const h = await hashPassword(pass);
  const u = {id: Date.now(), email, passHash: h};
  users.push(u); saveUsers();
  currentUser = {id: u.id, email: u.email}; saveUsers();
  // Mark as newly created: redirect to setup page for completion
  try{ localStorage.setItem('justCreatedUserId', String(u.id)); }catch(e){}
  // redirect to setup page where user can add members / complete profile
  window.location.href = 'setup.html';
}

async function loginUser(){
  const email = (document.getElementById('userEmail') || {value:''}).value.trim().toLowerCase();
  const pass = (document.getElementById('userPass') || {value:''}).value;
  if(!email || !pass){ alert('Entrez email et mot de passe'); return; }
  const h = await hashPassword(pass);
  const u = users.find(x=> x.email === email && x.passHash === h);
  if(!u){ alert('Email ou mot de passe incorrect'); return; }
  currentUser = {id: u.id, email: u.email}; saveUsers();
  // redirect to setup page on each login so user can complete or add members
  try{ localStorage.setItem('justLoggedIn', String(u.id)); }catch(e){}
  window.location.href = 'setup.html';
}

// Password reset flow (simulated email): Request a reset code (shown to user) and then perform reset
async function requestPasswordReset(){
  const email = prompt('Entrez votre email pour recevoir un code de réinitialisation :');
  if(!email) return;
  const user = users.find(u => u.email === email.trim().toLowerCase());
  if(!user){ alert('Email non trouvé'); return; }
  const code = String(Math.floor(100000 + Math.random()*900000));
  const tokens = JSON.parse(localStorage.getItem('resetTokens') || '{}');
  tokens[user.email] = { code, expires: Date.now() + 15*60*1000 };
  localStorage.setItem('resetTokens', JSON.stringify(tokens));
  // Simulate email by showing the code in an alert — in production you'd send an email
  alert('Code de réinitialisation (simulation) : ' + code + '\nIl est valable 15 minutes.');
  // After requesting, immediately open reset dialog
  await performPasswordReset();
}

async function performPasswordReset(){
  const email = (prompt('Entrez l\'email pour réinitialiser :') || '').trim().toLowerCase();
  if(!email) return;
  const tokens = JSON.parse(localStorage.getItem('resetTokens') || '{}');
  const entry = tokens[email];
  if(!entry || Date.now() > (entry.expires || 0)) { alert('Aucun code valide trouvé pour cet email (ou expiré)'); return; }
  const code = prompt('Entrez le code reçu par email :');
  if(!code || String(code).trim() !== String(entry.code)) { alert('Code invalide'); return; }
  const newPass = prompt('Entrez votre nouveau mot de passe :');
  if(!newPass || newPass.length < 3){ alert('Mot de passe trop court'); return; }
  const h = await hashPassword(newPass);
  const user = users.find(u => u.email === email);
  if(!user){ alert('Utilisateur introuvable'); return; }
  user.passHash = h; saveUsers();
  // cleanup token
  delete tokens[email]; localStorage.setItem('resetTokens', JSON.stringify(tokens));
  alert('Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.');
}

// Improved logout: clear admin session and redirect to index when on dashboard
function logoutUser(){
  currentUser = null; 
  currentAdminPass = null;
  saveUsers();
  // If we're on dashboard, redirect back to index
  if(window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('setup.html')){
    window.location.href = 'index.html';
    return;
  }
  // otherwise show login area
  try{ showLogin(); }catch(e){ /* ignore */ }
}

// Initialize start date on page load
function initializeStartDate() {
  const monthSelect = document.getElementById('startMonth');
  const yearSelect = document.getElementById('startYear');
  if (monthSelect && yearSelect) {
    monthSelect.value = startDate.month;
    yearSelect.value = startDate.year;
  }
}

function saveState(){
  localStorage.setItem('members', JSON.stringify(members));
  localStorage.setItem('adminAccounts', JSON.stringify(adminAccounts));
}

async function tryApi(){
  try{
    const res = await fetch('/api/ping');
    if(res.ok) { useApi = true; await loadFromApi(); }
  }catch(e){ useApi = false; }
}

async function loadFromApi(){
  try{
    const res = await fetch('/api/members');
    if(res.ok){
      const json = await res.json();
      // Adaptation: the server may return members in a legacy format ({id,name,amount}).
      // Convert to client format: ensure `payments` array and `monthlyAmount` exist.
      const raw = json.members || [];
      members = raw.map((m, idx) => {
        // if already in client shape, keep as is
        if(Array.isArray(m.payments) || m.monthlyAmount !== undefined){
          // ensure payments array exists
          m.payments = Array.isArray(m.payments) ? m.payments : [];
          m.monthlyAmount = m.monthlyAmount || 0;
          return m;
        }
        // legacy: m.amount -> convert to single payment entry
        const payments = [];
        if(m.amount !== undefined && m.amount !== null){
          payments.push({ id: (m.id || Date.now()) + idx, amount: Number(m.amount)||0, date: new Date().toISOString(), by: m.createdBy || null });
        }
        return { id: m.id || Date.now()+idx, name: m.name || '', payments: payments, monthlyAmount: m.monthlyAmount || 0, createdBy: m.createdBy || null };
      });
      saveState();
      renderTable();
    }
  }catch(e){ console.warn('API non disponible', e); }
}

// Admin creation and multi-admin login
async function createAdmin(){
  const pass = document.getElementById('newAdminPass').value;
  if(!pass || pass.trim().length < 3){ alert('Entrez un mot de passe d\'au moins 3 caractères'); return; }
  if(useApi){
    try{
      if(!currentAdminPass){ alert('Tu dois être connecté en tant qu\'admin pour créer un autre admin sur le serveur'); return; }
      const res = await fetch('/api/admins', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pass, creatorPassword: currentAdminPass})});
      if(res.ok){ alert('Administrateur créé sur le serveur'); document.getElementById('newAdminPass').value = ''; await loadAdmins(); return; }
    }catch(e){ console.warn(e); alert('Erreur serveur, sauvegarde en local'); }
  }
  adminAccounts.push({id: Date.now(), password: String(pass)});
  saveState();
  document.getElementById('newAdminPass').value = '';
  alert('Administrateur créé localement');
}

async function loadAdmins(){
  const container = document.getElementById('adminList');
  if(!container) return;
  container.innerHTML = 'Chargement...';
  if(useApi){
    try{
      const res = await fetch('/api/admins', {headers: {'x-admin-pass': currentAdminPass}});
      if(res.ok){ const j = await res.json(); container.innerHTML = j.admins.map(a=>`<div class="admin-item">ID: ${a.id} <button onclick="deleteAdmin(${a.id})">Supprimer</button></div>`).join(''); return; }
      container.innerHTML = 'Erreur lors du chargement';
    }catch(e){ console.warn(e); container.innerHTML = 'Erreur'; }
    return;
  }
  // local mode
  container.innerHTML = adminAccounts.map(a=>`<div class="admin-item">ID: ${a.id} <button onclick="deleteAdmin(${a.id})">Supprimer</button></div>`).join('');
}

async function deleteAdmin(id){
  if(!confirm('Supprimer cet administrateur ?')) return;
  if(useApi){
    try{
      const res = await fetch(`/api/admins/${id}`, {method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({creatorPassword: currentAdminPass})});
      if(res.ok){ alert('Administrateur supprimé'); await loadAdmins(); return; }
      alert('Erreur suppression');
    }catch(e){ console.warn(e); alert('Erreur serveur'); }
    return;
  }
  // local
  adminAccounts = adminAccounts.filter(a=> a.id !== id);
  saveState();
  loadAdmins();
}

async function loginAdmin(){
  const pass = document.getElementById('adminPass').value;
  if(useApi){
    try{
      const res = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pass})});
      const j = await res.json();
        if(j.ok){
          // store current admin pass so isAdmin checks work
          currentAdminPass = pass;
          document.getElementById('adminPanel').style.display = 'block';
          document.getElementById('loginArea').style.display = 'none';
          await loadFromApi();
          return;
        }
      alert('Mot de passe incorrect');
    }catch(e){ alert('Erreur de connexion au serveur'); }
  } else {
    if(adminAccounts.some(a=> a.password === pass)){
      currentAdminPass = pass;
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('loginArea').style.display = 'none';
      renderTable();
        return;
    } else {
      alert('Mot de passe incorrect');
    }
  }
}

function logoutAdmin(){
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginArea').style.display = 'block';
  // clear admin pass from memory
  currentAdminPass = null;
}

async function addMember(){
  const name = document.getElementById('nameInput').value.trim();
  const monthly = parseInt((document.getElementById('monthlyInput')||{value:0}).value, 10) || 0;
  if(!name){ alert('Entrez un nom valide'); return; }
  if(!currentUser){ alert('Veuillez vous connecter pour ajouter un membre'); return; }
  const newMember = { id: Date.now(), name: name, payments: [], monthlyAmount: monthly, createdBy: currentUser.id };
  if(useApi){
    try{
      const res = await fetch('/api/members', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newMember)});
      if(res.ok) { await loadFromApi(); document.getElementById('nameInput').value = ''; return; }
    }catch(e){ console.warn(e); }
  }
  members.push(newMember);
  saveState(); renderTable(); document.getElementById('nameInput').value = '';
  const monthlyInputEl = document.getElementById('monthlyInput'); if(monthlyInputEl) monthlyInputEl.value = '';
}

async function addAmount(memberId){
  if(!currentUser){ alert('Connectez-vous pour ajouter un paiement'); return; }
  const value = prompt('Ajouter montant :');
  if(value === null) return;
  const n = parseInt(value, 10);
  if(isNaN(n) || n <= 0){ alert('Entrez un montant positif'); return; }
  const member = members.find(m => m.id === memberId);
  if(!member){ alert('Membre introuvable'); return; }
  const payment = { id: Date.now(), amount: n, date: new Date().toISOString(), by: currentUser.id };
  if(useApi){
    try{
      await fetch(`/api/members/${member.id}/amount`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({delta:n})});
      await loadFromApi(); return;
    }catch(e){ console.warn(e); }
  }
  member.payments = member.payments || [];
  member.payments.push(payment);
  saveState(); renderTable();
}

// B: edit amount (set exact value)
async function editAmount(memberId){
  const member = members.find(m => m.id === memberId);
  if(!member){ alert('Membre introuvable'); return; }
  // Permettre aux administrateurs de modifier tous les membres
  const isAdmin = isCurrentAdmin();
  // Si le membre est issu d'un ancien format (pas de createdBy), permettre au premier utilisateur
  // qui modifie de devenir le créateur (claim) — cela évite le message d'autorisation.
  if(member.createdBy === undefined || member.createdBy === null){
    if(!currentUser){ alert('Veuillez vous connecter pour modifier ce membre'); return; }
    // si l'utilisateur est admin, on laisse tel quel; sinon on assigne le createdBy au courant
    if(!isAdmin){
      member.createdBy = currentUser.id;
      // persist immediate ownership claim
      saveState();
    }
  }
  if(!currentUser || (!isAdmin && member.createdBy !== currentUser.id)){
    console.warn('Refus modification: member=', member, 'currentUser=', currentUser, 'isAdmin=', isAdmin);
    alert('Vous n\'êtes pas autorisé à modifier ce membre'); 
    return;
  }
  const currentTotal = (member.payments || []).reduce((s,p)=> s + (Number(p.amount)||0), 0);
  const value = prompt('Nouveau montant total (remplacera l\'historique par un paiement unique) :', String(currentTotal));
  if(value === null) return;
  const n = parseInt(value, 10);
  if(isNaN(n) || n < 0){ alert('Entrez un montant valide (>=0)'); return; }
  if(useApi){
    try{
      // Ask for monthly update when using API
      let body = { amount: n };
      try{
        const newMonthlyStr = prompt('Montant mensuel (laisser vide pour ne pas changer) :', String(member.monthlyAmount || 0));
        if(newMonthlyStr !== null && newMonthlyStr.trim() !== ''){
          const newMonthly = parseInt(newMonthlyStr, 10);
          if(!isNaN(newMonthly) && newMonthly >= 0){ body.monthlyAmount = newMonthly; }
        }
      }catch(e){}
      await fetch(`/api/members/${member.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      await loadFromApi(); return;
    }catch(e){ console.warn(e); }
  }
  member.payments = [{ id: Date.now(), amount: n, date: new Date().toISOString(), by: currentUser.id }];
  // Optionnel : permettre de mettre à jour la cotisation mensuelle
  try{
    const newMonthlyStr = prompt('Montant mensuel (laisser vide pour ne pas changer) :', String(member.monthlyAmount || 0));
    if(newMonthlyStr !== null && newMonthlyStr.trim() !== ''){
      const newMonthly = parseInt(newMonthlyStr, 10);
      if(!isNaN(newMonthly) && newMonthly >= 0){ member.monthlyAmount = newMonthly; }
    }
  }catch(e){ /* ignore */ }
  saveState(); renderTable();
}

async function deleteMember(memberId){
  const member = members.find(m => m.id === memberId);
  if(!member){ alert('Membre introuvable'); return; }
  // allow deletion by creator or admin
  const isAdmin = isCurrentAdmin();
  // If legacy member with no createdBy, allow the first user who performs an action to claim it
  if(member.createdBy === undefined || member.createdBy === null){
    if(!currentUser){ alert('Veuillez vous connecter pour supprimer ce membre'); return; }
    if(!isAdmin){ member.createdBy = currentUser.id; saveState(); }
  }
  if(!currentUser || (!isAdmin && member.createdBy !== currentUser.id)){
    console.warn('Refus suppression: member=', member, 'currentUser=', currentUser, 'isAdmin=', isAdmin);
    alert('Vous n\'êtes pas autorisé à supprimer ce membre'); return; }
  if(!confirm('Supprimer ce membre ?')) return;
  if(useApi){
    try{ await fetch(`/api/members/${member.id}`, {method:'DELETE'}); await loadFromApi(); return; }catch(e){ console.warn(e); }
  }
  members = members.filter(m => m.id !== memberId);
  saveState(); renderTable();
}

function updateStats() {
  const isAdmin = isCurrentAdmin();
  const visible = isAdmin ? members : (currentUser && currentUser.id ? members.filter(m => m.createdBy === currentUser.id) : []);
  const total = visible.reduce((sum, m) => {
    const payments = m.payments || [];
    return sum + payments.reduce((s,p)=> s + (Number(p.amount)||0), 0);
  }, 0);
  const count = visible.length;
  const average = count ? Math.round(total / count) : 0;

  document.getElementById('totalAmount').textContent = total.toLocaleString() + ' FC';
  document.getElementById('memberCount').textContent = count;
  document.getElementById('averageAmount').textContent = average.toLocaleString() + ' FC';
}

function searchAndSortMembers() {
  const searchTerm = document.getElementById('searchMembers').value.toLowerCase();
  const sortBy = document.getElementById('sortMembers').value;
  // Only show members for the current user (unless admin)
  const isAdmin = isCurrentAdmin();
  let base = members;
  if(!isAdmin){
    if(!currentUser || !currentUser.id){ base = []; } else { base = members.filter(m => m.createdBy === currentUser.id); }
  }

  let filtered = base.filter(m => m.name.toLowerCase().includes(searchTerm));
    
  filtered.sort((a, b) => {
    switch(sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'amount':
        const totalA = (a.payments||[]).reduce((s,p)=> s + (Number(p.amount)||0),0);
        const totalB = (b.payments||[]).reduce((s,p)=> s + (Number(p.amount)||0),0);
        return totalB - totalA;
      case 'date':
        return (b.id || 0) - (a.id || 0);
      default:
        return 0;
    }
  });
    
  return filtered;
}

function renderTable(){
  const filtered = searchAndSortMembers();
  const table = document.getElementById('membersTable');
  if (!table) return; // Si on est sur la page de login
  
  const tbodyElem = table.querySelector('tbody');
  const tbody = tbodyElem || table;
  if (!tbodyElem) {
    // table without explicit tbody (simple index.html) - recreate header
    table.innerHTML = '<tr><th>Nom</th><th>Montant total</th><th>Mensuelle</th><th>Payé ce mois</th><th>Restant</th><th>Dernier paiement</th><th>Action</th></tr>';
  } else {
    tbody.innerHTML = '';
  }
  // compute selected month/year
  const selMonth = parseInt(document.getElementById('startMonth').value);
  const selYear = parseInt(document.getElementById('startYear').value);
  filtered.forEach((m) =>{
    const safeName = escapeHtml(String(m.name));
    const payments = m.payments || [];
    const total = payments.reduce((s,p)=> s + (Number(p.amount)||0), 0);
    const paidThisMonth = payments.reduce((s,p)=>{
      const d = new Date(p.date);
      return s + ((d.getMonth()+1 === selMonth && d.getFullYear() === selYear) ? (Number(p.amount)||0) : 0);
    }, 0);
    const lastPaymentDate = payments.length > 0 ? new Date(payments[payments.length-1].date).toLocaleDateString() : '-';
    const monthly = Number(m.monthlyAmount || 0);
    const remaining = Math.max(0, monthly - paidThisMonth);
    const isAdmin = isCurrentAdmin();
    const canEdit = isAdmin || (currentUser && m.createdBy === currentUser.id);

    tbody.innerHTML += `
      <tr>
        <td>${safeName}</td>
          <td>${total} FC</td>
          <td>${monthly} FC</td>
          <td>${paidThisMonth} FC</td>
          <td>${remaining} FC</td>
        <td>${lastPaymentDate}</td>
        <td>
          <div class="button-group">
            ${canEdit ? `<button class="btn-primary" onclick="addAmount(${m.id})">Ajouter</button>` : '<span class="hint">(lecture)</span>'}
            ${canEdit ? `<button class="btn-secondary" onclick="editAmount(${m.id})">Modifier</button>` : ''}
            ${canEdit ? `<button class="btn-danger" onclick="deleteMember(${m.id})">Supprimer</button>` : ''}
            ${canEdit ? `<button class="btn-share" onclick="generateShareLink(${m.id})">Partager</button>` : ''}
          </div>
        </td>
      </tr>`;
  });
  updateStats();
  // Mettre à jour le total mensuel et restant
  try{ updateMonthlyTotal(); }catch(e){/* ignore if elements missing */}
}

// Update start date when changed
function updateStartDate() {
  const month = parseInt(document.getElementById('startMonth').value);
  const year = parseInt(document.getElementById('startYear').value);
  startDate = { month, year };
  localStorage.setItem('startDate', JSON.stringify(startDate));
}

// Event listeners for search and sort
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchMembers');
  const sortSelect = document.getElementById('sortMembers');
  const monthSelect = document.getElementById('startMonth');
  const yearSelect = document.getElementById('startYear');

  if (searchInput) {
    searchInput.addEventListener('input', renderTable);
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', renderTable);
  }
  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', updateStartDate);
    yearSelect.addEventListener('change', updateStartDate);
  }
    
  initializeStartDate();
});

function escapeHtml(str){ return str.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

// D: Export CSV (client-side)
function exportCsv(){
  console.log('Export CSV: members=', members ? members.length : 0, 'currentUser=', currentUser, 'startDate=', startDate);
  // build a robust CSV with proper escaping and BOM for Excel
  const selMonth = parseInt((document.getElementById('startMonth')||{value:1}).value);
  const selYear = parseInt((document.getElementById('startYear')||{value:new Date().getFullYear()}).value);

  function esc(v){
    if(v === null || v === undefined) return '""';
    const s = String(v);
    // if already numeric, keep plain (no quotes) to help Excel, else quote and escape
    if(!isNaN(Number(s)) && s.trim() !== '') return s;
    return '"' + s.replace(/"/g,'""') + '"';
  }

  const header = [
    'Nom',
    'Montant total',
    'Mensuelle',
    `Payé durant le mois ${selMonth}/${selYear}`,
    'Restant',
    'Date dernier paiement',
    'Créé par'
  ];

  const lines = [];
  lines.push(header.map(esc).join(','));

  if(!members || members.length === 0){
    // keep CSV with header only and a note row
    lines.push(esc('Aucun membre trouvé'));
  } else {
    members.forEach(m => {
      const payments = m.payments || [];
      const total = payments.reduce((s,p)=> s + (Number(p.amount)||0), 0);
      const paidThisMonth = payments.reduce((s,p)=>{
        const d = new Date(p.date);
        return s + ((d.getMonth()+1 === selMonth && d.getFullYear() === selYear) ? (Number(p.amount)||0) : 0);
      }, 0);
      const lastPayment = payments.length > 0 ? new Date(payments[payments.length-1].date).toLocaleDateString() : '';
      const creator = users.find(u => u.id === m.createdBy);
      const creatorEmail = creator ? creator.email : '';
      const remaining = Math.max(0, (m.monthlyAmount||0) - paidThisMonth);

      const row = [
        m.name || '',
        total,
        m.monthlyAmount || 0,
        paidThisMonth,
        remaining,
        lastPayment,
        creatorEmail
      ];
      lines.push(row.map(esc).join(','));
    });
  }

  // Use CRLF for better Excel compatibility and add UTF-8 BOM
  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cotisations.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Generate a shareable view-only link for a member
function generateShareLink(memberId){
  const member = members.find(m => m.id === memberId);
  if(!member){ alert('Membre introuvable'); return; }
  const isAdmin = isCurrentAdmin();
  const isOwner = currentUser && member.createdBy === currentUser.id;
  if(!isAdmin && !isOwner){ alert('Vous n\'êtes pas autorisé à partager ce membre'); return; }
  // create token
  const token = Array.from(window.crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  member.shareToken = token;
  saveState();
  // build link to view.html?token=...
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/,'view.html');
  const link = base + '?token=' + encodeURIComponent(token);
  // copy to clipboard
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(()=> alert('Lien copié dans le presse-papiers :\n' + link), ()=> prompt('Copiez ce lien:', link));
  } else {
    prompt('Copiez ce lien:', link);
  }
}

// D: Import CSV (client-side)
function triggerImport(){ document.getElementById('importFile').click(); }

async function handleImport(event){
  if (!currentUser) {
    alert('Veuillez vous connecter pour importer des données');
    return;
  }
  const file = event.target.files && event.target.files[0]; 
  if(!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const parsed = [];
  
  // Vérifier si c'est un administrateur
  const isAdmin = isCurrentAdmin();
  console.log('Import: isAdmin=', isAdmin, 'currentUser=', currentUser, 'fileLines=', lines.length);
  
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(/,(?=(?:[^"']*"[^"']*"?)*[^"']*$)/).map(s => s.trim().replace(/^"|"$/g,'').replace(/""/g,'"'));
    if(cols.length >= 2){ 
      const amount = parseInt(cols[1],10) || 0;
      const monthly = parseInt(cols[2],10) || 0;
      const paymentDate = cols[3] ? new Date(cols[3]).toISOString() : new Date().toISOString();
      // Si admin, permet de spécifier le créateur
      const creator = isAdmin && cols[4] ? users.find(u => u.email === cols[4])?.id : currentUser.id;
      parsed.push({
        id: Date.now()+i, 
        name: cols[0], 
        payments: [{
          id: Date.now()+i, 
          amount: amount, 
          date: paymentDate, 
          by: currentUser ? currentUser.id : null
        }], 
        monthlyAmount: monthly,
        createdBy: creator || currentUser.id
      });
    }
  }
  if(parsed.length === 0){ alert('Aucun enregistrement valide trouvé'); return; }
  if(useApi){
    try{ await fetch('/api/import', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({members:parsed})}); await loadFromApi(); return; }catch(e){ console.warn(e); }
  }
  members = members.concat(parsed); saveState(); renderTable();
}

// Theme toggle
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'themeToggle'){
    document.documentElement.classList.toggle('dark');
    e.target.textContent = document.documentElement.classList.contains('dark') ? 'Mode clair' : 'Mode sombre';
  }
});

function addMemberWithAmount() {
  const name = document.getElementById('memberName').value.trim();
  const amount = parseInt(document.getElementById('initialAmount').value) || 0;
  const monthly = parseInt(document.getElementById('monthlyAmount').value) || 0;
  
  if(!name){ 
    alert('Entrez un nom valide'); 
    return; 
  }
  
  if(!currentUser){ 
    alert('Veuillez vous connecter pour ajouter un membre'); 
    return; 
  }

  const newMember = {
    id: Date.now(),
    name: name,
    payments: amount > 0 ? [{
      id: Date.now(),
      amount: amount,
      date: new Date().toISOString(),
      by: currentUser.id
    }] : [],
    monthlyAmount: monthly,
    createdBy: currentUser.id
  };

  if(useApi){
    fetch('/api/members', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(newMember)
    }).then(res => {
      if(res.ok) {
        loadFromApi();
        document.getElementById('memberName').value = '';
        document.getElementById('initialAmount').value = '';
        const ma = document.getElementById('monthlyAmount'); if(ma) ma.value = '';
      }
    }).catch(console.warn);
  } else {
    members.push(newMember);
    saveState();
    renderTable();
    document.getElementById('memberName').value = '';
    document.getElementById('initialAmount').value = '';
    const ma = document.getElementById('monthlyAmount'); if(ma) ma.value = '';
  }
}

function updateMonthlyTotal() {
  const selMonth = parseInt(document.getElementById('startMonth').value);
  const selYear = parseInt(document.getElementById('startYear').value);
  const isAdmin = isCurrentAdmin();
  const visible = isAdmin ? members : (currentUser && currentUser.id ? members.filter(m => m.createdBy === currentUser.id) : []);
  const monthlyTotal = visible.reduce((total, member) => {
    const payments = member.payments || [];
    return total + payments.reduce((sum, payment) => {
      const date = new Date(payment.date);
      return sum + ((date.getMonth()+1 === selMonth && date.getFullYear() === selYear) ? (Number(payment.amount)||0) : 0);
    }, 0);
  }, 0);
  // expected total for the month (sum of monthlyAmount for visible members)
  const expectedMonthly = visible.reduce((s, m) => s + (Number(m.monthlyAmount)||0), 0);
  const remainingTotal = Math.max(0, expectedMonthly - monthlyTotal);
  const monthlyTotalElement = document.getElementById('monthlyTotal');
  if (monthlyTotalElement) {
    monthlyTotalElement.textContent = monthlyTotal.toLocaleString() + ' FC';
  }
  const monthlyRemainingEl = document.getElementById('monthlyRemaining');
  if (monthlyRemainingEl) {
    monthlyRemainingEl.textContent = remainingTotal.toLocaleString() + ' FC';
  }
}

function initializeDashboard() {
  // Afficher l'email de l'utilisateur
  const userEmailElement = document.getElementById('userEmail');
  if (userEmailElement && currentUser) {
    userEmailElement.textContent = currentUser.email;
  }
  
  // Initialiser la période
  initializeStartDate();
  
  // Mettre à jour les statistiques
  updateStats();
  updateMonthlyTotal();
  
  // Rendre le tableau
  renderTable();
}

window.addEventListener('load', async ()=>{ 
  try{
    await tryApi(); 

    // Vérifier l'authentification
    if(!currentUser || (!currentUser.id && currentUser.id !== null)){
      // stay on index.html (login) — do not attempt to redirect if already there
      if(!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')){
        window.location.href = 'index.html';
        return;
      }
    }

    // Si on est sur le tableau de bord
    if(window.location.pathname.includes('dashboard.html')){
      initializeDashboard();
    }
  }catch(e){
    console.error('Erreur lors du chargement de la page:', e);
    try{ localStorage.setItem('lastError', JSON.stringify({message: e && e.message, stack: e && e.stack})); }catch(err){}
    // show a user-visible alert to capture the error
    alert('Une erreur est survenue lors du chargement de l\'application. Ouvrez la console (F12) et copiez la valeur de localStorage.getItem("lastError") puis collez-la ici.');
  }
  
  // Écouter les changements de période
  const monthSelect = document.getElementById('startMonth');
  const yearSelect = document.getElementById('startYear');
  if(monthSelect && yearSelect){
    monthSelect.addEventListener('change', () => {
      updateStartDate();
      updateMonthlyTotal();
      renderTable();
    });
    yearSelect.addEventListener('change', () => {
      updateStartDate();
      updateMonthlyTotal();
      renderTable();
    });
  }
});
