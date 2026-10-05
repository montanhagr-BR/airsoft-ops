// Runs against a debug emulator WebView exposed by `adb forward tcp:9223 ...`.
// Replaces the backend and site assets for inspection, preserving local storage.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const adb=process.env.ANDROID_ADB||path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {mock}=require('./interface-review.cjs');
const root=path.resolve(__dirname,'../outputs');
const out=path.resolve(__dirname,'../work/revisao-telas');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
 const context=browser.contexts()[0];const page=context.pages()[0];
 assert.ok(page,'Open the debug Android app first.');
 const originalUrl=page.url();
 const originalStorage=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['warm-hummingbird-8988f6.netlify.app','airsoft.local'].includes(url.hostname))return route.abort();
  if(url.pathname.endsWith('/supabase.js'))return route.fulfill({contentType:'application/javascript',body:mock});
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
  return route.fulfill({path:file});
 });
 const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 let count=0;
 const capture=async name=>{
  await page.screenshot({path:path.join(out,'emulador-'+name+'.png'),fullPage:false});
  execFileSync(adb,['shell','screencap','-p','/sdcard/airsoft-review.png'],{stdio:'pipe'});
  execFileSync(adb,['pull','/sdcard/airsoft-review.png',path.join(out,'android-'+name+'.png')],{stdio:'pipe'});
  count++;
 };
 try{
  await page.goto('https://warm-hummingbird-8988f6.netlify.app/index.html?android=1');await capture('inicio');
  await page.getByRole('button',{name:'Acessar painel de jogos'}).click();await capture('login');
  await page.locator('#tabSignupBtn').click();await capture('cadastro-dados');
  await page.locator('#signupName').fill('Operador de teste');await page.locator('#signupEmail').fill('operator@example.com');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await capture('cadastro-senha');
  await page.locator('#tabResetBtn').click();await capture('recuperar');
  await page.locator('#tabConfirmBtn').click();await capture('confirmar');
  await page.evaluate(()=>window.__reviewLogin());await page.evaluate(()=>AirsoftPortal.access());await capture('painel');
  await page.getByRole('button',{name:'Inscrição antecipada',exact:true}).click();await capture('inscricao');
  await page.getByRole('button',{name:'Voltar ao painel',exact:true}).click();
  await page.getByRole('button',{name:'Lista de espera',exact:true}).click();await capture('organizador');
  await page.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>window.__reviewLogin?.(),{once:true})});
  await page.goto('https://warm-hummingbird-8988f6.netlify.app/index.html?android=1&flow=recovery');await capture('nova-senha');
  for(const [file,role] of [['controle.html','controller'],['jogador.html','player'],['bomba.html','artifact']]){
   await page.evaluate(role=>{
    localStorage.setItem('airsoft-cloud-session-v1-'+role,JSON.stringify({sessionId:'review-room',joinCode:'ABC123',memberId:role==='controller'?null:'review-member',role,operationName:'Operação de teste'}));
    localStorage.setItem('airsoft-player-id-v1','P-review-user');localStorage.removeItem('airsoft-bomb-demo-v1');
    localStorage.setItem('airsoft-ops-state-v1',JSON.stringify({operationName:'Operação de teste',players:[{id:'P-review-user',name:'Operador de teste',team:'ct',status:'approved'}],resetId:0}));
   },role);
   await page.goto('https://warm-hummingbird-8988f6.netlify.app/'+file+'?android=1');
   if(role==='controller'){
    await page.locator('[data-gate-enter]').click();
    for(const tab of ['operation','config','teams','map']){await page.locator('[data-control-tab="'+tab+'"]').click();await capture(role+'-'+tab)}
   }else if(role==='player'){
    await page.waitForFunction(()=>document.documentElement.classList.contains('cloudActive'));
    for(const tab of ['objectives','terminal','locator','squad']){await page.locator('[data-tab="'+tab+'"]').click();await capture(role+'-'+tab)}
   }else{
    await page.waitForFunction(()=>document.documentElement.classList.contains('cloudActive'));await capture('cadastro-aparelho');
    await page.locator('#deviceDemoMode').click();await capture('bomba');
    for(const mode of ['Roubo de dados','Dominação de terminal','Localização de artefato']){await page.evaluate(mode=>AirsoftBus.update(s=>{s.mode=mode}),mode);await capture(mode.replaceAll(' ','-'))}
   }
   execFileSync(adb,['shell','input','keyevent','4'],{stdio:'pipe'});
   await page.waitForURL('**/index.html?**');
   assert.equal(new URL(page.url()).searchParams.get('flow'),'dashboard');
  }
  assert.deepEqual(errors,[]);console.log(`PASS: ${count} telas abertas na WebView Android real com backend simulado.`);
 }finally{
  await page.evaluate(data=>{localStorage.clear();for(const [key,value]of Object.entries(data))localStorage.setItem(key,value)},originalStorage);
  await page.unroute('**/*');await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1)});
