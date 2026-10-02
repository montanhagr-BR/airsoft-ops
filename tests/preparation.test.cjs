const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const storage = new Map();
const context = vm.createContext({ window: { dispatchEvent() {} },
  localStorage: { getItem(key) { return storage.get(key); }, setItem(key,value) { storage.set(key,value); } },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../outputs/airsoft-shared.js'), 'utf8') + '\nglobalThis.api = AirsoftBus;', context);
context.api.log('Configuração antes do início');
assert.equal(context.api.read().log.length, 0);
context.api.update(s => { s.players = [{ id: 'player' }]; s.gameSeconds = 600; });
assert.equal(context.api.read().players.length, 1);
context.api.update(s => { s.running = true; s.startedAt = 123; });
context.api.log('Jogo iniciado');
assert.equal(context.api.read().log.length, 1);
context.api.update(s => { s.running = false; s.finished = true; });
context.api.log('Jogo encerrado');
assert.equal(context.api.read().log.length, 2);
context.api.reset();
assert.equal(context.api.read().log.length, 0);
assert.equal(context.api.read().startedAt, null);
console.log('PASS: preparacao permite cadastro sem historico; registros iniciam com a partida.');
