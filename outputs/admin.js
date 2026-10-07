(() => {
 const cfg=window.AIRSOFT_SUPABASE_CONFIG;
 const client=window.supabase.createClient(cfg.url,cfg.publishableKey||cfg.anonKey);
 const $=id=>document.getElementById(id);
 let page=0,selected=null,busy=false;
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const date=v=>v?new Date(v.length===10?v+'T12:00:00':v).toLocaleDateString('pt-BR'):'—';
 function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
 function row(container,lines,action){const el=document.createElement('div');el.className='opCard';lines.forEach(line=>el.append(text('p',line)));if(action){const b=text('button',action.label);b.className='btnSecondary';b.type='button';b.onclick=action.run;el.append(b);}container.append(el);}
 async function rpc(name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function load(){
 if(busy)return;busy=true;$('status').textContent='Carregando…';
 try{
 const session=(await client.auth.getSession()).data.session;
 if(!session){$('panel').hidden=true;throw new Error('Entre com sua conta pelo painel e volte a este link.');}
 if(!await rpc('is_platform_admin')){$('panel').hidden=true;throw new Error('Sua conta não tem acesso administrativo.');}
 const data=await rpc('admin_overview',{search_term:$('search').value,page_number:page});
 ['metrics','users','games','payments','audit'].forEach(id=>$(id).replaceChildren());
 row($('metrics'),['Usuários: '+data.total_users]);row($('metrics'),['Mensalidades em dia: '+data.active_subscribers]);row($('metrics'),['Recebimentos registrados: '+money(data.recorded_revenue)]);
 for(const u of data.users)row($('users'),[u.name||'Sem nome',u.email,u.subscription_status+' Â· válido até '+date(u.paid_until),'Cadastro: '+date(u.created_at)],{label:'Registrar pagamento',run:()=>{selected=u.id;$('paymentUser').textContent=u.email;$('paymentPanel').hidden=false;$('paymentPanel').scrollIntoView({behavior:'smooth'});}});
 if(!data.users.length)row($('users'),['Nenhum usuário nesta página.']);
 for(const g of data.games)row($('games'),[g.name||g.join_code,g.organizer||'—',g.status+' Â· '+g.join_code],g.status==='archived'?null:{label:'Encerrar e arquivar',run:async()=>{if(!confirm('Encerrar e arquivar este jogo? Os participantes receberão o encerramento.'))return;try{await rpc('admin_archive_game',{target_game:g.id});await load();}catch(e){$('status').textContent=e.message;}}});
 for(const p of data.payments)row($('payments'),[p.email,money(p.amount)+' Â· pago até '+date(p.paid_until),p.note||'',date(p.created_at)]);
 for(const a of data.audit)row($('audit'),[a.action+' Â· '+a.subject,a.actor||'—',date(a.created_at)]);
 $('prev').disabled=page===0;$('next').disabled=data.users.length<50;$('panel').hidden=false;$('status').textContent='Dados atualizados Â· página '+(page+1);
 }catch(e){$('status').textContent=e.message||'Não foi possível carregar o painel.';}finally{busy=false;}
 }
 $('searchForm').onsubmit=e=>{e.preventDefault();page=0;load();};$('prev').onclick=()=>{if(page>0){page--;load();}};$('next').onclick=()=>{page++;load();};$('cancelPayment').onclick=()=>{$('paymentPanel').hidden=true;selected=null;};
 $('paymentForm').onsubmit=async e=>{e.preventDefault();if(!selected||busy)return;busy=true;const buttons=$('paymentForm').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await rpc('admin_record_payment',{target_user:selected,payment_amount:Number($('amount').value),valid_until:$('validUntil').value,payment_note:$('note').value});$('paymentPanel').hidden=true;selected=null;$('paymentForm').reset();busy=false;await load();}catch(error){$('status').textContent=error.message;}finally{busy=false;buttons.forEach(b=>b.disabled=false);}};
 client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(!busy)load();},0);});load();
})();