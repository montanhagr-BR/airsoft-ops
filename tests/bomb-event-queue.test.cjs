const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let release,fail=false;const calls=[];
 const client = {
  from() {
   return {async insert(row) {
    calls.push(row);
    if(calls.length===1) await new Promise(r=>release=r);
    return fail ? {error:new Error('Sem conexão')} : {error:null};
   }};
  }
 };
 const ctx=vm.createContext({window:{},location:{pathname:'/bomba.html'},localStorage:{getItem:key=>key.includes('device')?'artifact-test':null},addEventListener(){}});
 const source=fs.readFileSync('outputs/airsoft-cloud.js','utf8').replace("  addEventListener('DOMContentLoaded', init);","  globalThis.setup=c=>{client=c;connection={sessionId:'room'};user={id:'operator'};memberBaseState={pending:{type:'arm'},qrStageNonce:2,resetId:1}};globalThis.send=publishMemberEvent;");
 vm.runInContext(source,ctx);ctx.setup(client);
 const first=ctx.send({step:1}),second=ctx.send({step:2});assert.equal(calls.length,1);release();await Promise.all([first,second]);assert.equal(calls.length,2);assert.equal(calls[1].payload.state.step,2);assert.equal(calls[1].payload.baseNonce,2);
 fail=true;await assert.rejects(ctx.send({step:3}),/Sem conexão/);fail=false;await ctx.send({step:4});assert.equal(calls.at(-1).payload.state.step,4);
 console.log('PASS: ações aguardam a transmissão anterior e uma falha não bloqueia novos envios.');
})().catch(e=>{console.error(e);process.exitCode=1});
