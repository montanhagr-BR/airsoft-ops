(() => {
 let client,checking=false,overlay;
 async function check(){
  if(checking)return;checking=true;
  try{
   const cfg=window.AIRSOFT_SUPABASE_CONFIG;if(!cfg||!window.supabase)return;
   client ||= window.supabase.createClient(cfg.url,cfg.publishableKey||cfg.anonKey);
   const {data:{session}}=await client.auth.getSession();
   if(!session||session.user.is_anonymous){overlay?.remove();overlay=null;return;}
   const result=await client.rpc('my_app_access');if(result.error)throw result.error;
   const access=result.data;if(!access||typeof access.allowed!=='boolean')return;
   if(access.allowed){overlay?.remove();overlay=null;return;}
   if(overlay)return;
   overlay=document.createElement('section');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
   overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#100e0a;color:#f5e9ce;display:grid;place-items:center;padding:24px;overflow:auto';
   const box=document.createElement('div');box.style.maxWidth='480px';
   const h=document.createElement('h1');h.textContent='Seu teste gratuito terminou';box.append(h);
   const p=document.createElement('p');p.textContent='Você teve 7 dias para experimentar. Para continuar jogando, é necessária uma assinatura de R$ 30 por mês.';box.append(p);
   const note=document.createElement('p');note.textContent='A assinatura pela Google Play está em preparação. Por enquanto, solicite ao administrador a liberação após o pagamento. Não há cobrança automática nesta tela.';box.append(note);
   const contact=document.createElement('a');contact.href='mailto:montanhagr@gmail.com?subject=Assinatura%20Montanha%20Bomb%20System';contact.textContent='Falar com o administrador';box.append(contact);
   const button=document.createElement('button');button.textContent='Verificar pagamento';button.style.margin='20px';button.onclick=check;box.append(button);
   const logout=document.createElement('button');logout.textContent='Sair da conta';logout.onclick=async()=>{await client.auth.signOut();location.href='index.html';};box.append(logout);
   overlay.append(box);document.body.append(overlay);
  }catch(error){console.error('Não foi possível verificar a assinatura:',error.message);}finally{checking=false;}
 }
 check();setInterval(check,60000);window.addEventListener('focus',check);
 setTimeout(()=>{if(client)client.auth.onAuthStateChange(()=>setTimeout(check,0));},0);
})();