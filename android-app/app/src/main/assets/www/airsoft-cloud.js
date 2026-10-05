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
  let syncTimer = null;
  let heartbeat = null;
  let gate = null;
  let header = null;
  let scannerStream = null;

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
    if (!current.data.session) {
      const signed = await client.auth.signInAnonymously();
      if (signed.error) throw signed.error;
      user = signed.data.user;
    } else user = current.data.session.user;
    return client;
  }
  async function createRoom() {
    const inputName = gate.querySelector('[data-operation-name]').value.trim();
    const operationName = inputName.length >= 2 ? inputName : 'OPERAÇÃO AIRSOFT';
    setStatus('Criando sala...');
    try {
      await ensureAuth();
      const initialState = { ...AirsoftBus.read(), operationName };
      const result = await client.rpc('create_game_session', { initial_state:initialState });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      applyingRemote = true;
      AirsoftBus.write(initialState);
      applyingRemote = false;
      saveConnection({ sessionId:row.session_id, joinCode:row.join_code, memberId:null, role, operationName });
      await subscribe();
      setStatus('Sala online', 'ok');
      renderGate();
    } catch (error) {
      console.warn('Supabase offline or RPC unavailable, using local standalone mode:', error);
      const localCode = 'OP-' + Math.floor(1000 + Math.random() * 9000);
      const initialState = { ...AirsoftBus.read(), operationName };
      applyingRemote = true;
      AirsoftBus.write(initialState);
      applyingRemote = false;
      saveConnection({ sessionId:'local-' + Date.now(), joinCode:localCode, memberId:null, role, operationName });
      setStatus('Modo local (offline)', 'ok');
      renderGate();
    }
  }
  async function joinRoom(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (cleanCode.length !== 6) { setStatus('Digite o código de 6 caracteres', 'error'); return; }
    setStatus('Entrando na sala...');
    try {
      await ensureAuth();
      const name = role === 'artifact' ? 'Artefato Android' : 'Jogador Android';
      const result = await client.rpc('join_game', {
        requested_code:cleanCode,
        requested_device_id:deviceId(),
        requested_role:role,
        requested_name:name,
        requested_metadata:{ platform:'android-webview', appVersion:'0.5.4' }
      });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      applyingRemote = true;
      AirsoftBus.write(row.session_state || AirsoftBus.read());
      applyingRemote = false;
      const operationName = row.session_state && row.session_state.operationName || 'OPERAÇÃO';
      saveConnection({ sessionId:row.session_id, joinCode:cleanCode, memberId:row.member_id, role, operationName });
      await subscribe();
      setStatus('Conectado · aguardando aprovação', 'ok');
      openApp();
    } catch (error) { setStatus(error.message || 'Falha ao entrar', 'error'); }
  }
  async function leaveRoom() {
    clearTimeout(syncTimer);
    clearInterval(heartbeat);
    if (client && channel) await client.removeChannel(channel);
    channel = null;
    saveConnection(null);
    setStatus('Modo local');
    document.documentElement.classList.add('cloudLocked');
    renderGate();
  }
  function leaveControl() {
    stopScanner();
    document.documentElement.classList.add('cloudLocked');
    document.documentElement.classList.remove('cloudActive');
    if (gate) {
      gate.hidden = false;
      renderGate();
    }
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
  let pendingControllerState = null;
  let pendingMemberState = null;

  async function publishControllerState(state) {
    if (!connection || role !== 'controller') return;
    if (syncing) {
      pendingControllerState = state;
      return;
    }
    syncing = true;
    const stateToPublish = state;
    pendingControllerState = null;
    try {
      const result = await client.from('game_sessions').update({
        state: stateToPublish,
        state_version: Number(stateToPublish.cloudVersion || 0) + 1,
        status: stateToPublish.finished ? 'finished' : stateToPublish.running ? 'running' : 'setup',
        updated_at: new Date().toISOString()
      }).eq('id', connection.sessionId);
      if (result.error) setStatus('Falha ao sincronizar: ' + result.error.message, 'error');
    } catch (e) {
      setStatus('Erro de rede: ' + e.message, 'error');
    } finally {
      syncing = false;
      if (pendingControllerState) {
        const next = pendingControllerState;
        pendingControllerState = null;
        publishControllerState(next);
      }
    }
  }

  async function publishMemberEvent(state) {
    if (!connection || role === 'controller') return;
    if (syncing) {
      pendingMemberState = state;
      return;
    }
    syncing = true;
    const stateToPublish = state;
    pendingMemberState = null;
    try {
      const result = await client.from('game_events').insert({
        session_id: connection.sessionId,
        user_id: user.id,
        device_id: deviceId(),
        event_type: 'state_proposal',
        payload: { state: stateToPublish }
      });
      if (result.error) setStatus('Falha ao enviar ação: ' + result.error.message, 'error');
    } catch (e) {
      setStatus('Erro de rede: ' + e.message, 'error');
    } finally {
      syncing = false;
      if (pendingMemberState) {
        const next = pendingMemberState;
        pendingMemberState = null;
        publishMemberEvent(next);
      }
    }
  }

  function scheduleSync(state) {
    if (applyingRemote || !connection || !client) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (role === 'controller') publishControllerState(state);
      else publishMemberEvent(state);
    }, 180);
  }
  async function consumeEvent(payload) {
    if (role !== 'controller' || !payload.new || payload.new.device_id === deviceId()) return;
    const proposed = payload.new.payload && payload.new.payload.state;
    if (!proposed) return;

    const current = AirsoftBus.read();
    const localPlayers = current.players || [];
    const remotePlayers = proposed.players || [];
    const playerMap = new Map();
    localPlayers.forEach(p => playerMap.set(p.id, p));
    remotePlayers.forEach(p => {
      const existing = playerMap.get(p.id);
      if (!existing || p.status === 'approved' || (p.requestedAt || 0) > (existing.requestedAt || 0)) {
        playerMap.set(p.id, p);
      }
    });

    const mergedState = {
      ...proposed,
      players: Array.from(playerMap.values())
    };

    applyingRemote = true;
    AirsoftBus.write(mergedState);
    applyingRemote = false;
    await publishControllerState(mergedState);
  }
  async function consumeSession(payload) {
    if (!payload.new) return;
    if (payload.new.status === 'archived') {
      alert('A sala foi fechada pelo Controlador.');
      await leaveRoom();
      return;
    }
    if (role === 'controller' || !payload.new.state) return;
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
    const snapshot = await client.from('game_sessions').select('state,status').eq('id', connection.sessionId).single();
    if (snapshot.error) throw snapshot.error;
    if (snapshot.data.status === 'archived') { await leaveRoom(); return; }
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
    header.querySelector('[data-leave-control]').hidden = role !== 'controller';
    header.querySelector('[data-close-room]').hidden = role !== 'controller';
    header.querySelector('[data-leave-room]').hidden = role === 'controller';
  }
  function qrPayload(code) {
    return 'https://airsoft.local/join?code=' + encodeURIComponent(code);
  }
  function parseCode(value) {
    const text = String(value || '').trim();
    const direct = text.match(/^[A-Za-z0-9]{6}$/);
    if (direct) return direct[0].toUpperCase();
    try {
      const parsed = new URL(text);
      const code = parsed.searchParams.get('code') || '';
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
  function openApp() {
    stopScanner();
    document.documentElement.classList.remove('cloudLocked');
    document.documentElement.classList.add('cloudActive');
    if (gate) gate.hidden = true;
    renderHeader();
  }
  function renderGate() {
    if (!gate) return;
    const connected = Boolean(connection);
    gate.hidden = false;
    gate.querySelectorAll('[data-controller-start]').forEach(element => { element.hidden = role !== 'controller' || connected; });
    gate.querySelectorAll('[data-member-start]').forEach(element => { element.hidden = role === 'controller' || connected; });
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
    if (role === 'controller') {
      gate.innerHTML = '<div class="cloudGateBox"><div class="cloudGateBrand">AIRSOFT OPS · CONTROLADOR</div>' +
        '<h1>Criar Sala de Operações</h1><p>Informe o nome da partida para iniciar o centro de comando.</p>' +
        '<label class="cloudField">Nome da operação<input data-operation-name maxlength="60" placeholder="Ex.: Operação Tática Alpha" value="OPERAÇÃO TÁTICA"></label>' +
        '<button data-gate-create type="button" class="primary" style="min-height:52px;font-size:16px;font-weight:900">Criar e Abrir Controle</button>' +
        '<small data-gate-status>Conexão segura via Supabase (Modo Online/Offline)</small></div>';
    } else {
      gate.innerHTML = '<div class="cloudGateBox"><div class="cloudGateBrand">AIRSOFT OPS</div>' +
        '<h1 data-member-start>Entrar na sala</h1><div data-member-start><p>Digite o código fornecido pelo Controlador ou leia o QR Code.</p><div class="cloudCodeEntry"><input data-gate-code maxlength="6" inputmode="text" placeholder="CÓDIGO"><button data-gate-join type="button">Entrar</button></div><button class="secondary" data-gate-scan type="button">Ler QR Code</button></div>' +
        '<div data-cloud-scanner hidden><video playsinline muted></video><button class="secondary" data-scan-close type="button">Fechar câmera</button></div>' +
        '<small data-gate-status>Conexão segura via Supabase</small></div>';
    }
    document.body.appendChild(gate);
    const createBtn = gate.querySelector('[data-gate-create]');
    if (createBtn) {
      createBtn.onclick = async () => {
        await createRoom();
        openApp();
      };
    }
    const joinBtn = gate.querySelector('[data-gate-join]');
    if (joinBtn) {
      joinBtn.onclick = () => joinRoom(gate.querySelector('[data-gate-code]').value);
      gate.querySelector('[data-gate-code]').onkeydown = event => { if (event.key === 'Enter') joinRoom(event.target.value); };
      gate.querySelector('[data-gate-scan]').onclick = startScanner;
      gate.querySelector('[data-scan-close]').onclick = stopScanner;
    }
    const enterBtn = gate.querySelector('[data-gate-enter]');
    if (enterBtn) enterBtn.onclick = openApp;
    const changeBtn = gate.querySelector('[data-gate-change]');
    if (changeBtn) changeBtn.onclick = leaveRoom;
    renderGate();
  }
  function mountHeader() {
    header = document.createElement('header');
    header.className = 'cloudHeader';
    header.hidden = true;
    header.innerHTML = '<div><small>OPERAÇÃO</small><b data-operation-title>OPERAÇÃO</b></div>' +
      '<nav><button data-leave-control type="button">Sair do controle</button><button class="danger" data-close-room type="button">Fechar sala</button><button data-leave-room type="button">Sair da sala</button></nav>';
    document.body.appendChild(header);
    header.querySelector('[data-leave-control]').onclick = leaveControl;
    header.querySelector('[data-close-room]').onclick = closeRoom;
    header.querySelector('[data-leave-room]').onclick = leaveRoom;
    renderHeader();
  }
  async function checkForUpdates() {
    try {
      const response = await fetch('version.json?_=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const currentVersionCode = 5;
      if (data && data.versionCode > currentVersionCode) {
        if (typeof showPopup === 'function') {
          showPopup('Atualização Disponível (v' + data.versionName + ')', data.changelog + '\n\nO aplicativo será atualizado automaticamente.', 'Sistema');
        }
      }
    } catch (_) {}
  }
  async function init() {
    mountGate();
    mountHeader();
    window.addEventListener('airsoft-state', event => scheduleSync(event.detail));
    checkForUpdates();
    if (!connection) return;
    try { await subscribe(); } catch (error) { setStatus(error.message || 'Sem conexão', 'error'); }
    renderGate();
  }
  addEventListener('DOMContentLoaded', init);
  return { createRoom, joinRoom, leaveRoom };
})();
