// Visual and navigation review with a simulated backend; never contacts Supabase.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../outputs');
const evidence = path.resolve(__dirname, '../work/revisao-telas');
fs.mkdirSync(evidence, { recursive: true });
const mock = `(() => {
 const user = {id:'review-user',email:'operator@example.com',user_metadata:{full_name:'Operador de teste'}};
 let listener; window.__reviewUser = null;
 const registrations=[{id:'r1',name:'Jogador teste A',organization:'Esquadra Alpha',status:'pending',planned_team:null,requested_team:'ct',email:'a@example.invalid',phone:'67999999999',emergency_name:'Contato',emergency_phone:'67999999998'}, {id:'r2',name:'Jogador teste B',organization:'Esquadra Bravo',status:'pending',planned_team:'ct',email:'b@example.invalid',phone:'67999999999',emergency_name:'Contato',emergency_phone:'67999999998'}, {id:'r3',name:'Jogador teste C',organization:'Esquadra Delta',status:'pending',planned_team:'terrorist',email:'c@example.invalid',phone:'67999999999',emergency_name:'Contato',emergency_phone:'67999999998'}];
 const state = () => typeof AirsoftBus !== 'undefined' ? AirsoftBus.read() : {operationName:'Operação de teste'};
 const sessions = [{id:'review-room',join_code:'ABC123',status:'setup',state:{operationName:'Operação de teste'}}];
 const query = table => ({ select(){return this},eq(){return this},neq(){return this},order(){return this},range(){return this},or(){return this},update(){return this},insert(){return this},
  async limit(){return {data:sessions}},async single(){return {data:{state:state(),status:'setup',controller_id:window.__reviewControllerId||'review-user',registration_open:true}}},
  async maybeSingle(){return {data:null}},then(resolve){resolve({data:table==='game_sessions'?sessions:table==='game_registrations'?registrations:[],count:table==='game_registrations'?registrations.length:0,error:null})} });
 const client={auth:{onAuthStateChange(cb){listener=cb},async getSession(){return {data:{session:window.__reviewUser?{user}:null}}},
  async signInWithPassword(){window.__reviewUser=user;listener?.('SIGNED_IN',{user});return {data:{user}}},
  async signUp(){return {data:{session:null}}},async resend(){return {error:null}},async resetPasswordForEmail(){return {error:null}},async updateUser(){return {error:null}},
  async signOut(){window.__reviewUser=null;listener?.('SIGNED_OUT',null);return {error:null}}},from:query,
  async rpc(name,args){
   if(name==='registration_force_summary')return {data:{unassigned:registrations.filter(r=>!r.planned_team).length,ct:registrations.filter(r=>r.planned_team==='ct').length,terrorist:registrations.filter(r=>r.planned_team==='terrorist').length,rejected:0,pending_import:3}};
   if(name==='plan_registration_force'){registrations.find(r=>r.id===args.registration_id).planned_team=args.force_team;return {data:1}};
   return {data:name==='my_waitlist_events'?[]:[{session_id:'review-room',join_code:'ABC123',member_id:'review-member',session_state:state()}]}},
  channel(){return {on(){return this},subscribe(cb){cb('SUBSCRIBED');return this}}},async removeChannel(){}};
 window.supabase={createClient(){return client}};
 window.__reviewLogin=()=>{window.__reviewUser=user;listener?.('SIGNED_IN',{user})};
})();`;
const server = http.createServer((req, res) => {
 const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
 if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
 if (file.endsWith('supabase.js')) {res.setHeader('Content-Type','application/javascript');res.end(mock);return;}
 try { const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[ext]||'text/plain');res.end(fs.readFileSync(file)); }
 catch {res.writeHead(404).end();}
});
module.exports = { mock };
if (require.main === module) (async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[];let captures=0;
 async function capture(page,name){
  await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});captures++;
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(overflow.scroll<=overflow.width+2,`${name}: horizontal overflow ${JSON.stringify(overflow)}`);
 }
 for(const width of [320,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Disallow external services, including QR image generation, map and auth servers.
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/index.html');await capture(page,`web-${width}-inicio`);
  await page.getByRole('button',{name:'Acessar painel de jogos'}).click();await capture(page,`web-${width}-login`);
  await page.locator('#tabSignupBtn').click();await capture(page,`web-${width}-cadastro-dados`);
  await page.locator('#signupName').fill('Operador de teste');await page.locator('#signupEmail').fill('operator@example.com');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await capture(page,`web-${width}-cadastro-senha`);
  await page.locator('#signupPass').fill('test-secret');await page.locator('#signupConfirmPass').fill('test-secret');
  await page.locator('#signupSubmit').click();await capture(page,`web-${width}-cadastro-confirmacao`);
  await page.locator('#tabConfirmBtn').click();await capture(page,`web-${width}-reenviar-confirmacao`);
  await page.locator('#tabResetBtn').click();await capture(page,`web-${width}-recuperar`);
  await page.locator('#resetEmail').fill('operator@example.com');await page.locator('#resetSubmit').click();await capture(page,`web-${width}-recuperacao-enviada`);
  await page.evaluate(()=>window.__reviewLogin());await page.evaluate(()=>AirsoftPortal.access());await capture(page,`web-${width}-painel`);
  await page.getByRole('button',{name:'Inscrição antecipada',exact:true}).click();await capture(page,`web-${width}-inscricao`);
  await page.getByRole('button',{name:'Voltar ao painel',exact:true}).click();
  await page.getByRole('button',{name:'Inscrições e reservas',exact:true}).click();await page.locator('#forceSummary').waitFor();await capture(page,`web-${width}-organizador`);
  const stagedPlayer=page.locator('.registrationRow').filter({hasText:'Jogador teste A'});
  await stagedPlayer.locator('select').selectOption('terrorist');await stagedPlayer.getByRole('button',{name:'Salvar força'}).click();
  await page.waitForFunction(()=>document.getElementById('organizerFeedback').textContent.includes('Formação salva'));
  assert.equal(await page.locator('.forceColumn').filter({has:page.locator('h3').filter({hasText:'Força 2'})}).getByText('Jogador teste A',{exact:true}).count(),1);
  await capture(page,`web-${width}-forcas-organizadas`);
  await page.goto(base+'/index.html?flow=recovery');await page.evaluate(()=>window.__reviewLogin());
  // Simulate the SDK recovery event by reinitializing with the returned session.
  await page.evaluate(()=>AirsoftPortal.initAuth());await capture(page,`web-${width}-nova-senha`);
  await page.locator('#newPassword').fill('new-test-secret');await page.locator('#confirmPassword').fill('new-test-secret');
  await page.getByRole('button',{name:'Salvar senha',exact:true}).click();assert.equal(await page.locator('#dashboardSection').isVisible(),true);
  for(const [file,role] of [['controle.html','controller'],['jogador.html','player'],['bomba.html','artifact']]){
   for(const android of [false,true]){
    await page.setViewportSize({width:role==='artifact'?844:width,height:role==='artifact'?width:844});
    await page.evaluate(()=>{localStorage.removeItem('airsoft-bomb-demo-v1');localStorage.removeItem('airsoft-cloud-session-v1-artifact');});
    await page.goto(base+'/'+file+(android?'?android=1':''));
    if(width===320 && !android && role==='controller') assert.match(await page.locator('[data-gate-status]').innerText(),/Entre com sua conta/);
    await page.evaluate(role=>{
      window.__reviewLogin();
      localStorage.setItem('airsoft-cloud-session-v1-'+role,JSON.stringify({sessionId:'review-room',joinCode:'ABC123',memberId:role==='controller'?null:'review-member',role,operationName:'Operação de teste'}));
      localStorage.setItem('airsoft-player-id-v1','P-review-user');
      localStorage.setItem('airsoft-ops-state-v1',JSON.stringify({operationName:'Operação de teste',players:[{id:'P-review-user',name:'Operador de teste',team:'ct',status:'approved'}],resetId:0}));
    },role);
    // Preserve the simulated login through navigation without touching real account data.
    await page.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>window.__reviewLogin?.(),{once:true});});
    await page.reload();await page.waitForFunction(()=>window.__reviewUser);
    const prefix=`${android?'app':'web'}-${width}-${role}`;
    if(role==='controller'){await page.locator('[data-gate-enter]').click();
      for(const tab of ['operation','config','teams','map']){await page.locator('[data-control-tab="'+tab+'"]').click();await capture(page,prefix+'-'+tab);}
    }else if(role==='player'){
      await page.waitForSelector('.cloudActive');
      for(const tab of ['objectives','terminal','locator','squad']){await page.locator('[data-tab="'+tab+'"]').click();await capture(page,prefix+'-'+tab);}
    }else{
      await page.waitForSelector('.cloudActive');await capture(page,prefix+'-cadastro-aparelho');
      if(await page.locator('#deviceDemoMode').isVisible()) await page.locator('#deviceDemoMode').click();await capture(page,prefix+'-bomba');
      for(const mode of ['Roubo de dados','Dominação de terminal','Localização de artefato']){
        await page.evaluate(mode=>AirsoftBus.update(s=>{s.mode=mode}),mode);await capture(page,prefix+'-'+mode.replaceAll(' ','-'));
      }
    }
    await page.locator('[data-menu]').click();await page.waitForURL('**/index.html?**');
    assert.equal(new URL(page.url()).searchParams.has('android'),android);
   }
  }
  await context.close();
 }
 const accessContext=await browser.newContext({viewport:{width:390,height:844}});
 await accessContext.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const accessPage=await accessContext.newPage();
 for(const file of ['controle.html','jogador.html','bomba.html']){
  await accessPage.goto(base+'/'+file);
  assert.equal(await accessPage.locator('[data-account-start]').isVisible(),true);
  assert.equal(await accessPage.locator('[data-gate-create]').isVisible(),false);
  assert.equal(await accessPage.locator('[data-gate-join]').isVisible(),false);
 }
 await accessPage.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>window.__reviewLogin?.(),{once:true});window.__reviewControllerId='other-owner'});
 await accessPage.evaluate(()=>localStorage.setItem('airsoft-cloud-session-v1-controller',JSON.stringify({sessionId:'foreign-room',joinCode:'ABC123',role:'controller'})));
 await accessPage.goto(base+'/controle.html');
 await accessPage.waitForFunction(()=>document.querySelector('[data-gate-status]').textContent.includes('Somente o proprietário'));
 assert.equal(await accessPage.evaluate(()=>localStorage.getItem('airsoft-cloud-session-v1-controller')),null);
 assert.equal(await accessPage.evaluate(()=>document.documentElement.classList.contains('cloudActive')),false);
 await accessContext.close();
 await browser.close();server.close();
 fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify({captures,errors},null,2));
 assert.deepEqual(errors,[]);console.log(`PASS: ${captures} telas revisadas a 320, 390, 412 e 1280 px, navegador e contexto Android.`);
})().catch(error=>{console.error(error);server.close();process.exit(1)});
