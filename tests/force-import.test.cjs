const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let state={running:false,finished:false,players:[{id:'P-a',status:'pending'}]},fail=false;
 const official={running:false,finished:false,team1Name:'Força Azul',players:[{id:'P-a',team:'ct',status:'approved'}]};
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return fail?{error:new Error('Sem conexão')}: {data:{imported:1,state:official}}}};
 const context=vm.createContext({window:{},location:{pathname:'/controle.html'},localStorage:{getItem(){return null}},addEventListener(){},clearTimeout(){},AirsoftBus:{read:()=>state,write:s=>{state=s}}});
 let source=fs.readFileSync('outputs/airsoft-cloud.js','utf8').replace("  addEventListener('DOMContentLoaded', init);", "  globalThis.setupImport=(mock)=>{client=mock;connection={sessionId:'room'};publishControllerState=async()=>{};subscribe=async()=>{};}; globalThis.importForces=importPreRegistrations;");
 vm.runInContext(source,context);context.setupImport(client);
 assert.equal(await context.importForces(),1);
 assert.equal(calls[0].name,'import_registration_forces');assert.equal(calls[0].args.target_session,'room');
 assert.equal(state.players[0].team,'ct');assert.equal(state.team1Name,'Força Azul');
 fail=true;await assert.rejects(context.importForces(),/Sem conexão/);assert.equal(state,official,'Import failure preserves the last official formation');
 state={...official,running:true};const before=calls.length;
 await assert.rejects(context.importForces(),/antes de iniciar/);assert.equal(calls.length,before);
 console.log('PASS: Controle carrega a formação oficial, preserva estado em falha e bloqueia importação com partida ativa.');
})().catch(error=>{console.error(error);process.exitCode=1});
