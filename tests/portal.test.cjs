const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

function fixture(user = { id: 'owner', email: 'owner@example.com' }) {
  const nodes = new Map();
  const storage = new Map();
  const calls = [];
  let listener;
  const element = () => ({ hidden: false, textContent: '', dataset: {}, style: {}, children: [],
    classList: { toggle() {} }, append(...children) { this.children.push(...children); },
    addEventListener(type, callback) { this[type] = callback; }, reset() {}, reportValidity() { return true; } });
  const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element, querySelector: element, addEventListener() {} };
  const query = { select() { return this; }, eq(column) { calls.push(['filter', column]); return this; },
    neq() { return this; }, order() { return this; }, async limit() {
      return { data: [{ id: 'room', join_code: 'ABC123', status: 'setup', state: { operationName: "D'Agua <teste>" } }] };
    } };
  const client = { auth: { onAuthStateChange(callback) { listener = callback; },
    async getSession() { return { data: { session: user ? { user } : null } }; },
    async updateUser(data) { calls.push(['password', data]); return { error: null }; },
    async signOut() { return { error: null }; } }, from() { return query; },
    async rpc(name, args) { calls.push([name, args]); return { data: [{ session_id: 'room',
      member_id: name === 'join_game' ? 'member' : undefined, session_state: { operationName: 'Operation' } }] }; } };
  const context = vm.createContext({ document, URL, URLSearchParams,
    window: { AIRSOFT_SUPABASE_CONFIG: { url: 'test', publishableKey: 'test' },
      location: { origin: 'https://example.com', pathname: '/', search: '', href: 'https://example.com/' },
      supabase: { createClient() { return client; } }, PreRegistration: { openRegistration() {},
        async preparePlayer() { storage.set('airsoft-player-id-v1', 'P-' + user.id); } } },
    localStorage: { getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
    crypto: { randomUUID() { return 'device'; } }, setTimeout(callback) { callback(); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../outputs/portal.js'), 'utf8') + '\nglobalThis.api = AirsoftPortal;', context);
  return { api: context.api, context, nodes, storage, calls, client, auth: (...args) => listener(...args) };
}

(async () => {
  // Verify the real HTML contract; the DOM fixture alone accepts nonexistent IDs.
  const html = fs.readFileSync(path.join(__dirname, '../outputs/index.html'), 'utf8');
  for (const script of ['portal.js', 'pre-registration.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../outputs', script), 'utf8');
    for (const match of source.matchAll(/(?:getElementById|byId)\('([^']+)'\)/g)) {
      assert.ok(html.includes(`id="${match[1]}"`), `Missing HTML element: ${match[1]}`);
    }
    assert.ok(html.includes(`src="${script}`));
  }
  const f = fixture();
  await f.api.initAuth();
  assert.equal(f.nodes.get('welcomeSection').hidden, false);
  assert.equal(f.nodes.get('authSection').hidden, true);
  f.api.access();
  assert.equal(f.nodes.get('dashboardSection').hidden, false);
  await f.api.loadUserSessions();
  assert.equal(f.nodes.get('controllerCard').hidden, false);
  assert.ok(f.calls.some(c => c[0] === 'filter' && c[1] === 'controller_id'));
  const card = f.nodes.get('mySessionsList').children.at(-1);
  assert.equal(card.children[0].children[0].textContent, "D'Agua <teste>");
  await f.api.rejoinSession('room', 'ABC123', "D'Agua", 'artifact');
  assert.equal(JSON.parse(f.storage.get('airsoft-cloud-session-v1-artifact')).memberId, 'member');
  await f.api.joinGameSession('ABC123', 'artifact');
  const devices = f.calls.filter(c => c[0] === 'join_game').map(c => c[1].requested_device_id);
  assert.equal(devices[0], devices[1]);
  await f.api.joinGameSession('ABC123', 'controller');
  assert.ok(f.calls.some(c => c[0] === 'rejoin_game_as_controller'));
  await f.api.joinGameSession('ABC123', 'player');
  assert.equal(f.storage.get('airsoft-player-id-v1'), 'P-owner');
  f.api.access('registration');
  assert.equal(f.nodes.get('preRegistrationSection').hidden, false);
  f.auth('PASSWORD_RECOVERY', { user: { id: 'owner' } });
  assert.equal(f.nodes.get('passwordRecoverySection').hidden, false);
  await f.api.updatePassword('abcdef', 'wrong');
  assert.equal(f.calls.filter(c => c[0] === 'password').length, 0);
  await f.api.updatePassword('abcdef', 'abcdef');
  assert.equal(f.calls.filter(c => c[0] === 'password').length, 1);
  const rpc = f.client.rpc;
  f.client.rpc = async () => ({ error: { message: 'Only the room owner can open control' } });
  f.context.window.location.href = 'unchanged';
  await f.api.joinGameSession('ABC123', 'controller');
  assert.equal(f.context.window.location.href, 'unchanged');
  f.client.rpc = rpc;
  await f.api.logout();
  assert.equal(f.storage.get('airsoft-cloud-session-v1-artifact'), undefined);
  assert.equal(f.nodes.get('welcomeSection').hidden, false);
  assert.equal(f.nodes.get('authSection').hidden, true);
  assert.equal(f.nodes.get('controllerCard').hidden, true);
  const anonymous = fixture({ id: 'guest', is_anonymous: true });
  await anonymous.api.initAuth();
  anonymous.api.access();
  assert.equal(anonymous.api.getUser(), null);
  assert.equal(anonymous.nodes.get('authSection').hidden, false);
  await anonymous.api.joinGameSession('ABC123', 'controller');
  await anonymous.api.createGameSession('Operation');
  assert.equal(anonymous.calls.filter(c => c[0] === 'rejoin_game_as_controller' || c[0] === 'create_game_session').length, 0);
  const android = fixture();
  await android.api.initAuth();
  android.context.window.location.search = '?android=1';
  await android.api.joinGameSession('ABC123', 'artifact');
  assert.equal(new URL(android.context.window.location.href).searchParams.get('android'), '1');
  const login = fixture(null);
  await login.api.initAuth();
  assert.equal(login.nodes.get('welcomeSection').hidden, false);
  assert.equal(login.nodes.get('authSection').hidden, true);
  login.api.access();
  assert.equal(login.nodes.get('authSection').hidden, false);
  login.api.switchAuthTab('signup');
  assert.equal(login.nodes.get('formSignup').hidden, false);
  assert.equal(login.nodes.get('formLogin').hidden, true);
  assert.equal(login.nodes.get('signupProfile').hidden, false);
  login.api.signupStep(2);
  assert.equal(login.nodes.get('signupCredentials').hidden, false);
  assert.equal(login.nodes.get('signupProfile').hidden, true);
  login.api.home();
  assert.equal(login.nodes.get('welcomeSection').hidden, false);
  login.api.access();
  assert.equal(login.nodes.get('formLogin').hidden, false);
  let signupOptions;
  login.client.auth.signUp = async options => { signupOptions = options; return { data: { session: null } }; };
  await login.api.signUpWithEmail('Operador', 'test@example.com', 'abcdef', 'different');
  assert.equal(signupOptions, undefined);
  await login.api.signUpWithEmail('Operador', 'invalid', 'abcdef');
  assert.equal(signupOptions, undefined);
  await login.api.signUpWithEmail('Operador', 'test@example.com', '123');
  assert.equal(signupOptions, undefined);
  await login.api.signUpWithEmail('Operador', 'test@example.com', 'abcdef');
  assert.equal(signupOptions.options.emailRedirectTo, 'https://example.com/?flow=dashboard');
  assert.equal(login.nodes.get('signupConfirmation').hidden, false);
  assert.equal(login.nodes.get('formSignup').hidden, true);
  assert.equal(login.nodes.get('signupConfirmationEmail').textContent, 'test@example.com');
  assert.equal(login.nodes.get('signupSubmit').disabled, false);
  signupOptions = undefined;
  await login.api.signUpWithEmail('Gabriel', 'gabriel@aem.ms.gov.br', 'abcdef', 'abcdef');
  assert.equal(signupOptions.email, 'gabriel@aem.ms.gov.br');
  signupOptions = undefined;
  await login.api.signUpWithEmail('', 'gabriel@aem.ms.gov.br', 'abcdef', 'abcdef');
  assert.equal(signupOptions, undefined);
  assert.match(login.nodes.get('portalStatus').textContent, /nome ou indicativo/);
  let resent = false;
  login.client.auth.resend = async () => { resent = true; return { error: null }; };
  await login.api.resendConfirmation();
  assert.equal(resent, false);
  const instant = fixture(null);
  await instant.api.initAuth();
  instant.client.auth.signUp = async () => ({ data: { session: { user: { id: 'new' } }, user: { id: 'new' } } });
  await instant.api.signUpWithEmail('New operator', 'new@example.com', 'abcdef', 'abcdef');
  assert.equal(instant.nodes.get('dashboardSection').hidden, false);
  login.api.switchAuthTab('reset');
  assert.equal(login.nodes.get('formReset').hidden, false);
  let resetOptions;
  login.context.window.location.href = 'file:///C:/app/index.html';
  login.context.window.location.protocol = 'file:';
  login.client.auth.resetPasswordForEmail = async (email, options) => { resetOptions = options; return { error: null }; };
  await login.api.resetPassword('test@example.com');
  assert.equal(resetOptions.redirectTo, 'https://warm-hummingbird-8988f6.netlify.app/?flow=recovery');
  assert.equal(login.nodes.get('resetSent').hidden, false);
  assert.equal(login.nodes.get('resetSentEmail').textContent, 'test@example.com');
  login.api.switchAuthTab('login');
  login.client.auth.signInWithPassword = async () => ({ error: { message: 'Invalid login credentials' } });
  await login.api.loginWithEmail('test@example.com', 'wrong');
  assert.equal(login.nodes.get('dashboardSection').hidden, true);
  assert.match(login.nodes.get('portalStatus').textContent, /E-mail ou senha incorretos/);
  login.client.auth.signInWithPassword = async () => ({ error: { code: 'email_not_confirmed' } });
  await login.api.loginWithEmail('gabriel@aem.ms.gov.br', 'abcdef');
  assert.equal(login.nodes.get('formConfirmation').hidden, false);
  assert.equal(login.nodes.get('confirmationEmail').value, 'gabriel@aem.ms.gov.br');
  login.client.auth.signInWithPassword = async () => ({ data: { user: { id: 'owner' } } });
  await login.api.loginWithEmail('test@example.com', 'abcdef');
  assert.equal(login.nodes.get('dashboardSection').hidden, false);
  login.client.from = () => ({ select() { return this; }, eq() { return this; }, neq() { return this; }, order() { return this; }, async limit() { return { data: [] }; } });
  await login.api.loadUserSessions();
  assert.equal(login.nodes.get('controllerCard').hidden, true);
  const recovery = fixture();
  recovery.context.window.location.search = '?flow=recovery';
  await recovery.api.initAuth();
  assert.equal(recovery.nodes.get('passwordRecoverySection').hidden, false);
  assert.equal(recovery.nodes.get('dashboardSection').hidden, true);
  await recovery.api.updatePassword('new-secret', 'new-secret');
  assert.equal(recovery.nodes.get('dashboardSection').hidden, false);
  const expired = fixture();
  expired.context.window.location.search = '?flow=recovery';
  expired.context.window.location.hash = '#error=access_denied&error_code=otp_expired';
  await expired.api.initAuth();
  assert.equal(expired.nodes.get('formReset').hidden, false);
  assert.equal(expired.nodes.get('passwordRecoverySection').hidden, true);
  assert.match(expired.nodes.get('portalStatus').textContent, /expirou/);
  await expired.api.updatePassword('new-secret', 'new-secret');
  assert.equal(expired.calls.filter(c => c[0] === 'password').length, 0);
  const resend = fixture(null);
  await resend.api.initAuth();
  resend.api.access();
  resend.api.switchAuthTab('confirm');
  resend.context.document.getElementById('confirmationEmail').value = 'gabriel@aem.ms.gov.br';
  let resendOptions;
  resend.client.auth.resend = async options => { resendOptions = options; return { error: null }; };
  await resend.api.resendConfirmation();
  assert.equal(resendOptions.email, 'gabriel@aem.ms.gov.br');
  assert.equal(resendOptions.type, 'signup');
  const duplicate = fixture(null);
  await duplicate.api.initAuth();
  let resolveLogin;
  let loginCount = 0;
  duplicate.client.auth.signInWithPassword = () => { loginCount++; return new Promise(resolve => { resolveLogin = resolve; }); };
  const firstLogin = duplicate.api.loginWithEmail('test@example.com', 'abcdef');
  await duplicate.api.loginWithEmail('test@example.com', 'abcdef');
  assert.equal(loginCount, 1);
  assert.equal(duplicate.nodes.get('loginSubmit').disabled, true);
  resolveLogin({ error: { code: 'invalid_credentials' } });
  await firstLogin;
  assert.equal(duplicate.nodes.get('loginSubmit').disabled, false);
  const missingRecovery = fixture(null);
  missingRecovery.context.window.location.search = '?flow=recovery';
  await missingRecovery.api.initAuth();
  assert.equal(missingRecovery.nodes.get('formReset').hidden, false);
  await missingRecovery.api.updatePassword('abcdef', 'abcdef');
  assert.equal(missingRecovery.calls.filter(c => c[0] === 'password').length, 0);
  const mailFailure = fixture(null);
  await mailFailure.api.initAuth();
  mailFailure.api.access();
  mailFailure.client.auth.resetPasswordForEmail = async () => ({ error: { code: 'email_address_not_authorized' } });
  await mailFailure.api.resetPassword('gabriel@aem.ms.gov.br');
  assert.match(mailFailure.nodes.get('portalStatus').textContent, /envio de e-mail ainda não está configurado/);
  assert.equal(mailFailure.nodes.get('resetSubmit').disabled, false);
  mailFailure.client.auth.resetPasswordForEmail = async () => ({ error: null });
  await mailFailure.api.resetPassword('gabriel@aem.ms.gov.br');
  assert.equal(mailFailure.nodes.get('resetSent').hidden, false);
  const form = login.context.document.getElementById('preRegistrationForm');
  form.elements = { email: { value: '' }, name: { value: '' } };
  form.querySelector = () => ({ disabled: false });
  form.reset = () => { form.elements.email.value = ''; form.elements.name.value = ''; };
  login.api.newRegistration();
  assert.equal(login.nodes.get('preRegistrationSection').hidden, false);
  assert.equal(login.nodes.get('registrationNextActions').hidden, true);
  login.api.access();
  assert.equal(login.nodes.get('dashboardSection').hidden, false);
  assert.ok(login.calls.some(call => call[0] === 'my_waitlist_events'));
  const ending = fixture();
  await ending.api.initAuth();
  ending.context.confirm = () => true;
  let finalUpdate;
  const endQuery = { select() { return this; }, eq() { return this; },
    async single() { return { data: { state: { running: true, gameSeconds: 123, players: [{ id: 'player' }] } } }; },
    update(value) { finalUpdate = value; return this; },
    then(resolve) { resolve({ error: null }); },
    neq() { return this; }, order() { return this; }, async limit() { return { data: [] }; } };
  ending.client.from = () => endQuery;
  await ending.api.finishGame({ id: 'room', status: 'running' });
  assert.equal(finalUpdate.status, 'finished');
  assert.equal(finalUpdate.registration_open, false);
  assert.equal(finalUpdate.state.running, false);
  assert.equal(finalUpdate.state.finished, true);
  assert.equal(finalUpdate.state.gameSeconds, 123);
  assert.equal(finalUpdate.state.players[0].id, 'player');
  finalUpdate = null;
  ending.context.confirm = () => false;
  await ending.api.finishGame({ id: 'room', status: 'setup' });
  assert.equal(finalUpdate, null);
  login.client.from = () => ({ select() { return this; }, eq() { return this; }, neq() { return this; }, order() { return this; }, async limit() { return { error: { message: 'offline' } }; } });
  await login.api.loadUserSessions();
  assert.equal(login.nodes.get('controllerCard').hidden, true);
  console.log('PASS: inicio, sessao, salas, dispositivo, inscricao, nome seguro, senha e acesso negado.');
})().catch(error => { console.error(error); process.exitCode = 1; });
