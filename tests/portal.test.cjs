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
    addEventListener(type, callback) { this[type] = callback; }, reset() {} });
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
  const f = fixture();
  await f.api.initAuth();
  assert.equal(f.nodes.get('welcomeSection').hidden, false);
  assert.equal(f.nodes.get('authSection').hidden, true);
  f.api.access();
  assert.equal(f.nodes.get('dashboardSection').hidden, false);
  await f.api.loadUserSessions();
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
  const anonymous = fixture({ id: 'guest', is_anonymous: true });
  await anonymous.api.initAuth();
  anonymous.api.access();
  assert.equal(anonymous.api.getUser(), null);
  assert.equal(anonymous.nodes.get('authSection').hidden, false);
  console.log('PASS: inicio, sessao, salas, dispositivo, inscricao, nome seguro, senha e acesso negado.');
})().catch(error => { console.error(error); process.exitCode = 1; });
