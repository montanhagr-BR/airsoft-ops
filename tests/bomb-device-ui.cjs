// Two browser contexts and a simulated backend; never uses real accounts or Supabase.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root=path.resolve(__dirname,'../outputs'),evidence=path.resolve(__dirname,'../work/revisao-bombas');fs.mkdirSync(evidence,{recursive:true});
let state={operationName:'Teste de bomba',mode:'Bomba clássica',running:false,finished:false,bombDevices:[],players:[],team1Name:'Azul',team2Name:'Vermelho',qrStageNonce:1,resetId:1,resultSeconds:90,armCode:'1234',defuseCode:'5678',bombSequenceIndex:0,bombSequence:[{id:'b1',name:'Alpha',armCode:'1234',defuseCode:'5678',resultSeconds:90},{id:'b2',name:'Bravo',armCode:'4444',defuseCode:'9999',resultSeconds:120}]},revision=0;
const events=[],history=[];
async function waitServer(predicate){const deadline=Date.now()+10000;while(!predicate()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.ok(predicate(),'Backend did not confirm the action')}
const result=()=>({data:{state,controller_id:'owner',status:state.finished?'finished':state.running?'running':'setup',state_version:revision}});
const mock=`(() => {const user={id:window.__bombUser||'owner',email:'test@example.invalid',user_metadata:{full_name:'Operador teste'}};const request=async(body)=>fetch('/__backend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());let handlers=[],seen=-1,seenEvent=0;
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange(){}},rpc:(name,args)=>request({rpc:name,args,user:user.id}),from:table=>({select(){return this},eq(){return this},update(value){this.value=value;return this},single(){return request({table,value:this.value})},insert(value){return request({table,value})}}),channel:()=>({on(type,filter,cb){handlers.push({table:filter.table,cb});return this},subscribe(cb){cb('SUBSCRIBED');setInterval(async()=>{const r=await request({poll:true});if(r.version!==seen){seen=r.version;handlers.filter(h=>h.table==='game_sessions').forEach(h=>h.cb({new:r.session}))}for(const event of r.events.filter(e=>e.id>seenEvent)){seenEvent=event.id;handlers.filter(h=>h.table==='game_events').forEach(h=>h.cb({new:event}))}},100);return this}}),removeChannel:async()=>{handlers=[]}})};})();`;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/__backend'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);let response;
  if(body.poll)response={version:revision,session:result().data,events};
  else if(body.rpc==='import_registration_forces')response={data:{state,imported:0,state_version:revision}};
  else if(body.rpc==='register_bomb_device'){
   const a=body.args;state.bombDevices=[...state.bombDevices.filter(d=>d.id!==a.registration_id),{id:a.registration_id,userId:body.user,memberDeviceId:a.member_device,name:a.device_name,type:a.device_type,status:'pending',bombId:null,lastSeen:Date.now()}];revision++;response=result();
  }else if(body.rpc==='assign_bomb_device'){
   const a=body.args;if(state.running)response={error:{message:'Organize os dispositivos antes de iniciar.'}};
   else if(state.bombDevices.some(d=>d.id!==a.registration_id && d.status==='approved'&&d.bombId===a.selected_bomb))response={error:{message:'Bomba já vinculada'}};
   else {state.bombDevices=state.bombDevices.map(d=>d.id===a.registration_id?{...d,status:'approved',bombId:a.selected_bomb}:d);revision++;response=result()}
  }else if(body.rpc)response={data:null};
  else if(body.table==='game_events'){events.push({id:events.length+1,...body.value});response={error:null}}
  else {if(body.value){state=body.value.state;history.push({revision,bombSeconds:state.bombSeconds,pending:state.pending?.type,index:state.bombSequenceIndex});revision++;}response=result()}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response));return;
 }
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(file.endsWith('supabase.js')){res.setHeader('Content-Type','application/javascript');res.end(mock);return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 async function page(role,user){const context=await browser.newContext({viewport:{width:role==='artifact'?844:1280,height:844}});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await context.addInitScript(({role,user})=>{window.__bombUser=user;localStorage.setItem('airsoft-cloud-session-v1-'+role,JSON.stringify({sessionId:'room',joinCode:'ABC123',role,operationName:'Teste de bomba'}));localStorage.setItem('airsoft-bomb-demo-v1','1')},{role,user});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+(role==='artifact'?'/bomba.html':'/controle.html'));return p}
 const controller=await page('controller','owner');await controller.locator('[data-gate-enter]').click();await controller.locator('[data-control-tab="teams"]').click();
 const bomb=await page('artifact','operator');await bomb.locator('.cloudActive').waitFor();assert.equal(await bomb.locator('#deviceDemoMode').isVisible(),false,'Online demo cannot bypass registration');
 await bomb.locator('#deviceName').fill('Notebook Alpha');await bomb.locator('#deviceType').selectOption('notebook');await bomb.locator('#requestDeviceRegistration').click();
 await controller.getByText('Notebook Alpha',{exact:true}).waitFor();assert.equal(state.bombDevices[0].status,'pending');
 await controller.screenshot({path:path.join(evidence,'cadastro-pendente.png'),fullPage:true});
 await controller.locator('[data-device-bomb]').selectOption('b1');await controller.locator('[data-device-approve]').click();
 await bomb.locator('#deviceSetupLayer').waitFor({state:'hidden'});assert.equal(state.bombDevices[0].bombId,'b1');assert.equal(await bomb.locator('#keys button').first().isEnabled(),false,'Approved device waits for the game');
 state={...state,running:true,pending:{type:'arm',label:'Armar Alpha'},bombSeconds:null};revision++;
 await bomb.locator('#keys button').filter({hasText:/^1$/}).waitFor();await bomb.waitForFunction(()=>!document.querySelector('#keys button').disabled);
 for(const digit of ['1','2','3','4'])await bomb.locator('#keys button').filter({hasText:new RegExp('^'+digit+'$')}).click();
 await bomb.locator('#keys button[data-act="ok"]').click();await waitServer(()=>state.bombSeconds!=null);assert.ok(state.bombSeconds>0&&state.bombSeconds<=90,JSON.stringify({bombSeconds:state.bombSeconds,resultSeconds:state.resultSeconds,running:state.running}));
 await bomb.screenshot({path:path.join(evidence,'bomba-armada.png'),fullPage:false});
 events.push({id:events.length+1,user_id:'player',device_id:'player-test',payload:{state:{...structuredClone(state),pending:{type:'defuse',label:'Desarmar Alpha'},qrStageNonce:2}}});
 await bomb.waitForFunction(()=>AirsoftBus.read().pending?.type==='defuse');
 for(const digit of ['5','6','7','8'])await bomb.locator('#keys button').filter({hasText:new RegExp('^'+digit+'$')}).click();
 await bomb.locator('#keys button[data-act="ok"]').click();await waitServer(()=>state.bombSequenceIndex===1);assert.equal(state.bombSequence[0].status,'defused');
 await bomb.waitForFunction(()=>AirsoftBus.read().bombSequenceIndex===1);
 assert.equal(await bomb.locator('#keys button').first().isEnabled(),false,'Alpha device cannot operate Bravo');
 await browser.close();server.close();assert.deepEqual(errors,[]);console.log('PASS: dois navegadores, cadastro antes do início, aprovação no Controle, vínculo, bloqueio da demonstração online, arme, contagem e próxima bomba.');
})().catch(e=>{console.error(e);console.error(JSON.stringify({history,pending:state.pending,bombSeconds:state.bombSeconds,resultSeconds:state.resultSeconds,ctValidated:state.ctBombValidated,index:state.bombSequenceIndex,lastEvent:events.at(-1)?.payload}));server.close();process.exit(1)});
