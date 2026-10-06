const AirsoftCloud = (() => {
  const config = window.AIRSOFT_SUPABASE_CONFIG || {};
  const role = location.pathname.endsWith('controle.html') ? 'controller' : location.pathname.endsWith('bomba.html') ? 'artifact' : 'player';
  const storageKey = 'airsoft-cloud-session-v1-' + role;
  const deviceKey = 'airsoft-cloud-device-v1-' + role;
  let client = null;
  let connection = readConnection();
  let user = null;
  let channel = null;
  let applyingRemote = false;
  let syncing = false;
  let queuedControllerState = null;
  let controllerPublish = null;
  let serverStatus = null;
  let serverVersion = null;
  let syncTimer = null;
  let heartbeat = null;
  let gate = null;
  let header = null;
  let scannerStream = null;
  let leaving = false;
  let connecting = false;

  function readConnection() {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
  }
  function saveConnection(value) {
    connection = value;
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
    renderHeader();
  }
  function deviceId() {
    let id = localStorage.getItem(deviceKey);
    if (!id) {
      id = role + '-' + crypto.randomUUID();
      localStorage.setItem(deviceKey, id);
    }
    return id;
  }
  function setStatus(text, tone = '') {
    if (gate) {
      const target = gate.querySelector('[data-gate-status]');
      target.textContent = text;
      target.dataset.tone = tone;
    }
  }
  async function ensureAuth() {
    if (!config.url || !config.publishableKey || !window.supabase) throw new Error('Supabase não configurado');
    if (!client) client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
    });
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (!current.data.session || current.data.session.user.is_anonymous) {
      throw new Error('Entre com sua conta no painel para acessar este módulo.');
    }
    user = current.data.session.user;
    if (role === 'player') localStorage.setItem('airsoft-player-id-v1', 'P-' + user.id);
    return client;
  }
  async function createRoom() {
    if (connecting) return;
    const operationName = gate.querySelector('[data-operation-name]').value.trim();
    if (operationName.length < 3) {
      setStatus('Informe o nome da operação', 'error');
      return;
    }
    setStatus('Criando sala...');
    connecting = true;
    try {
      await ensureAuth();
      const initialState = { ...AirsoftBus.read(), operationName, players: [], bombDevices: [], log: [], running: false, finished: false };
      const result = await client.rpc('create_game_session', { initial_state:initialState });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row?.session_id || !row.join_code) throw new Error('A sala não retornou uma conexão válida.');
      applyingRemote = true;
      AirsoftBus.write(initialState);
      applyingRemote = false;
      saveConnection({ sessionId:row.session_id, joinCode:row.join_code, memberId:null, role, operationName });
      await subscribe();
      setStatus('Sala online', 'ok');
      renderGate();
    } catch (error) { setStatus(error.message || 'Falha ao criar sala', 'error'); }
    finally { connecting = false; }
  }
  async function joinRoom(code) {
    if (connecting) return;
    const cleanCode = String(code || '').trim().toUpperCase();
    if (cleanCode.length !== 6) { setStatus('Digite o código de 6 caracteres', 'error'); return; }
    setStatus('Entrando na sala...');
    connecting = true;
    try {
      await ensureAuth();
      const name = role === 'artifact' ? 'Artefato' : 'Jogador';
      const result = role === 'controller'
        ? await client.rpc('rejoin_game_as_controller', { requested_code: cleanCode })
        : await client.rpc('join_game', {
        requested_code:cleanCode,
        requested_device_id:deviceId(),
        requested_role:role,
        requested_name:name,
        requested_metadata:{ platform:new URLSearchParams(location.search).has('android') ? 'android-webview' : 'web', appVersion:'0.7.2' }
      });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row?.session_id || (role !== 'controller' && !row.member_id)) throw new Error('A sala não retornou uma conexão válida.');
      applyingRemote = true;
      AirsoftBus.write(row.session_state || AirsoftBus.read());
      applyingRemote = false;
      const operationName = row.session_state && row.session_state.operationName || 'OPERAÇÃO';
      saveConnection({ sessionId:row.session_id, joinCode:cleanCode, memberId:row.member_id, role, operationName });
      await subscribe();
      setStatus('Conectado · aguardando aprovação', 'ok');
      openApp();
    } catch (error) { setStatus(error.message || 'Falha ao entrar', 'error'); }
    finally { connecting = false; }
  }
  async function leaveRoom() {
    if (leaving) return;
    leaving = true;
    stopScanner();
    clearTimeout(syncTimer);
    clearInterval(heartbeat);
    const previousChannel = channel;
    channel = null;
    saveConnection(null);
    if (client && previousChannel) client.removeChannel(previousChannel).catch(() => {});
    returnToPortal();
  }
  function returnToPortal() {
    const params = new URLSearchParams(location.search);
    const target = new URL('index.html', location.href);
    target.searchParams.set('flow', 'dashboard');
    if (params.has('android')) target.searchParams.set('android', params.get('android'));
    location.replace(target.href);
  }
  function leaveControl() {
    leaving = true;
    stopScanner();
    clearTimeout(syncTimer);
    clearInterval(heartbeat);
    returnToPortal();
  }
  async function closeRoom() {
    if (role !== 'controller' || !connection) return;
    if (!confirm('Fechar esta sala e desconectar todos os aparelhos?')) return;
    setStatus('Fechando sala...');
    const result = await client.from('game_sessions').update({
      status:'archived',
      updated_at:new Date().toISOString()
    }).eq('id', connection.sessionId);
    if (result.error) {
      setStatus('Falha ao fechar sala: ' + result.error.message, 'error');
      return;
    }
    await leaveRoom();
    setStatus('Sala fechada', 'ok');
  }
  async function publishControllerState(state) {
    if (!connection || role !== 'controller') return;
    if (serverStatus === 'finished' && !state.finished) throw new Error('Esta partida já foi encerrada. Crie uma nova operação pelo painel.');
    queuedControllerState = state;
    if (controllerPublish) return controllerPublish;
    controllerPublish = (async () => {
      while (queuedControllerState && !leaving) {
        const next = queuedControllerState; queuedControllerState = null;
        syncing = true;
        try {
          let query = client.from('game_sessions').update({
            state: next, state_version: Number(serverVersion || 0) + 1,
            status: next.finished ? 'finished' : next.running ? 'running' : 'setup',
            ...(next.finished || next.running ? { registration_open: false } : {}),
            updated_at: new Date().toISOString()
          }).eq('id', connection.sessionId);
          if (serverStatus) query = query.eq('status', serverStatus);
          if (serverVersion != null) query = query.eq('state_version', serverVersion);
          const result = await query.select('state,status,state_version').single();
          if (result.error) throw result.error;
          serverStatus = result.data.status; serverVersion = result.data.state_version;
          if (!queuedControllerState && result.data.state) {
            applyingRemote = true;
            try { AirsoftBus.write(result.data.state); } finally { applyingRemote = false; }
          }
        } catch (error) {
          const pendingFinish = queuedControllerState?.finished || next.finished;
          queuedControllerState = null;
          const snapshot = await client.from('game_sessions').select('state,status,state_version').eq('id', connection.sessionId).single();
          if (!snapshot.error && snapshot.data) {
            serverStatus = snapshot.data.status; serverVersion = snapshot.data.state_version;
            if (pendingFinish && serverStatus !== 'finished' && serverStatus !== 'archived') {
              queuedControllerState = { ...snapshot.data.state, running: false, finished: true, playerRegistrationOpen: false,
                endedAt: Date.now(), bombSeconds: null, pending: null, operation: null, phase: 'Encerrado pelo Controlador', bombState: 'Fim de jogo' };
              // Retry an ending once after a concurrent update; do not discard it.
              if (!next.finishRetried) { queuedControllerState.finishRetried = true; continue; }
              queuedControllerState = null;
            }
            applyingRemote = true;
            try { AirsoftBus.write(snapshot.data.state); } finally { applyingRemote = false; }
            if (pendingFinish && serverStatus === 'finished') continue;
          }
          setStatus('Falha ao sincronizar: ' + error.message, 'error');
          throw new Error('Não foi possível salvar a mudança: ' + error.message);
        } finally { syncing = false; }
      }
    })();
    try { await controllerPublish; } finally { controllerPublish = null; }
  }
  async function flushControllerState() {
    clearTimeout(syncTimer);
    await publishControllerState(AirsoftBus.read());
  }
  async function publishMemberEvent(state) {
    if (!connection || role === 'controller' || syncing) return;
    syncing = true;
    const result = await client.from('game_events').insert({
      session_id:connection.sessionId,
      user_id:user.id,
      device_id:deviceId(),
      event_type:'state_proposal',
      payload:{ state }
    });
    syncing = false;
    if (result.error) setStatus('Falha ao enviar ação: ' + result.error.message, 'error');
  }
  function scheduleSync(state) {
    if (leaving || applyingRemote || !connection || !client) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (role === 'controller') publishControllerState(state).catch(error => setStatus(error.message, 'error'));
      else publishMemberEvent(state);
    }, 180);
  }
  async function registerPlayer(profile) {
    if (!connection || role !== 'player') throw new Error('Entre em uma sala primeiro.');
    const result = await client.rpc('submit_game_registration', { requested_code: connection.code || connection.joinCode, profile });
    if (result.error) throw result.error;
    await subscribe();
  }
  async function importPreRegistrations() {
    if (!connection || role !== 'controller') throw new Error('Abra o Controle de uma sala online para importar.');
    if (syncing) throw new Error('Aguarde a sincronização e tente novamente.');
    if (AirsoftBus.read().running || AirsoftBus.read().finished) throw new Error('Importe antes de iniciar a partida.');
    clearTimeout(syncTimer);
    await publishControllerState(AirsoftBus.read());
    const result=await client.rpc('import_registration_forces',{target_session:connection.sessionId});
    if(result.error)throw result.error;
    applyingRemote=true;
    try { if(result.data?.state)AirsoftBus.write(result.data.state); } finally { applyingRemote=false; }
    await subscribe();
    return Number(result.data?.imported || 0);
  }
  function openRegistration() {
    if (!connection) throw new Error('Entre na operação para abrir sua inscrição.');
    const url = new URL('index.html', location.href);
    url.searchParams.set('registration', connection.joinCode || connection.code);
    if (new URLSearchParams(location.search).has('android')) url.searchParams.set('android', '1');
    location.href = url.href;
  }
  async function assignPlayer(registrationId, team, decision = 'approved') {
    if (!connection || role !== 'controller') throw new Error('Somente o Controle pode aprovar.');
    const result = await client.rpc('assign_game_registration', { registration_id: registrationId, assigned_team: team, decision });
    if (result.error) throw result.error;
    await subscribe();
  }
  async function consumeEvent(payload) {
    if (role !== 'controller' || !payload.new) return;
    const proposed = payload.new.payload && payload.new.payload.state;
    if (!proposed) return;
    const authoritative = AirsoftBus.read();
    if (authoritative.finished || !authoritative.running) return;
    applyingRemote = true;
    // Member telemetry must not replace another account's roster or approvals.
    const current = AirsoftBus.read();
    proposed.players = (current.players || []).map(player => {
      const update = (proposed.players || []).find(p => p.id === player.id);
      if (player.id !== 'P-' + payload.new.user_id || !update) return player;
      return { ...player, lat: update.lat, lng: update.lng, accuracy: update.accuracy, lastFix: update.lastFix, lastSeen: update.lastSeen };
    });
    // Only the Controle owns lifecycle, countdowns and field configuration.
    for (const key of ['running','finished','startedAt','endedAt','clockUpdatedAt','gameSeconds','bombSeconds','terminalTeam1Seconds','terminalTeam2Seconds','playerRegistrationOpen','fieldBoundary','tacticalAreas','teamStartPositions','fieldArtifact','log','winner','bombSequence','bombSequenceIndex']) proposed[key] = current[key];
    AirsoftBus.write(proposed);
    applyingRemote = false;
    await publishControllerState(proposed).catch(error => setStatus(error.message, 'error'));
  }
  async function consumeSession(payload) {
    if (!payload.new) return;
    if (payload.new.status === 'archived') {
      alert('A sala foi fechada pelo Controlador.');
      await leaveRoom();
      return;
    }
    if (!payload.new.state) return;
    if (serverVersion != null && payload.new.state_version != null && payload.new.state_version < serverVersion) return;
    serverStatus = payload.new.status; serverVersion = payload.new.state_version ?? serverVersion;
    if (payload.new.status === 'finished') { clearTimeout(syncTimer); queuedControllerState = null; }
    else if (role === 'controller' && (syncing || queuedControllerState || AirsoftBus.read().finished)) return;
    applyingRemote = true;
    AirsoftBus.write(payload.new.state);
    applyingRemote = false;
    if (payload.new.state.operationName && connection) {
      saveConnection({ ...connection, operationName:payload.new.state.operationName });
    }
    setStatus('Sincronizado agora', 'ok');
  }
  async function subscribe() {
    if (!connection) return;
    await ensureAuth();
    const snapshot = await client.from('game_sessions').select('state,status,controller_id,state_version').eq('id', connection.sessionId).single();
    if (snapshot.error) throw snapshot.error;
    if (role === 'controller' && snapshot.data.controller_id !== user.id) {
      saveConnection(null);
      throw new Error('Somente o proprietário desta sala pode abrir o Controle.');
    }
    if (snapshot.data.status === 'archived') { await leaveRoom(); return; }
    // Prepare the authoritative roster before displaying or publishing local configuration.
    if (role === 'controller' && snapshot.data.status === 'setup') {
      const formation = await client.rpc('import_registration_forces', { target_session: connection.sessionId });
      if (formation.error) throw formation.error;
      snapshot.data.state = formation.data.state;
      snapshot.data.state_version = formation.data.state_version;
      const status = document.getElementById('preRegistrationImportStatus');
      if (status) status.textContent = 'Inscrições carregadas automaticamente. Jogadores distribuídos nas forças estão aprovados; sem força permanecem pendentes.';
    }
    serverStatus = snapshot.data.status; serverVersion = snapshot.data.state_version;
    if (snapshot.data.state) {
      applyingRemote = true;
      try { AirsoftBus.write(snapshot.data.state); }
      finally { applyingRemote = false; }
    }
    if (channel) await client.removeChannel(channel);
    channel = client.channel('airsoft-' + connection.sessionId)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'game_sessions', filter:'id=eq.' + connection.sessionId }, consumeSession)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'game_events', filter:'session_id=eq.' + connection.sessionId }, consumeEvent)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setStatus('Realtime conectado', 'ok');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setStatus('Realtime reconectando...', 'error');
      });
    clearInterval(heartbeat);
    if (connection.memberId) heartbeat = setInterval(() => client.rpc('touch_game_member', { target_member:connection.memberId }), 10000);
  }
  function renderHeader() {
    if (!header) return;
    header.hidden = !connection;
    if (!connection) return;
    header.querySelector('[data-operation-title]').textContent = connection.operationName || 'OPERAÇÃO';
    header.querySelector('[data-leave-control]').hidden = true;
    header.querySelector('[data-close-room]').hidden = role !== 'controller';
    header.querySelector('[data-leave-room]').hidden = role === 'controller';
  }
  function qrPayload(code) {
    const base = location.hostname === 'airsoft.local' ? 'https://warm-hummingbird-8988f6.netlify.app/' : new URL('index.html', location.href).href;
    return base + '?flow=dashboard&room=' + encodeURIComponent(code);
  }
  function parseCode(value) {
    const text = String(value || '').trim();
    const direct = text.match(/^[A-Za-z0-9]{6}$/);
    if (direct) return direct[0].toUpperCase();
    try {
      const parsed = new URL(text);
      const code = parsed.searchParams.get('room') || parsed.searchParams.get('code') || parsed.searchParams.get('registration') || '';
      return /^[A-Za-z0-9]{6}$/.test(code) ? code.toUpperCase() : '';
    } catch { return ''; }
  }
  function stopScanner() {
    if (scannerStream) scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
    if (gate) gate.querySelector('[data-cloud-scanner]').hidden = true;
  }
  async function startScanner() {
    const scanner = gate.querySelector('[data-cloud-scanner]');
    const video = gate.querySelector('video');
    if (!('BarcodeDetector' in window)) {
      setStatus('Leitor QR indisponível neste aparelho. Digite o código.', 'error');
      return;
    }
    try {
      scanner.hidden = false;
      scannerStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
      video.srcObject = scannerStream;
      await video.play();
      const detector = new BarcodeDetector({ formats:['qr_code'] });
      const readFrame = async () => {
        if (!scannerStream) return;
        try {
          const codes = await detector.detect(video);
          const code = codes.length ? parseCode(codes[0].rawValue) : '';
          if (code) {
            stopScanner();
            gate.querySelector('[data-gate-code]').value = code;
            await joinRoom(code);
            return;
          }
        } catch { }
        requestAnimationFrame(readFrame);
      };
      readFrame();
    } catch {
      stopScanner();
      setStatus('Não foi possível abrir a câmera. Digite o código.', 'error');
    }
  }
  async function openApp() {
    if (role === 'controller' && connection) {
      try { await subscribe(); }
      catch (error) { setStatus("Não foi possível carregar as inscrições: " + error.message, "error"); return; }
      const current = AirsoftBus.read();
      if (!current.running && !current.finished) {
        const preparation = { ...current, running: false, finished: false, startedAt: null,
          playerRegistrationOpen: true, log: [], phase: 'Inscrições abertas · preparação', bombState: 'Pré-cadastro' };
        const result = await client.from('game_sessions').update({ state: preparation, registration_open: true,
          updated_at: new Date().toISOString() }).eq('id', connection.sessionId);
        if (result.error) { setStatus('Não foi possível abrir as inscrições: ' + result.error.message, 'error'); return; }
        applyingRemote = true;
        try { AirsoftBus.write(preparation); } finally { applyingRemote = false; }
      }
    }
    stopScanner();
    document.documentElement.classList.remove('cloudLocked');
    document.documentElement.classList.add('cloudActive');
    if (gate) gate.hidden = true;
    renderHeader();
    window.dispatchEvent(new CustomEvent('airsoft-room-ready', { detail: { name: user?.user_metadata?.full_name || '', email: user?.email || '' } }));
  }
  function renderGate() {
    if (!gate) return;
    const connected = Boolean(connection && user);
    gate.hidden = false;
    gate.querySelector('[data-account-start]').hidden = Boolean(user);
    gate.querySelectorAll('[data-controller-start]').forEach(element => { element.hidden = !user || role !== 'controller' || connected; });
    gate.querySelectorAll('[data-member-start]').forEach(element => { element.hidden = !user || role === 'controller' || connected; });
    gate.querySelector('[data-connected-start]').hidden = !connected;
    if (!connected) return;
    gate.querySelector('[data-gate-room]').textContent = connection.joinCode;
    gate.querySelector('[data-gate-operation]').textContent = connection.operationName || 'OPERAÇÃO';
    const qr = gate.querySelector('[data-gate-qr]');
    qr.hidden = role !== 'controller';
    if (role === 'controller') {
      qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=' + encodeURIComponent(qrPayload(connection.joinCode));
    }
    gate.querySelector('[data-gate-enter]').textContent = role === 'controller' ? 'Abrir controle' : 'Abrir terminal';
  }
  function mountGate() {
    document.documentElement.classList.add('cloudLocked');
    gate = document.createElement('section');
    gate.className = 'cloudGate';
    gate.innerHTML = '<div class="cloudGateBox"><div class="cloudGateBrand">AIRSOFT OPS</div>' +
      '<div data-account-start><h1>Acesse sua conta</h1><p>Entre pelo painel para acessar Controle, Artefato ou Jogador com a mesma conta.</p></div>' +
      '<h1 data-controller-start>Criar sala</h1><div data-controller-start><p>Cadastre a operação antes de abrir o controle.</p><label class="cloudField">Nome da operação<input data-operation-name maxlength="60" placeholder="Ex.: Operação Montanha"></label><button data-gate-create type="button">Criar nova sala</button></div>' +
      '<h1 data-member-start>Entrar na sala</h1><div data-member-start><p>Digite o código fornecido pelo Controlador ou leia o QR Code.</p><div class="cloudCodeEntry"><input data-gate-code maxlength="6" inputmode="text" placeholder="CÓDIGO"><button data-gate-join type="button">Entrar</button></div><button class="secondary" data-gate-scan type="button">Ler QR Code</button></div>' +
      '<div data-connected-start hidden><p class="cloudReady">SALA PRONTA</p><h2 data-gate-operation>OPERAÇÃO</h2><strong data-gate-room>------</strong><img data-gate-qr alt="QR Code para entrar na sala"><button data-gate-enter type="button">Abrir</button><button class="secondary" data-gate-change type="button">Sair da sala</button></div>' +
      '<div data-cloud-scanner hidden><video playsinline muted></video><button class="secondary" data-scan-close type="button">Fechar câmera</button></div>' +
      '<button class="secondary" data-gate-home type="button">Voltar ao painel principal</button>' +
      '<small data-gate-status>Conexão segura via Supabase</small></div>';
    document.body.appendChild(gate);
    gate.querySelector('[data-gate-create]').onclick = createRoom;
    gate.querySelector('[data-gate-join]').onclick = () => joinRoom(gate.querySelector('[data-gate-code]').value);
    gate.querySelector('[data-gate-code]').onkeydown = event => { if (event.key === 'Enter') joinRoom(event.target.value); };
    gate.querySelector('[data-gate-scan]').onclick = startScanner;
    gate.querySelector('[data-scan-close]').onclick = stopScanner;
    gate.querySelector('[data-gate-enter]').onclick = openApp;
    gate.querySelector('[data-gate-change]').onclick = leaveRoom;
    gate.querySelector('[data-gate-home]').onclick = leaveControl;
    renderGate();
  }
  function mountHeader() {
    header = document.createElement('header');
    header.className = 'cloudHeader';
    header.hidden = true;
    header.innerHTML = '<div><small>OPERAÇÃO</small><b data-operation-title>OPERAÇÃO</b></div>' +
      '<nav><button data-menu type="button">Painel</button><button data-leave-control hidden type="button">Sair do controle</button><button class="danger" data-close-room type="button">Fechar sala</button><button data-leave-room type="button">Sair da sala</button></nav>';
    document.body.appendChild(header);
    header.querySelector('[data-leave-control]').onclick = leaveControl;
    header.querySelector('[data-menu]').onclick = leaveControl;
    header.querySelector('[data-close-room]').onclick = closeRoom;
    header.querySelector('[data-leave-room]').onclick = leaveRoom;
    renderHeader();
  }
  async function init() {
    mountGate();
    mountHeader();
    window.addEventListener('airsoft-state', event => scheduleSync(event.detail));
    try {
      await ensureAuth();
      renderGate();
      if (!connection) return;
      await subscribe();
      if (leaving || !connection) return;
      if (role === 'controller') renderGate();
      else openApp();
    } catch (error) { setStatus(error.message || 'Sem conexão', 'error'); renderGate(); }
  }
  addEventListener('DOMContentLoaded', init);
  return { createRoom, joinRoom, leaveRoom, registerPlayer, openRegistration, assignPlayer, importPreRegistrations, flushControllerState, back: () => {
    if (role === 'controller') leaveControl(); else leaveRoom();
    return true;
  } };
})();
