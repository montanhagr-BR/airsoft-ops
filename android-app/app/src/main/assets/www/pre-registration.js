window.PreRegistration = (() => {
  let operation = null;
  let selectedCode = null;
  let submitting = false;
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
    const version = ++requestVersion;
    const code = form.elements.code.value.trim().toUpperCase();
    form.elements.code.value = code;
    selectedCode = null;
    byId('registrationNextActions').hidden = true;
    form.querySelector('button[type="submit"]').disabled = true;
    if (!/^[A-Z0-9]{6}$/.test(code)) { message('Informe um código de seis caracteres.'); return; }
    try {
      const { data, error } = await client().rpc('registration_operation', { requested_code: code });
      if (error) throw error;
      if (version !== requestVersion) return;
      const info = data?.[0];
      if (!info) throw new Error('Operacao nao encontrada.');
      byId('preRegistrationTitle').textContent = info.operation_name;
      const own = await client().from('game_registrations').select('*').eq('session_id', info.session_id).eq('user_id', AirsoftPortal.getUser().id).maybeSingle();
      if (own.error) throw own.error;
      if (version !== requestVersion) return;
      const row = own.data;
      selectedCode = code;
      const choice = form.elements.requestedTeam;
      if (choice) {
        byId('registrationTeamField').hidden = !info.registration_team_choice;
        choice.disabled = !info.registration_team_choice;
        choice.options[1].textContent = info.team1_name || 'Time 1';
        choice.options[2].textContent = info.team2_name || 'Time 2';
        choice.value = info.registration_team_choice ? row?.requested_team || '' : '';
      }
      const full = info.registration_capacity != null && Number(info.reserved_count) >= info.registration_capacity;
      if (byId('registrationAvailability')) byId('registrationAvailability').textContent = info.registration_capacity == null ? 'Vagas sem limite de participantes.' : `${info.reserved_count} de ${info.registration_capacity} vagas reservadas.`;
      byId('registrationNextActions').hidden = !row;
      const mapping = { name:'name', organization:'organization', email:'email', phone:'phone', emergencyName:'emergency_name', emergencyPhone:'emergency_phone' };
      if (row) for (const [field,column] of Object.entries(mapping)) form.elements[field].value = row[column];
      form.querySelector('button[type="submit"]').disabled = !info.registration_open || row?.status === 'approved' || (full && (!row || row.status === 'rejected'));
      message(row?.status === 'approved' ? 'Inscrição aprovada! Abra o terminal para acessar sua equipe.' : row?.status === 'rejected' ? 'Sua inscrição foi recusada. Você pode corrigir os dados e reenviar enquanto as inscrições estiverem abertas.' : row ? 'Vaga reservada. Aguarde o organizador aprovar sua participação.' : info.registration_open ? full ? 'Vagas esgotadas.' : 'Inscrições abertas. Preencha a ficha abaixo.' : 'Inscrições fechadas para este evento.');
      byId('enterRegisteredGame').disabled = !row || row.status === 'rejected' || !info;

    } catch (error) { message(error.message); }
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.target;
    if (submitting || !form.reportValidity()) return;
    submitting = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const profile = Object.fromEntries(new FormData(form));
      profile.consent = form.elements.consent.checked;
      const { error } = await client().rpc('submit_game_registration', { requested_code: profile.code.trim().toUpperCase(), profile });
      if (error) throw error;
      message('Inscrição salva! Seu cadastro aparece no Controle, aguardando aprovação e definição de equipe.');
      selectedCode = profile.code.trim().toUpperCase();
      await loadRegistration();
    } catch (error) { message(error.message); }
    finally { submitting = false; if (selectedCode) await loadRegistration(); else button.disabled = false; }
  }

  function showOrganizerScreen(screen) {
    for (const name of ['Select', 'Roster']) {
      const element = byId('organizer' + name + 'Screen');
      if (element) element.hidden = name !== screen;
    }
  }
  function openSelector() {
    operation = null;
    showOrganizerScreen('Select');
    byId('organizerFeedback').textContent = '';
  }
  async function openOrganizer(session) {
    operation = session;
    showOrganizerScreen('Roster');
    page = 0;
    byId('preRegistrationSearch').value = '';
    byId('organizerTitle').textContent = 'Pré-inscrição · ' + (session.state?.operationName || 'Operação');
    const localHost = ['airsoft.local', 'localhost', '127.0.0.1'].includes(location.hostname);
    const publicBase = localHost ? 'https://warm-hummingbird-8988f6.netlify.app/' : location.origin + location.pathname;
    byId('registrationLink').value = publicBase + '?registration=' + encodeURIComponent(session.join_code);
    try {
      const result = await client().from('game_sessions').select('registration_open,registration_capacity,registration_team_choice,controller_id,state,status,registration_force1_name,registration_force2_name').eq('id', session.id).single();
      if (result.error) throw result.error;
      operation = {...session,...result.data};
      byId('registrationForce1Name').value=result.data.registration_force1_name || result.data.state?.team1Name || 'Força 1';
      byId('registrationForce2Name').value=result.data.registration_force2_name || result.data.state?.team2Name || 'Força 2';
      byId('enrollmentOpenStatus').textContent=result.data.registration_open && result.data.status==='setup' ? 'Inscrições antecipadas abertas. Copie o link e receba os jogadores antes de configurar a partida.' : 'Inscrições fechadas.';
      byId('configureAfterEnrollment').hidden=result.data.controller_id!==AirsoftPortal.getUser().id;
      byId('preRegistrationOpen').checked = result.data.registration_open;
      byId('registrationCapacity').value = result.data.registration_capacity ?? '';
      byId('registrationTeamChoice').checked = result.data.registration_team_choice;
      byId('organizerAccess').hidden = result.data.controller_id !== AirsoftPortal.getUser().id;
      byId('organizerFeedback').textContent = '';
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
    const summary=await client().rpc('registration_force_summary',{target_session:operation.id});
    if(version!==requestVersion)return;
    if(summary.error){report(summary.error);return;}
    const counts=summary.data || {};
    byId('forceSummary').replaceChildren();
    for(const [key,label] of [['unassigned','Sem força'],['ct',teamName('ct')],['terrorist',teamName('terrorist')],['rejected','Recusados']]){
      const card=document.createElement('div');const total=document.createElement('b');total.textContent=counts[key] || 0;const title=document.createElement('span');title.textContent=label;card.append(total,title);byId('forceSummary').append(card);
    }
    byId('forceImportStatus').textContent=`${counts.pending_import || 0} jogador(es) com formação nova ou alterada. O Controle carregará as listas automaticamente ao abrir.`;
    const total = Math.max(1,Math.ceil((count || 0)/pageSize));
    if (page >= total) { page = total-1; return loadRoster(); }
    byId('registrationPage').textContent = `${page+1}/${total} | ${count || 0} inscritos`;
    byId('registrationPrev').disabled = page === 0;
    byId('registrationNext').disabled = page+1 >= total;
    const list = byId('preRegistrationRoster');
    list.replaceChildren();
    if (!data?.length) { list.textContent = 'Nenhuma inscrição encontrada.'; return; }
    const columns={};
    for(const [key,label] of [['unassigned','Sem força'],['ct',teamName('ct')],['terrorist',teamName('terrorist')],['rejected','Recusados']]){
      const column=document.createElement('section');column.className='forceColumn';const heading=document.createElement('h3');heading.textContent=label;column.append(heading);columns[key]=column;list.append(column);
    }
    for (const row of data) {
      const item = document.createElement('div');
      item.className = 'registrationRow';
      const details = document.createElement('div');
      const name = document.createElement('b'); name.textContent = row.name;
      const info = document.createElement('small'); info.textContent = `${row.organization || 'Sem agremiação'} | ${row.status === 'approved' ? 'Aprovado' : row.status === 'rejected' ? 'Recusado' : 'Vaga reservada'} | ${row.status==='approved' && row.team!==row.planned_team ? 'Alteração aguardando importação' : row.imported_at ? 'Importado no Controle' : 'Aguardando importação'}${row.requested_team ? ' · Preferência: '+teamName(row.requested_team) : ''}`;
      const contacts = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Contatos';
      const text = document.createElement('p'); text.textContent = `${row.email} | ${row.phone} | Emergencia: ${row.emergency_name} (${row.emergency_phone})`;
      contacts.append(summary,text); details.append(name,info,contacts);
      item.append(details);
      const team = document.createElement('select');
      team.setAttribute('aria-label', 'Time de ' + row.name);
      for (const value of ['','ct','terrorist']) { const option = document.createElement('option'); option.value=value; option.textContent=teamName(value); team.append(option); }
      team.value = row.planned_team || '';
      team.disabled=operation.status!=='setup' || row.status==='rejected';
      item.append(team);
      const group=document.createElement('input');group.type='checkbox';const groupLabel=document.createElement('label');groupLabel.append(group,document.createTextNode(' Mover a agremiação inteira'));groupLabel.hidden=!row.organization;item.append(groupLabel);
      for (const [decision,label] of [['plan','Salvar força'],['rejected','Recusar']]) {
        const button = document.createElement('button'); button.type='button'; button.className='btnSecondary'; button.textContent=label;
        button.disabled = operation.status !== 'setup' || row.status==='rejected';
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try { const result=decision==='plan' ? await client().rpc('plan_registration_force',{registration_id:row.id,force_team:team.value || null,move_organization:group.checked}) : await client().rpc('assign_game_registration',{registration_id:row.id,assigned_team:row.team || 'ct',decision}); if(result.error)throw result.error; byId('organizerFeedback').textContent=decision==='plan' ? 'Formação salva. O Controle carregará as listas automaticamente ao abrir.' : 'Inscrição recusada.'; await loadRoster(); }
          catch(error){report(error);button.disabled=false;}
        });item.append(button);
      }
      columns[row.status==='rejected' ? 'rejected' : row.planned_team || 'unassigned'].append(item);
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
    byId('enterRegisteredGame').addEventListener('click',()=> { if (selectedCode) AirsoftPortal.joinGameSession(selectedCode, 'player'); });
    byId('registrationPrev').addEventListener('click',()=>{if(page>0){page--;loadRoster();}});
    byId('registrationNext').addEventListener('click',()=>{page++;loadRoster();});
    let searchTimer;
    byId('preRegistrationSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;loadRoster();},250);});
    byId('configureAfterEnrollment').addEventListener('click',async event=>{
      if(!operation)return;event.target.disabled=true;
      try{await AirsoftPortal.joinGameSession(operation.join_code,'controller');}catch(error){report(error);}finally{event.target.disabled=false;}
    });
    byId('forceNamesForm').addEventListener('submit',saveForceNames);
    byId('refreshForceRoster').addEventListener('click',loadRoster);
    byId('registrationSettings').addEventListener('submit', saveSettings);
    byId('organizerAccess').addEventListener('submit', event=>{event.preventDefault();changeOrganizer(false);});
    byId('removeOrganizer').addEventListener('click',()=>changeOrganizer(true));
    byId('copyRegistrationLink').addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(byId('registrationLink').value); byId('copyRegistrationLink').textContent='Copiado'; }
      catch { byId('registrationLink').select(); }
    });
  });
  function teamName(value) {
    return value === 'ct' ? operation?.registration_force1_name || operation?.state?.team1Name || 'Força 1' : value === 'terrorist' ? operation?.registration_force2_name || operation?.state?.team2Name || 'Força 2' : 'Sem força';
  }
  async function saveForceNames(event){
    event.preventDefault();if(!operation || !event.target.reportValidity())return;
    const button=event.target.querySelector('button');button.disabled=true;
    const force1_name=byId('registrationForce1Name').value.trim(),force2_name=byId('registrationForce2Name').value.trim();
    try{const result=await client().rpc('name_registration_forces',{target_session:operation.id,force1_name,force2_name});if(result.error)throw result.error;operation.registration_force1_name=force1_name;operation.registration_force2_name=force2_name;byId('organizerFeedback').textContent='Nomes salvos para a importação no Controle.';await loadRoster();}
    catch(error){report(error);}finally{button.disabled=false;}
  }
  async function saveSettings(event) {
    event.preventDefault(); if (!operation || !event.target.reportValidity()) return;
    const value=byId('registrationCapacity').value;
    const capacity=value === '' ? null : Number(value);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return;
    const button=event.target.querySelector('button');button.disabled=true;
    try {
      const result=await client().rpc('configure_registration',{target_session:operation.id,is_open:byId('preRegistrationOpen').checked,capacity,team_choice:byId('registrationTeamChoice').checked});
      if(result.error)throw result.error;
      byId('organizerFeedback').textContent='Configuração salva.';byId('enrollmentOpenStatus').textContent=byId('preRegistrationOpen').checked ? 'Inscrições antecipadas abertas.' : 'Inscrições fechadas.';
      operation.registration_open=byId('preRegistrationOpen').checked;
      await loadRoster();
      showOrganizerScreen('Roster');
    } catch(error){byId('organizerFeedback').textContent=error.message;}
    finally {button.disabled=false;}
  }
  async function changeOrganizer(remove) {
    if(!operation || !byId('organizerEmail').reportValidity())return;
    try {
      const result=await client().rpc('set_registration_organizer',{target_session:operation.id,organizer_email:byId('organizerEmail').value,remove_access:remove});
      if(result.error)throw result.error;
      byId('organizerFeedback').textContent=remove ? 'Acesso removido.' : 'Organizador adicionado. Ele pode abrir as inscrições pelo código do jogo no painel.';
    }catch(error){byId('organizerFeedback').textContent=error.message;}
  }
  async function openByCode(code) {
    try {
      const result=await client().rpc('registration_organizer_operation',{requested_code:code.trim().toUpperCase()});
      if(result.error)throw result.error;
      const session=result.data?.[0];if(!session)throw new Error('Jogo não encontrado ou acesso não autorizado.');
      AirsoftPortal.access('organizer');await openOrganizer(session);
    }catch(error){report(error);}
  }
  async function selectGame(code) {
    await openRegistration();
    byId('preRegistrationForm').elements.code.value = code;
    await loadRegistration();
  }
  return { openRegistration, openOrganizer, openSelector, preparePlayer, selectGame, openByCode };
})();
