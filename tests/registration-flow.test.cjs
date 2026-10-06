const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
(async () => {
 let state = { running:true, players: [{id:'P-a',name:'A',status:'approved',team:'ct'}, {id:'P-b',name:'B',status:'pending'}] };
 const context = vm.createContext({ URL, URLSearchParams, window:{}, location:{pathname:'/controle.html',search:''}, localStorage:{getItem(){return null}}, addEventListener(){}, AirsoftBus:{read(){return state},write(value){state=value}} });
 let source = fs.readFileSync('outputs/airsoft-cloud.js','utf8');
 source = source.replace('  addEventListener(\'DOMContentLoaded\', init);', `  globalThis.testSetup = () => {user={id:'owner'}; connection=null;}; globalThis.testEvent=consumeEvent; globalThis.testSession=consumeSession;`);
 vm.runInContext(source,context);context.testSetup();
 await context.testEvent({new:{user_id:'a',payload:{state:{players:[{id:'P-a',status:'approved',team:'terrorist',lat:4,lastSeen:50}]}}}});
 assert.equal(state.players.length,2,'Other registrants survive stale member proposals');
 assert.equal(state.players[0].team,'ct','Member cannot change their approval or team');
 assert.equal(state.players[0].lat,4,'Own telemetry still updates');
 await context.testSession({new:{status:'setup',state:{players:[{id:'P-c',status:'pending'}]}}});
 assert.equal(state.players[0].id,'P-c','Controle receives registrations during preparation');
 console.log('PASS: inscritos preservados, equipe protegida e Controle recebe cadastros em preparação.');
})().catch(error=>{console.error(error);process.exitCode=1});
