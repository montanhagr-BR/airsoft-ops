const AirsoftPortal = (() => {
  const config = window.AIRSOFT_SUPABASE_CONFIG || {};
  let supabase = null;
  let currentUser = null;
  let recoveringPassword = false;
  let accessRequested = false;
  let destination = 'dashboard';
  let currentTab = 'login'; // 'login', 'signup', 'reset'
  let sessionsRequest = 0;
  let signupBusy = false;
  let signupEmail = '';
  let resendAfter = 0;
  const pendingAuth = new Set();
  let resetAfter = 0;

  function authMessage(error) {
    const messages = {
      invalid_credentials: 'E-mail ou senha incorretos. Se ainda não criou sua conta, escolha Cadastrar. Se esqueceu a senha, escolha Recuperar.',
      email_not_confirmed: 'Confirme seu e-mail antes de entrar. Você pode solicitar outro link em Confirmar e-mail.',
      email_exists: 'Não foi possível criar a conta. Tente entrar ou recuperar sua senha.',
      user_already_exists: 'Não foi possível criar a conta. Tente entrar ou recuperar sua senha.',
      otp_expired: 'Este link expirou ou já foi usado. Solicite um novo link.',
      same_password: 'Escolha uma senha diferente da anterior.',
      weak_password: 'Esta senha é muito fraca. Use uma senha mais longa e exclusiva.',
      over_email_send_rate_limit: 'Muitos e-mails solicitados. Aguarde alguns minutos e tente novamente.',
      over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      email_address_not_authorized: 'O envio de e-mail ainda não está configurado para este endereço. Entre em contato com a organização.',
      email_address_invalid: 'O serviço recusou o endereço de e-mail. Confira se ele foi digitado corretamente.',
      signup_disabled: 'O cadastro está temporariamente indisponível.',
      session_not_found: 'Sua sessão expirou. Solicite outro link de recuperação.'
    };
    if (messages[error.code]) return messages[error.code];
    if (/invalid login credentials/i.test(error.message || '')) return messages.invalid_credentials;
    if (/failed to fetch|network|load failed/i.test(error.message || '')) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
    return 'Não foi possível concluir: ' + (error.message || 'tente novamente em instantes.');
  }

  function busy(action, id, active) {
    if (active) pendingAuth.add(action); else pendingAuth.delete(action);
    const button = document.getElementById(id);
    if (button) button.disabled = active;
  }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  function signupStep(step) {
    if (step === 2) {
      for (const id of ['signupName', 'signupEmail']) {
        if (!document.getElementById(id).reportValidity()) return;
      }
    }
    document.getElementById('signupProfile').hidden = step !== 1;
    document.getElementById('signupCredentials').hidden = step !== 2;
    document.getElementById('signupProgress').textContent = step === 1 ? '1 de 2 · Seus dados' : '2 de 2 · Sua senha';
  }

  async function resendConfirmation() {
    const input = document.getElementById('confirmationEmail');
    const email = String(input?.value || signupEmail || '').trim();
    if (!validEmail(email)) { setStatus('Informe um e-mail válido para receber a confirmação.', 'error'); return; }
    if (pendingAuth.has('resend')) return;
    if (Date.now() < resendAfter) { setStatus('Aguarde um minuto antes de solicitar outro e-mail.', 'error'); return; }
    busy('resend', 'resendSubmit', true);
    try {
      const { error } = await getClient().auth.resend({ type: 'signup', email,
        options: { emailRedirectTo: getRedirectUrl() } });
      if (error) throw error;
      resendAfter = Date.now() + 60000;
      setStatus('Se houver uma conta aguardando confirmação, o link será enviado. Confira também a pasta de spam.', 'ok');
    } catch (error) { setStatus(authMessage(error), 'error'); }
    finally { busy('resend', 'resendSubmit', false); }
  }

  function getClient() {
    if (!supabase) {
      const cfg = window.AIRSOFT_SUPABASE_CONFIG || {};
      const url = cfg.url || 'https://qmkkkmmglldodviufdug.supabase.co';
      const key = cfg.publishableKey || cfg.anonKey || cfg.apiKey || 'sb_publishable_5ETkNIPTIwlod4tz4g7pRA_FEJOtx3D';

      if (!window.supabase) {
        throw new Error('SDK do Supabase não foi carregado.');
      }
      supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return supabase;
  }

  function setStatus(text, tone = '') {
    const target = document.getElementById('portalStatus');
    if (!target) return;
    if (!text) {
      target.hidden = true;
      target.textContent = '';
      return;
    }
    target.hidden = false;
    target.textContent = text;
    target.dataset.tone = tone;
  }

  function getRedirectUrl(flow) {
    const url = new URL(window.location.protocol === 'file:' || window.location.hostname === 'airsoft.local'
      ? (config.webRedirectUrl || 'https://warm-hummingbird-8988f6.netlify.app/')
      : window.location.href);
    for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
    url.searchParams.set('flow', flow || (destination === 'registration' ? 'registration' : 'dashboard'));
    return url.origin + url.pathname + url.search;
  }

  // --- AUTHENTICATION FUNCTIONS ---

  async function initAuth() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && /^[A-Za-z0-9]{6}$/.test(room)) document.getElementById('joinRoomCode').value = room.toUpperCase();
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const callbackError = params.get('error_code') || hash.get('error_code') || params.get('error') || hash.get('error');
    if (params.has('registration') || params.get('flow') === 'registration') { accessRequested = true; destination = 'registration'; }
    else if (params.get('flow') || params.has('code') || hash.has('access_token')) accessRequested = true;
    if (callbackError) { currentTab = params.get('flow') === 'recovery' ? 'reset' : 'confirm'; accessRequested = true; }
    try {
      const client = getClient();

      // Listen to auth state changes (including Google OAuth redirect)
      client.auth.onAuthStateChange((event, session) => {
        currentUser = session && !session.user.is_anonymous ? session.user : null;
        if (event === 'PASSWORD_RECOVERY' && !callbackError) { recoveringPassword = true; accessRequested = true; }
        if (event === 'SIGNED_OUT') recoveringPassword = false;
        if (!currentUser) {
          sessionsRequest++;
          const card = document.getElementById('controllerCard');
          if (card) card.hidden = true;
          for (const role of ['controller', 'artifact', 'player']) localStorage.removeItem('airsoft-cloud-session-v1-' + role);
        }
        renderState();
        if (currentUser && event === 'SIGNED_IN') {
          if (!recoveringPassword && !callbackError) setStatus('Autenticado com sucesso!', 'ok');
          setTimeout(() => loadUserSessions(), 0);
        }
      });

      const sessionResponse = await client.auth.getSession();
      if (sessionResponse.error) throw sessionResponse.error;
      if (sessionResponse.data && sessionResponse.data.session) {
        currentUser = sessionResponse.data.session.user.is_anonymous ? null : sessionResponse.data.session.user;
        if (currentUser && params.get('flow') === 'recovery' && !callbackError) recoveringPassword = true;
        renderState();
        loadUserSessions();
      } else {
        renderState();
      }
      if (callbackError) {
        recoveringPassword = false;
        currentUser = null;
        renderState();
        setStatus(authMessage({ code: callbackError, message: 'O link de autenticação não pôde ser validado. Solicite outro link.' }), 'error');
      } else if (params.get('flow') === 'recovery' && !currentUser) {
        currentTab = 'reset'; renderState();
        setStatus('O link de recuperação não criou uma sessão válida. Solicite outro link.', 'error');
      }
    } catch (err) {
      if (accessRequested) setStatus(err.message || 'Erro ao inicializar Supabase', 'error');
    }
  }

  async function loginWithGoogle() {
    try {
      setStatus('Redirecionando para o Google...');
      const client = getClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl()
        }
      });
      if (error) throw error;
    } catch (err) {
      setStatus('Falha no login com Google: ' + err.message, 'error');
    }
  }

  async function loginWithEmail(email, password) {
    email = String(email || '').trim();
    if (pendingAuth.has('login')) return;
    if (!email || !password) {
      setStatus('Preencha e-mail e senha.', 'error');
      return;
    }
    busy('login', 'loginSubmit', true);
    try {
      setStatus('Autenticando...');
      const client = getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      accessRequested = true;
      setStatus('Login realizado com sucesso!', 'ok');
      renderState();
      loadUserSessions();
    } catch (err) {
      if (err.code === 'email_not_confirmed') {
        document.getElementById('confirmationEmail').value = email;
        currentTab = 'confirm'; renderState();
      }
      setStatus(authMessage(err), 'error');
    } finally { busy('login', 'loginSubmit', false); }
  }

  async function signUpWithEmail(name, email, password, confirmation = password) {
    if (signupBusy) return;
    name = String(name || '').trim();
    email = String(email || '').trim();
    if (name.length < 2) {
      setStatus('Informe seu nome ou indicativo com pelo menos 2 caracteres.', 'error'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Confira o formato do e-mail, por exemplo: nome@dominio.com.br.', 'error'); return;
    }
    if (password !== confirmation) { setStatus('As senhas precisam ser iguais.', 'error'); return; }
    if (!email || !password) {
      setStatus('Preencha e-mail e senha para cadastro.', 'error');
      return;
    }
    if (password.length < 6) {
      setStatus('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
    signupBusy = true;
    const submit = document.getElementById('signupSubmit');
    if (submit) { submit.disabled = true; submit.textContent = 'Criando conta...'; }
    try {
      setStatus('Criando conta...');
      const client = getClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: String(name || '').trim() || 'Operador' },
          emailRedirectTo: getRedirectUrl()
        }
      });
      if (error) throw error;
      if (data.session) {
        currentUser = data.user;
        accessRequested = true;
        setStatus('Conta criada e autenticada!', 'ok');
      } else {
        signupEmail = email;
        document.getElementById('confirmationEmail').value = email;
        resendAfter = Date.now() + 60000;
        document.getElementById('signupConfirmationEmail').textContent = email;
        currentTab = 'confirmation';
        setStatus('Confira seu e-mail para concluir o cadastro.', 'ok');
      }
      const form = document.getElementById('formSignup');
      if (form) form.reset();
      renderState();
      loadUserSessions();
    } catch (err) {
      setStatus(authMessage(err), 'error');
    } finally {
      signupBusy = false;
      if (submit) { submit.disabled = false; submit.textContent = 'Criar minha conta'; }
    }
  }

  async function resetPassword(email) {
    email = String(email || '').trim();
    if (pendingAuth.has('reset')) return;
    if (!validEmail(email)) {
      setStatus('Informe um e-mail válido para recuperação.', 'error');
      return;
    }
    if (Date.now() < resetAfter) { setStatus('Aguarde um minuto antes de solicitar outro link.', 'error'); return; }
    busy('reset', 'resetSubmit', true);
    try {
      setStatus('Enviando e-mail de recuperação...');
      const client = getClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl('recovery')
      });
      if (error) throw error;
      resetAfter = Date.now() + 60000;
      document.getElementById('resetSentEmail').textContent = email;
      currentTab = 'resetSent'; renderState();
      setStatus('Solicitação recebida. Se houver uma conta com esse e-mail, você receberá o link para definir uma nova senha.', 'ok');
    } catch (err) {
      setStatus(authMessage(err), 'error');
    } finally { busy('reset', 'resetSubmit', false); }
  }

  async function logout() {
    try {
      const client = getClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      currentUser = null;
      sessionsRequest++;
      document.getElementById('controllerCard').hidden = true;
      accessRequested = false;
      destination = 'dashboard';
      currentTab = 'login';
      recoveringPassword = false;
      document.getElementById('formLogin').reset();
      for (const role of ['controller', 'artifact', 'player']) localStorage.removeItem('airsoft-cloud-session-v1-' + role);
      setStatus('Sessão encerrada.');
      renderState();
    } catch (err) {
      setStatus('Erro ao sair: ' + err.message, 'error');
    }
  }

  // --- GAME SESSIONS & CONTROLLER PROTECTION ---

  function access(target = 'dashboard') {
    accessRequested = true;
    destination = target;
    renderState();
    if (currentUser && target === 'dashboard') loadUserSessions();
    if (currentUser && target === 'registration') window.PreRegistration?.openRegistration();
  }

  function openModule(page) {
    const url = new URL(page, window.location.href);
    const params = new URLSearchParams(window.location.search);
    if (params.has('android')) url.searchParams.set('android', params.get('android'));
    window.location.href = url.href;
  }

  function home() {
    accessRequested = false;
    destination = 'dashboard';
    currentTab = 'login';
    setStatus('');
    renderState();
  }

  function menu() {
    recoveringPassword = false;
    currentTab = 'login';
    setStatus('');
    access();
  }

  function newRegistration() {
    const form = document.getElementById('preRegistrationForm');
    form.reset();
    form.elements.email.value = currentUser?.email || '';
    form.elements.name.value = currentUser?.user_metadata?.full_name || '';
    form.querySelector('button[type="submit"]').disabled = false;
    document.getElementById('preRegistrationTitle').textContent = 'Inscrição antecipada';
    document.getElementById('preRegistrationStatus').textContent = '';
    document.getElementById('registrationNextActions').hidden = true;
    access('registration');
  }

  async function loadWaitlistEvents() {
    const list = document.getElementById('myWaitlistEvents');
    if (!list || !currentUser) return;
    const ownerId = currentUser.id;
    list.textContent = 'Consultando inscrições...';
    try {
      const { data, error } = await getClient().rpc('my_waitlist_events');
      if (currentUser?.id !== ownerId) return;
      if (error) throw error;
      list.textContent = '';
      if (!data?.length) { list.textContent = 'Você ainda não está na lista de espera de nenhum evento.'; return; }
      for (const event of data) {
        const card = document.createElement('div');
        card.className = 'sessionCard';
        const label = document.createElement('span');
        label.textContent = `${event.operation_name} | ${event.join_code} | ${event.event_status === 'running' ? 'Em andamento' : event.event_status === 'finished' ? 'Encerrado' : 'Lista de espera'}`;
        const enter = document.createElement('button');
        enter.type = 'button'; enter.className = 'btnSecondary'; enter.textContent = 'Participar';
        enter.disabled = event.event_status === 'finished';
        enter.addEventListener('click', () => joinGameSession(event.join_code, 'player'));
        card.append(label, enter); list.append(card);
      }
    } catch (error) { if (currentUser?.id === ownerId) list.textContent = 'Não foi possível consultar seus eventos: ' + error.message; }
  }

  async function archiveGame(session) {
    if (session.status === 'running') { setStatus('Encerre a partida antes de arquivar.', 'error'); return; }
    if (!confirm('Arquivar esta partida e liberar uma das 3 vagas?')) return;
    const { error } = await getClient().from('game_sessions').update({ status: 'archived', registration_open: false, updated_at: new Date().toISOString() }).eq('id', session.id);
    if (error) { setStatus(error.message, 'error'); return; }
    await loadUserSessions();
  }

  async function finishGame(session) {
    if (!currentUser || session.status === 'finished' || session.status === 'archived') return;
    if (!confirm('Encerrar este jogo? Os cronômetros e as inscrições serão encerrados.')) return;
    try {
      const client = getClient();
      const snapshot = await client.from('game_sessions').select('state').eq('id', session.id).eq('controller_id', currentUser.id).single();
      if (snapshot.error) throw snapshot.error;
      const state = { ...snapshot.data.state, running: false, finished: true,
        bombState: 'Fim de jogo', phase: 'Encerrado pelo Controlador', winner: 'Sem vencedor',
        pending: null, operation: null, bombSeconds: null };
      const result = await client.from('game_sessions').update({ state, status: 'finished',
        registration_open: false, updated_at: new Date().toISOString() }).eq('id', session.id).eq('controller_id', currentUser.id);
      if (result.error) throw result.error;
      setStatus('Jogo encerrado. Você pode iniciar outra partida. Arquive este jogo para liberar uma das 3 vagas.', 'ok');
      await loadUserSessions();
    } catch (error) { setStatus('Não foi possível encerrar o jogo: ' + error.message, 'error'); }
  }

  async function updatePassword(password, confirmation) {
    if (pendingAuth.has('password')) return;
    if (!recoveringPassword || !currentUser) {
      setStatus('Abra o link de recuperacao enviado por e-mail.', 'error');
      return;
    }
    if (password.length < 6 || password !== confirmation) {
      setStatus('Use pelo menos 6 caracteres e confirme a mesma senha.', 'error');
      return;
    }
    const button = document.querySelector('#formNewPassword button');
    if (button) button.disabled = true;
    pendingAuth.add('password');
    try {
      const { error } = await getClient().auth.updateUser({ password });
      if (error) throw error;
      recoveringPassword = false;
      if (window.history?.replaceState) window.history.replaceState(null, '', getRedirectUrl());
      document.getElementById('formNewPassword').reset();
      renderState();
      setStatus('Senha atualizada com sucesso.', 'ok');
      await loadUserSessions();
    } catch (err) {
      setStatus(authMessage(err), 'error');
    } finally {
      if (button) button.disabled = false;
      pendingAuth.delete('password');
    }
  }

  async function createGameSession(operationName) {
    if (!currentUser || recoveringPassword) { access(); return; }
    const cleanName = (operationName || '').trim();
    if (cleanName.length < 3) {
      setStatus('Informe o nome da operação (mínimo 3 letras).', 'error');
      return;
    }
    try {
      setStatus('Criando sala de operação...');
      const client = getClient();
      const initialState = {
        operationName: cleanName,
        running: false,
        finished: false,
        gameSeconds: 1080,
        mode: 'Bomba clássica'
      };

      const result = await client.rpc('create_game_session', { initial_state: initialState });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;

      // Save connection for Controller role
      const connection = {
        sessionId: row.session_id,
        joinCode: row.join_code,
        memberId: null,
        role: 'controller',
        operationName: cleanName
      };
      localStorage.setItem('airsoft-cloud-session-v1-controller', JSON.stringify(connection));

      setStatus('Sala criada com sucesso! Abrindo Controle...', 'ok');
      openModule('controle.html');
    } catch (err) {
      setStatus('Erro ao criar sala: ' + err.message, 'error');
    }
  }

  async function joinGameSession(code, role) {
    if (!currentUser || recoveringPassword) { access(); return; }
    if (!['controller', 'artifact', 'player'].includes(role)) {
      setStatus('Selecione um modulo valido.', 'error');
      return;
    }
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setStatus('Digite o código de 6 caracteres da sala.', 'error');
      return;
    }
    try {
      setStatus('Verificando permissão e entrando na sala...');
      const client = getClient();
      const deviceKey = 'airsoft-cloud-device-v1-' + role;
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = role + '-' + crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const name = role === 'controller' ? 'Controlador Web' : role === 'artifact' ? 'Artefato Notebook' : 'Jogador Web';

      const result = role === 'controller'
        ? await client.rpc('rejoin_game_as_controller', { requested_code: cleanCode })
        : await client.rpc('join_game', {
        requested_code: cleanCode,
        requested_device_id: deviceId,
        requested_role: role,
        requested_name: name,
        requested_metadata: { platform: 'web-portal', appVersion: '0.7.0' }
      });

      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;

      if (!row || !row.session_id || (role !== 'controller' && !row.member_id)) {
        throw new Error('A sala nao retornou uma conexao valida.');
      }

      const connection = {
        sessionId: row.session_id,
        joinCode: cleanCode,
        memberId: row.member_id || null,
        role: role,
        operationName: (row.session_state && row.session_state.operationName) || 'OPERAÇÃO'
      };

      const storageKey = 'airsoft-cloud-session-v1-' + role;
      localStorage.setItem(storageKey, JSON.stringify(connection));
      if (role === 'player' && window.PreRegistration) await window.PreRegistration.preparePlayer(row.session_id);

      setStatus('Conectado! Redirecionando...', 'ok');
      const targetPage = role === 'controller' ? 'controle.html' : role === 'artifact' ? 'bomba.html' : 'jogador.html';
      openModule(targetPage);
    } catch (err) {
      setStatus(err.message || 'Falha ao entrar na sala', 'error');
    }
  }

  async function loadUserSessions() {
    const listEl = document.getElementById('mySessionsList');
    if (!listEl || !currentUser) return;
    loadWaitlistEvents();
    const request = ++sessionsRequest;
    const ownerId = currentUser.id;
    const controllerCard = document.getElementById('controllerCard');
    const status = document.getElementById('sessionsStatus');
    if (controllerCard) controllerCard.hidden = true;
    if (status) status.textContent = 'Consultando suas partidas...';
    try {
      const client = getClient();
      const { data, error } = await client
        .from('game_sessions')
        .select('id, join_code, status, state, created_at')
        .eq('controller_id', ownerId)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(100);

      if (request !== sessionsRequest || currentUser?.id !== ownerId) return;
      if (error) throw error;
      if (status) status.textContent = '';
      if (!data || data.length === 0) {
        listEl.innerHTML = '<p class="muted">Nenhuma operação ativa criada por você no momento.</p>';
        return;
      }

      if (controllerCard) controllerCard.hidden = false;
      listEl.innerHTML = '';
      data.forEach(session => {
        const name = (session.state && session.state.operationName) || 'OPERAÇÃO';
        const card = document.createElement('div');
        card.className = 'sessionCard';
        const details = document.createElement('div');
        const heading = document.createElement('h3');
        heading.textContent = name;
        const description = document.createElement('small');
        description.className = 'muted';
        description.textContent = `Código: ${session.join_code} | ${session.status === 'running' ? 'Em andamento' : session.status === 'finished' ? 'Encerrado' : 'Preparação / lista de espera'}`;
        details.append(heading, description);
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:6px;';
        for (const [role, label] of [['controller', 'Controle'], ['artifact', 'Bomba']]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btnSecondary';
          button.textContent = label;
          button.addEventListener('click', async () => {
            button.disabled = true;
            try { await rejoinSession(session.id, session.join_code, name, role); }
            finally { button.disabled = false; }
          });
          actions.append(button);
        }
        const organize = document.createElement('button');
        organize.type = 'button';
        organize.className = 'btnSecondary';
        organize.textContent = 'Lista de espera';
        organize.addEventListener('click', () => {
          destination = 'organizer';
          renderState();
          window.PreRegistration?.openOrganizer(session);
        });
        actions.append(organize);
        if (session.status !== 'finished') {
          const finish = document.createElement('button');
          finish.type = 'button'; finish.className = 'btnDanger'; finish.textContent = 'Encerrar jogo';
          finish.addEventListener('click', async () => {
            finish.disabled = true;
            try { await finishGame(session); } finally { finish.disabled = false; }
          });
          actions.append(finish);
        }
        const archive = document.createElement('button');
        archive.type = 'button'; archive.className = 'btnSecondary'; archive.textContent = 'Arquivar';
        archive.disabled = session.status === 'running';
        archive.addEventListener('click', () => archiveGame(session));
        actions.append(archive);
        card.append(details, actions);
        listEl.append(card);
      });
    } catch (err) {
      if (request !== sessionsRequest || currentUser?.id !== ownerId) return;
      if (status) status.textContent = 'Não foi possível consultar suas partidas. Acesse o painel novamente para tentar.';
      listEl.innerHTML = `<p class="muted" style="color:var(--portal-error);">Não foi possível carregar suas salas: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function rejoinSession(sessionId, joinCode, operationName, role) {
    await joinGameSession(joinCode, role);
  }

  // --- UI RENDER & TABS ---

  function renderState() {
    const authBox = document.getElementById('authSection');
    const dashboardBox = document.getElementById('dashboardSection');
    const userBadge = document.getElementById('userBadge');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const recoveryBox = document.getElementById('passwordRecoverySection');
    const welcome = document.getElementById('welcomeSection');
    if (welcome) welcome.hidden = accessRequested || recoveringPassword;
    for (const id of ['preRegistrationSection', 'organizerSection']) {
      const section = document.getElementById(id);
      if (section) section.hidden = true;
    }
    if (recoveryBox) recoveryBox.hidden = !recoveringPassword;
    if (recoveringPassword) {
      if (authBox) authBox.hidden = true;
      if (dashboardBox) dashboardBox.hidden = true;
      if (userBadge) userBadge.hidden = true;
      return;
    }
    if (!accessRequested) {
      if (authBox) authBox.hidden = true;
      if (dashboardBox) dashboardBox.hidden = true;
      if (userBadge) userBadge.hidden = true;
      return;
    }

    if (currentUser) {
      if (authBox) authBox.hidden = true;
      if (dashboardBox) dashboardBox.hidden = destination !== 'dashboard';
      const target = document.getElementById(destination === 'registration' ? 'preRegistrationSection' : 'organizerSection');
      if (target && destination !== 'dashboard') target.hidden = false;
      if (destination === 'registration') setTimeout(() => {
        if (currentUser && destination === 'registration') window.PreRegistration?.openRegistration();
      }, 0);
      if (userBadge) {
        userBadge.hidden = false;
        const name = currentUser.user_metadata?.full_name || currentUser.email || 'Operador';
        const initial = name.charAt(0).toUpperCase();
        if (userAvatar) userAvatar.textContent = initial;
        if (userName) userName.textContent = name;
        if (userEmail) userEmail.textContent = currentUser.email || 'autenticado';
      }
    } else {
      if (authBox) authBox.hidden = false;
      if (dashboardBox) dashboardBox.hidden = true;
      if (userBadge) userBadge.hidden = true;
      renderAuthTab();
    }
  }

  function renderAuthTab() {
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabSignup = document.getElementById('tabSignupBtn');
    const tabReset = document.getElementById('tabResetBtn');
    const tabConfirm = document.getElementById('tabConfirmBtn');

    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');
    const formReset = document.getElementById('formReset');
    const confirmation = document.getElementById('signupConfirmation');
    if (confirmation) confirmation.hidden = currentTab !== 'confirmation';
    document.getElementById('formConfirmation').hidden = currentTab !== 'confirm';
    document.getElementById('resetSent').hidden = currentTab !== 'resetSent';

    if (tabLogin) tabLogin.classList.toggle('active', currentTab === 'login');
    if (tabSignup) tabSignup.classList.toggle('active', currentTab === 'signup');
    if (tabReset) tabReset.classList.toggle('active', currentTab === 'reset');
    if (tabConfirm) tabConfirm.classList.toggle('active', currentTab === 'confirm');

    if (formLogin) formLogin.hidden = currentTab !== 'login';
    if (formSignup) formSignup.hidden = currentTab !== 'signup';
    if (formReset) formReset.hidden = currentTab !== 'reset';
  }

  function switchAuthTab(tab) {
    if (tab === 'reset') document.getElementById('resetEmail').value = document.getElementById('loginEmail').value || signupEmail || document.getElementById('resetEmail').value || '';
    if (tab === 'login' && signupEmail) document.getElementById('loginEmail').value = signupEmail;
    currentTab = tab;
    setStatus('');
    renderAuthTab();
    if (tab === 'signup') signupStep(1);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return {
    back: () => {
      if (recoveringPassword) return true;
      if (!accessRequested) return false;
      if (currentUser && destination !== 'dashboard') menu();
      else if (!currentUser && currentTab !== 'login') switchAuthTab('login');
      else home();
      return true;
    },
    signupStep,
    resendConfirmation,
    access,
    home,
    menu,
    newRegistration,
    finishGame,
    getClient,
    getUser: () => currentUser,
    initAuth,
    switchAuthTab,
    loginWithGoogle,
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    logout,
    createGameSession,
    joinGameSession,
    rejoinSession,
    loadUserSessions
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  AirsoftPortal.initAuth();
});
