const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let state={players:[]}, phase='setup', fail=false, writes=0, imports=0;
 const roster={players:[{id:'P-a',team:'ct',status:'approved'},{id:'P-b',status:'pending'}]};
 const client={from(){return {select(){return this},eq(){return this},async single(){return {data:{controller_id:'owner',status:phase,state:{players:[]}}}}}},rpc:async()=>{imports++;return fail?{error:new Error('Importação indisponível')}:{data:{state:roster}}},channel(){return {on(){return this},subscribe(){return this}}},async removeChannel(){}};
 const ctx=vm.createContext({window:{},location:{pathname:'/controle.html'},localStorage:{getItem(){return null}},document:{getElementById(){return null}},addEventListener(){},clearInterval(){},AirsoftBus:{read:()=>state,write:s=>{state=s;writes++}}});
 let source=fs.readFileSync('outputs/airsoft-cloud.js','utf8').replace("  addEventListener('DOMContentLoaded', init);","  globalThis.testSetup=mock=>{client=mock;connection={sessionId:'room'};user={id:'owner'};ensureAuth=async()=>{};}; globalThis.loadRoster=subscribe;");
 vm.runInContext(source,ctx);ctx.testSetup(client);
 await ctx.loadRoster();assert.equal(state,roster);assert.equal(state.players.length,2);assert.equal(state.players[0].team,'ct');
 phase='running';await ctx.loadRoster();assert.equal(imports,1,'Active matches are never imported');
 phase='setup';fail=true;const before=writes;await assert.rejects(ctx.loadRoster(),/indisponível/);assert.equal(writes,before,'Import failure cannot expose or publish a stale empty roster');
 const player=fs.readFileSync('outputs/jogador.html','utf8');assert.match(player,/requestRegistration.onclick = \(\) => AirsoftCloud.openRegistration/);assert.doesNotMatch(player,/await AirsoftCloud.registerPlayer/);
 console.log('PASS: roster loads before Control, active matches preserved, failure blocks stale state, player uses the single enrollment form.');
})().catch(e=>{console.error(e);process.exitCode=1});
