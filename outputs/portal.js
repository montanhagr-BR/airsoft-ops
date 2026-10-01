const AirsoftPortal = (() => {
  const config = window.AIRSOFT_SUPABASE_CONFIG || {};
  let supabase = null;
  let currentUser = null;
  let currentTab = 'login'; // 'login', 'signup', 'reset'

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
    return window.location.origin + window.location.pathname;
  }

  // --- AUTHENTICATION FUNCTIONS ---

  async function initAuth() {
    try {
      const client = getClient();

      // Listen to auth state changes (including Google OAuth redirect)
      client.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        renderState();
        if (currentUser && event === 'SIGNED_IN') {
          setStatus('Autenticado com sucesso!', 'ok');
          loadUserSessions();
        }
      });

      const sessionResponse = await client.auth.getSession();
      if (sessionResponse.data && sessionResponse.data.session) {
        currentUser = sessionResponse.data.session.user;
        renderState();
        loadUserSessions();
      } else {
        renderState();
      }
    } catch (err) {
      setStatus(err.message || 'Erro ao inicializar Supabase', 'error');
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
          data: { full_name: name || 'Operador' }
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
      await client.auth.signOut();
      currentUser = null;
      setStatus('Sessão encerrada.');
      renderState();
    } catch (err) {
      setStatus('Erro ao sair: ' + err.message, 'error');
    }
  }

  // --- GAME SESSIONS & CONTROLLER PROTECTION ---

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
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setStatus('Digite o código de 6 caracteres da sala.', 'error');
      return;
    }
    try {
      setStatus('Verificando permissão e entrando na sala...');
      const client = getClient();
      const deviceId = role + '-' + crypto.randomUUID();
      const name = role === 'controller' ? 'Controlador Web' : role === 'artifact' ? 'Artefato Notebook' : 'Jogador Web';

      const result = await client.rpc('join_game', {
        requested_code: cleanCode,
        requested_device_id: deviceId,
        requested_role: role,
        requested_name: name,
        requested_metadata: { platform: 'web-portal', appVersion: '0.7.0' }
      });

      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;

      // Controller protection check
      if (role === 'controller' && row.created_by) {
        if (!currentUser || currentUser.id !== row.created_by) {
          throw new Error('Apenas o criador/proprietário desta sala tem permissão de Controle.');
        }
      }

      const connection = {
        sessionId: row.session_id,
        joinCode: cleanCode,
        memberId: row.member_id,
        role: role,
        operationName: (row.session_state && row.session_state.operationName) || 'OPERAÇÃO'
      };

      const storageKey = 'airsoft-cloud-session-v1-' + role;
      localStorage.setItem(storageKey, JSON.stringify(connection));

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
    try {
      const client = getClient();
      const { data, error } = await client
        .from('game_sessions')
        .select('id, join_code, status, state, created_at')
        .eq('created_by', currentUser.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) {
        listEl.innerHTML = '<p class="muted">Nenhuma operação ativa criada por você no momento.</p>';
        return;
      }

      listEl.innerHTML = data.map(session => {
        const name = (session.state && session.state.operationName) || 'OPERAÇÃO';
        return `
          <div class="sessionCard">
            <div>
              <h3>${escapeHtml(name)}</h3>
              <small class="muted">Código: <code>${session.join_code}</code> · Status: ${session.status}</small>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btnSecondary" onclick="AirsoftPortal.rejoinSession('${session.id}', '${session.join_code}', '${escapeHtml(name)}', 'controller')">Controle</button>
              <button class="btnSecondary" onclick="AirsoftPortal.rejoinSession('${session.id}', '${session.join_code}', '${escapeHtml(name)}', 'artifact')">Artefato</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<p class="muted" style="color:var(--portal-error);">Não foi possível carregar suas salas: ${escapeHtml(err.message)}</p>`;
    }
  }

  function rejoinSession(sessionId, joinCode, operationName, role) {
    const connection = { sessionId, joinCode, memberId: null, role, operationName };
    localStorage.setItem('airsoft-cloud-session-v1-' + role, JSON.stringify(connection));
    const targetPage = role === 'controller' ? 'controle.html' : 'bomba.html';
    window.location.href = targetPage;
  }

  // --- UI RENDER & TABS ---

  function renderState() {
    const authBox = document.getElementById('authSection');
    const dashboardBox = document.getElementById('dashboardSection');
    const userBadge = document.getElementById('userBadge');

    if (currentUser) {
      if (authBox) authBox.hidden = true;
      if (dashboardBox) dashboardBox.hidden = false;
      if (userBadge) {
        userBadge.hidden = false;
        const name = currentUser.user_metadata?.full_name || currentUser.email || 'Operador';
        const initial = name.charAt(0).toUpperCase();
        userBadge.querySelector('.userAvatar').textContent = initial;
        userBadge.querySelector('.userInfo b').textContent = name;
        userBadge.querySelector('.userInfo small').textContent = currentUser.email || 'Sessão ativa';
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
    initAuth,
    switchAuthTab,
    loginWithGoogle,
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
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
