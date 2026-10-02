const AirsoftPortal = (() => {
  const config = window.AIRSOFT_SUPABASE_CONFIG || {};
  let supabase = null;
  let currentUser = null;
  let recoveringPassword = false;
  let accessRequested = false;
  let destination = 'dashboard';
  let currentTab = 'login'; // 'login', 'signup', 'reset'
  let sessionsRequest = 0;

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

  function getRedirectUrl() {
    const url = new URL(window.location.protocol === 'file:'
      ? (config.webRedirectUrl || 'https://warm-hummingbird-8988f6.netlify.app/')
      : window.location.href);
    if (destination === 'registration') url.searchParams.set('flow', 'registration');
    return url.origin + url.pathname + url.search;
  }

  // --- AUTHENTICATION FUNCTIONS ---

  async function initAuth() {
    try {
      const client = getClient();

      // Listen to auth state changes (including Google OAuth redirect)
      client.auth.onAuthStateChange((event, session) => {
        currentUser = session && !session.user.is_anonymous ? session.user : null;
        if (event === 'PASSWORD_RECOVERY') { recoveringPassword = true; accessRequested = true; }
        if (event === 'SIGNED_OUT') recoveringPassword = false;
        renderState();
        if (currentUser && event === 'SIGNED_IN') {
          setStatus('Autenticado com sucesso!', 'ok');
          setTimeout(() => loadUserSessions(), 0);
        }
      });

      const sessionResponse = await client.auth.getSession();
      if (sessionResponse.data && sessionResponse.data.session) {
        currentUser = sessionResponse.data.session.user.is_anonymous ? null : sessionResponse.data.session.user;
        renderState();
        loadUserSessions();
      } else {
        renderState();
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
    if (!email || !password) {
      setStatus('Preencha e-mail e senha.', 'error');
      return;
    }
    try {
      setStatus('Autenticando...');
      const client = getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      setStatus('Login realizado com sucesso!', 'ok');
      renderState();
      loadUserSessions();
    } catch (err) {
      setStatus('Erro de autenticação: ' + err.message, 'error');
    }
  }

  async function signUpWithEmail(name, email, password) {
    if (!email || !password) {
      setStatus('Preencha e-mail e senha para cadastro.', 'error');
      return;
    }
    if (password.length < 6) {
      setStatus('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
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
        setStatus('Conta criada e autenticada!', 'ok');
      } else {
        setStatus('Conta criada! Se necessário, confirme o e-mail cadastrado.', 'ok');
      }
      renderState();
      loadUserSessions();
    } catch (err) {
      setStatus('Erro no cadastro: ' + err.message, 'error');
    }
  }

  async function resetPassword(email) {
    if (!email) {
      setStatus('Informe o e-mail para recuperação.', 'error');
      return;
    }
    try {
      setStatus('Enviando e-mail de recuperação...');
      const client = getClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl()
      });
      if (error) throw error;
      setStatus('Instruções enviadas para seu e-mail.', 'ok');
    } catch (err) {
      setStatus('Erro na recuperação: ' + err.message, 'error');
    }
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

  function home() {
    accessRequested = false;
    destination = 'dashboard';
    currentTab = 'login';
    setStatus('');
    renderState();
  }

  async function updatePassword(password, confirmation) {
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
    try {
      const { error } = await getClient().auth.updateUser({ password });
      if (error) throw error;
      recoveringPassword = false;
      document.getElementById('formNewPassword').reset();
      renderState();
      setStatus('Senha atualizada com sucesso.', 'ok');
      await loadUserSessions();
    } catch (err) {
      setStatus('Erro ao atualizar senha: ' + err.message, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function createGameSession(operationName) {
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
      window.location.href = 'controle.html';
    } catch (err) {
      setStatus('Erro ao criar sala: ' + err.message, 'error');
    }
  }

  async function joinGameSession(code, role) {
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
      window.location.href = targetPage;
    } catch (err) {
      setStatus(err.message || 'Falha ao entrar na sala', 'error');
    }
  }

  async function loadUserSessions() {
    const listEl = document.getElementById('mySessionsList');
    if (!listEl || !currentUser) return;
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
        .limit(5);

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
        description.textContent = `Codigo: ${session.join_code} | Status: ${session.status}`;
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
        organize.textContent = 'Inscrições';
        organize.addEventListener('click', () => {
          destination = 'organizer';
          renderState();
          window.PreRegistration?.openOrganizer(session);
        });
        actions.append(organize);
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
      if (destination === 'registration') window.PreRegistration?.openRegistration();
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

    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');
    const formReset = document.getElementById('formReset');

    if (tabLogin) tabLogin.classList.toggle('active', currentTab === 'login');
    if (tabSignup) tabSignup.classList.toggle('active', currentTab === 'signup');
    if (tabReset) tabReset.classList.toggle('active', currentTab === 'reset');

    if (formLogin) formLogin.hidden = currentTab !== 'login';
    if (formSignup) formSignup.hidden = currentTab !== 'signup';
    if (formReset) formReset.hidden = currentTab !== 'reset';
  }

  function switchAuthTab(tab) {
    currentTab = tab;
    setStatus('');
    renderAuthTab();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return {
    access,
    home,
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
  const params = new URLSearchParams(window.location.search);
  if (params.has('registration') || params.get('flow') === 'registration') AirsoftPortal.access('registration');
  else if (window.location.hash.includes('access_token') || params.has('code')) AirsoftPortal.access();
});
