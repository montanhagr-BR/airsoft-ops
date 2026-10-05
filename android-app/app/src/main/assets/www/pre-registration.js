window.PreRegistration = (() => {
  let operation = null;
  let page = 0;
  let initializedUser = null;
  let requestVersion = 0;
  const pageSize = 25;
  const byId = id => document.getElementById(id);
  const client = () => AirsoftPortal.getClient();
  function message(text) { byId('preRegistrationStatus').textContent = text; }
  function report(error) { byId('portalStatus').hidden = false; byId('portalStatus').dataset.tone = 'error'; byId('portalStatus').textContent = error.message; }

  async function openRegistration() {
    const user = AirsoftPortal.getUser();
    if (!user || initializedUser === user.id) return;
    initializedUser = user.id;
    const form = byId('preRegistrationForm');
    form.elements.email.value = user.email || '';
    form.elements.name.value = user.user_metadata?.full_name || '';
    form.elements.code.value = new URLSearchParams(location.search).get('registration') || '';
    if (form.elements.code.value) await loadRegistration();
  }

  async function loadRegistration() {
    const form = byId('preRegistrationForm');
    const code = form.elements.code.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    try {
      const { data, error } = await client().rpc('registration_operation', { requested_code: code });
      if (error) throw error;
      const info = data?.[0];
      if (!info) throw new Error('Operacao nao encontrada.');
      byId('preRegistrationTitle').textContent = info.operation_name;
      const own = await client().from('game_registrations').select('*').eq('session_id', info.session_id).eq('user_id', AirsoftPortal.getUser().id).maybeSingle();
      if (own.error) throw own.error;
      const row = own.data;
      byId('registrationNextActions').hidden = !row;
      const mapping = { name:'name', organization:'organization', email:'email', phone:'phone', emergencyName:'emergency_name', emergencyPhone:'emergency_phone' };
      if (row) for (const [field,column] of Object.entries(mapping)) form.elements[field].value = row[column];
      form.querySelector('button[type="submit"]').disabled = !info.registration_open;
      message(row ? 'Você está na lista de espera deste evento. Pode participar ou se inscrever em outros eventos pelo painel.' : info.registration_open ? 'Lista de espera aberta. A inscrição não confirma sua participação na partida.' : 'Inscrições fechadas.');
    } catch (error) { message(error.message); }
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const profile = Object.fromEntries(new FormData(form));
      profile.consent = form.elements.consent.checked;
      const { error } = await client().rpc('submit_game_registration', { requested_code: profile.code.trim().toUpperCase(), profile });
      if (error) throw error;
      message('Você entrou na lista de espera! Volte ao painel para participar de uma partida ou se inscrever em outro evento.');
      byId('registrationNextActions').hidden = false;
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  }

  async function openOrganizer(session) {
    operation = session;
    page = 0;
    byId('preRegistrationSearch').value = '';
    byId('organizerTitle').textContent = 'Lista de espera — ' + (session.state?.operationName || 'Operação');
    const localHost = ['airsoft.local', 'localhost', '127.0.0.1'].includes(location.hostname);
    const publicBase = localHost ? 'https://warm-hummingbird-8988f6.netlify.app/' : location.origin + location.pathname;
    byId('registrationLink').value = publicBase + '?registration=' + encodeURIComponent(session.join_code);
    try {
      const result = await client().from('game_sessions').select('registration_open').eq('id', session.id).single();
      if (result.error) throw result.error;
      byId('preRegistrationOpen').checked = result.data.registration_open;
      await loadRoster();
    } catch (error) { report(error); }
  }

  async function loadRoster() {
    if (!operation) return;
    const version = ++requestVersion;
    const search = byId('preRegistrationSearch').value.trim().replace(/[^\p{L}\p{N} ]/gu, '');
    let query = client().from('game_registrations').select('*', { count:'exact' }).eq('session_id', operation.id);
    if (search) query = query.or(`name.ilike.%${search}%,organization.ilike.%${search}%`);
    const { data, count, error } = await query.order('created_at').order('id').range(page*pageSize, (page+1)*pageSize-1);
    if (version !== requestVersion) return;
    if (error) { report(error); return; }
    const total = Math.max(1,Math.ceil((count || 0)/pageSize));
    if (page >= total) { page = total-1; return loadRoster(); }
    byId('registrationPage').textContent = `${page+1}/${total} | ${count || 0} interessados`;
    byId('registrationPrev').disabled = page === 0;
    byId('registrationNext').disabled = page+1 >= total;
    const list = byId('preRegistrationRoster');
    list.replaceChildren();
    if (!data?.length) { list.textContent = 'Nenhuma inscricao encontrada.'; return; }
    for (const row of data) {
      const item = document.createElement('div');
      item.className = 'registrationRow';
      const details = document.createElement('div');
      const name = document.createElement('b'); name.textContent = row.name;
      const info = document.createElement('small'); info.textContent = `${row.organization || 'Sem agremiacao'} | Lista de espera`;
      const contacts = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Contatos';
      const text = document.createElement('p'); text.textContent = `${row.email} | ${row.phone} | Emergencia: ${row.emergency_name} (${row.emergency_phone})`;
      contacts.append(summary,text); details.append(name,info,contacts);
      item.append(details); list.append(item);
    }
  }

  async function preparePlayer(sessionId) {
    const user = AirsoftPortal.getUser();
    if (user) localStorage.setItem('airsoft-player-id-v1','P-'+user.id);
  }

  document.addEventListener('DOMContentLoaded', () => {
    byId('preRegistrationForm').addEventListener('submit',submit);
    byId('preRegistrationForm').elements.code.addEventListener('change',loadRegistration);
    byId('refreshRegistration').addEventListener('click',loadRegistration);
    byId('registrationPrev').addEventListener('click',()=>{if(page>0){page--;loadRoster();}});
    byId('registrationNext').addEventListener('click',()=>{page++;loadRoster();});
    let searchTimer;
    byId('preRegistrationSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;loadRoster();},250);});
    byId('preRegistrationOpen').addEventListener('change',async event=>{
      if(!operation)return;
      const checked=event.target.checked; event.target.disabled=true;
      try { const result=await client().from('game_sessions').update({registration_open:checked}).eq('id',operation.id); if(result.error)throw result.error; }
      catch(error){event.target.checked=!checked;report(error);} finally{event.target.disabled=false;}
    });
    byId('copyRegistrationLink').addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(byId('registrationLink').value); byId('copyRegistrationLink').textContent='Copiado'; }
      catch { byId('registrationLink').select(); }
    });
  });
  return { openRegistration, openOrganizer, preparePlayer };
})();
