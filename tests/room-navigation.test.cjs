const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
  for (const [page, role] of [['controle.html','controller'], ['bomba.html','artifact'], ['jogador.html','player']]) {
    for (const search of ['', '?android=1']) {
      const key = 'airsoft-cloud-session-v1-' + role;
      const storage = new Map([[key, JSON.stringify({ sessionId: 'room', role })], ['account-session', 'preserved']]);
      let destination;
      const context = vm.createContext({ URL, URLSearchParams,
        window: {}, location: { pathname: '/' + page, search,
          href: 'https://example.com/' + page + search, replace(url) { destination = url; } },
        localStorage: { getItem(key) { return storage.get(key); }, removeItem(key) { storage.delete(key); } },
        clearTimeout() {}, clearInterval() {}, addEventListener() {} });
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../outputs/airsoft-cloud.js'), 'utf8') + '\nglobalThis.api = AirsoftCloud;', context);
      await context.api.leaveRoom();
      const url = new URL(destination);
      assert.equal(url.pathname, '/index.html');
      assert.equal(url.searchParams.get('flow'), 'dashboard');
      assert.equal(url.searchParams.has('android'), Boolean(search));
      assert.equal(storage.has(key), false);
      assert.equal(storage.get('account-session'), 'preserved');
    }
  }
  console.log('PASS: saida de Controle, Bomba e Jogador retorna ao painel e preserva a conta e contexto Android.');
})().catch(error => { console.error(error); process.exitCode = 1; });
