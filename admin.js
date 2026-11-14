(() => {
  const $ = s => document.querySelector(s);
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let products = [], orders = [], currentUser = null, supportsExtras = false, ordersExtended = false, lastOrderCount = null;
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits:2});
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const message = (selector, text, good=false) => { const el=$(selector); el.textContent=text; el.classList.toggle('success',good); };

  async function isAdmin(user) {
    const {data,error} = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return !!data;
  }
  async function showSession() {
    const {data:{session}} = await client.auth.getSession();
    if (!session) { currentUser=null; $('#loginView').hidden=false; $('#dashboardView').hidden=true; return; }
    try {
      if (!await isAdmin(session.user)) {
        await client.auth.signOut(); $('#loginView').hidden=false; $('#dashboardView').hidden=true;
        message('#loginMessage','This account is not authorised as a store admin. Ask the project owner to add its email in Supabase.'); return;
      }
      currentUser=session.user; $('#loginView').hidden=true; $('#dashboardView').hidden=false;
      $('#adminEmail').textContent=session.user.email || 'Authorised administrator';
      await Promise.all([loadProducts(),loadOrders()]);
    } catch(error) { console.error(error); message('#loginMessage','Could not verify admin access: '+error.message); }
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); message('#loginMessage','Signing in…');
    const {error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
    if(error){message('#loginMessage',error.message);return;} message('#loginMessage',''); await showSession();
  });
  $('#logoutBtn').addEventListener('click', async()=>{await client.auth.signOut();await showSession();});
  client.auth.onAuthStateChange((_event)=>{setTimeout(showSession,0);});

  async function detectExtras(){
    supportsExtras = products.length ? ('stock' in products[0] && 'category' in products[0]) : !(await client.from('products').select('category,stock').limit(1)).error;
    document.querySelectorAll('.extra').forEach(el=>{el.hidden=!supportsExtras;});
  }
  const extraInfo = p => supportsExtras ? `<br><span class="muted">${p.category?escapeHtml(p.category)+' · ':''}Stock: ${(p.stock===null||p.stock===undefined)?'not tracked':Number(p.stock)}</span>` : '';
  async function loadProducts(){
    const {data,error}=await client.from('products').select('*').order('created_at',{ascending:false});
    if(error) throw error; products=data||[]; await detectExtras(); $('#productCount').textContent=products.length; renderProducts();
  }
  function imageUrl(images){return Array.isArray(images)?(images[0]||''):typeof images==='string'?images:'';}
  function renderProducts(){
    $('#productsList').innerHTML=products.length?`<table><thead><tr><th>Product</th><th>Price</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>${products.map(p=>`<tr><td><div class="item-cell">${imageUrl(p.images)?`<img src="${escapeHtml(imageUrl(p.images))}" alt="">`:''}<div><strong>${escapeHtml(p.name)}</strong><br><span class="muted">${escapeHtml(p.description||'')}</span>${extraInfo(p)}</div></div></td><td>${money(p.price)}</td><td><span class="pill">${p.is_active?'Active':'Hidden'}</span></td><td><div class="actions"><button class="small-btn" data-edit="${escapeHtml(p.id)}">Edit</button><button class="small-btn danger" data-delete="${escapeHtml(p.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No products yet. Add your first product.</p>';
  }
  function resetProductForm(){ $('#productForm').reset(); $('#productId').value=''; $('#productActive').checked=true; $('#currentImage').textContent=''; $('#formTitle').textContent='Add product'; message('#productMessage',''); }
  $('#newProductBtn').addEventListener('click',()=>{resetProductForm();$('#productForm').hidden=false;$('#productForm').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#cancelProductBtn').addEventListener('click',()=>{$('#productForm').hidden=true;resetProductForm();});
  $('#productsList').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit]'), del=e.target.closest('[data-delete]');
    if(edit){const p=products.find(x=>String(x.id)===edit.dataset.edit);if(!p)return;$('#productId').value=p.id;$('#productName').value=p.name||'';$('#productPrice').value=p.price||0;$('#productDescription').value=p.description||'';$('#productActive').checked=!!p.is_active;$('#productCategory').value=p.category||'';$('#productStock').value=(p.stock===null||p.stock===undefined)?'':p.stock;$('#productImage').value='';$('#currentImage').textContent=imageUrl(p.images)?'Current image(s) saved. Choosing new file(s) replaces all current images.':'No image uploaded yet.';$('#formTitle').textContent='Edit product';$('#productForm').hidden=false;$('#productForm').scrollIntoView({behavior:'smooth',block:'start'});}
    if(del){const p=products.find(x=>String(x.id)===del.dataset.delete);if(!p||!confirm(`Delete “${p.name}”? This cannot be undone.`))return;const {error}=await client.from('products').delete().eq('id',p.id);if(error){message('#dashboardMessage','Delete failed: '+error.message);return;}message('#dashboardMessage','Product deleted.',true);await loadProducts();}
  });
  async function uploadImage(file){
    if(!file)return null;
    if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
    if(file.size>8*1024*1024)throw new Error('Image must be smaller than 8 MB.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await client.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;
    const {data}=client.storage.from('products').getPublicUrl(path);
    if(!data?.publicUrl)throw new Error('Could not create a public image URL. Check that the products bucket is public.');
    return data.publicUrl;
  }
  $('#productForm').addEventListener('submit',async e=>{
    e.preventDefault();const id=$('#productId').value;const old=products.find(p=>String(p.id)===id);const file=$('#productImage').files[0];
    const button=$('#productForm button[type=submit]');button.disabled=true;message('#productMessage','Saving product…');
    try{
      let images=old?.images||[];const uploaded=[];for(const f of [...$('#productImage').files].slice(0,6)){uploaded.push(await uploadImage(f));}if(uploaded.length)images=uploaded;
      const payload={name:$('#productName').value.trim(),description:$('#productDescription').value.trim(),price:Number($('#productPrice').value),images,is_active:$('#productActive').checked,updated_at:new Date().toISOString()};
      if(supportsExtras){payload.category=$('#productCategory').value.trim()||null;const st=$('#productStock').value.trim();payload.stock=st===''?null:Math.max(0,Math.floor(Number(st))||0);}
      const result=id?await client.from('products').update(payload).eq('id',id):await client.from('products').insert(payload);
      if(result.error)throw result.error;
      message('#productMessage','Product saved successfully.',true);$('#productForm').hidden=true;resetProductForm();await loadProducts();message('#dashboardMessage','Product saved successfully.',true);
    }catch(error){message('#productMessage','Could not save: '+error.message);}finally{button.disabled=false;}
  });
  const STATUSES=[['pending','Pending'],['payment_verification','Payment Verification'],['confirmed','Confirmed'],['processing','Processing'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled']];
  const BASE_STATUSES=['pending','confirmed','processing','delivered','cancelled'];
  const statusLabel=s=>{const f=STATUSES.find(x=>x[0]===(s||'pending'));return f?f[1]:String(s||'pending');};
  const statusOptions=cur=>{cur=cur||'pending';const list=STATUSES.filter(x=>ordersExtended||BASE_STATUSES.includes(x[0])||x[0]===cur);if(!list.some(x=>x[0]===cur))list.push([cur,cur]);return list.map(x=>`<option value="${escapeHtml(x[0])}" ${x[0]===cur?'selected':''}>${escapeHtml(x[1])}</option>`).join('');};
  const paymentCell=o=>{const m=o.payment_method?`<span class="pill">${escapeHtml(String(o.payment_method).toUpperCase())}</span>`:'<span class="muted">—</span>';const u=o.payment_utr?`<br>UTR: <strong>${escapeHtml(o.payment_utr)}</strong>`:'';const t=o.payment_submitted_at?`<br><span class="muted">${new Date(o.payment_submitted_at).toLocaleString('en-IN')}</span>`:'';const pr=o.payment_proof_path?`<br><button class="small-btn" data-proof="${escapeHtml(o.payment_proof_path)}">View screenshot</button>`:'';const ps=o.payment_status?`<br><strong>Payment: ${escapeHtml(String(o.payment_status).toUpperCase())}</strong>`:'';const hint=o.payment_utr?'<br><span class="muted">Verify amount and UTR in your UPI/bank statement before confirming.</span>':'';return `<td>${m}${ps}${u}${t}${pr}${hint}</td>`;};
  async function loadOrders(){
    const {data,error}=await client.from('orders').select('*').order('created_at',{ascending:false});
    if(error)throw error;orders=data||[];ordersExtended=orders.length?('payment_status' in orders[0]):false;if(lastOrderCount!==null&&orders.length>lastOrderCount)message('#dashboardMessage','🔔 New order received!',true);lastOrderCount=orders.length;$('#verifyCount').textContent=orders.filter(o=>o.status==='payment_verification').length;$('#orderCount').textContent=orders.length;$('#pendingCount').textContent=orders.filter(o=>(o.status||'pending').toLowerCase()==='pending').length;renderOrders();
  }
  function renderOrders(){
    $('#ordersList').innerHTML=orders.length?`<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Update</th></tr></thead><tbody>${orders.map(o=>{const items=Array.isArray(o.items)?o.items:[];const itemText=items.map(i=>`${escapeHtml(i.product_name||'Product')} · ${escapeHtml(i.size||'')} × ${Number(i.quantity||1)}`).join('<br>')||'Items not recorded';return `<tr><td><strong>#${escapeHtml(String(o.id).slice(0,8))}</strong><br><span class="muted">${o.created_at?new Date(o.created_at).toLocaleString('en-IN'):''}</span></td><td><strong>${escapeHtml(o.customer_name)}</strong><br>${escapeHtml(o.customer_phone||'')}<br><span class="muted">${escapeHtml(o.customer_address||'')}</span></td><td>${itemText}</td><td><strong>${money(o.total_amount)}</strong></td>${paymentCell(o)}<td><span class="pill">${escapeHtml(statusLabel(o.status))}</span></td><td><select data-status="${escapeHtml(o.id)}">${statusOptions(o.status)}</select></td></tr>`;}).join('')}</tbody></table>`:'<p class="muted">No customer orders found yet.</p>';
  }
  $('#ordersList').addEventListener('change',async e=>{const select=e.target.closest('[data-status]');if(!select)return;select.disabled=true;const update={status:select.value};if(select.value==='confirmed')update.payment_status='verified';if(select.value==='cancelled')update.payment_status='rejected';const {error}=await client.from('orders').update(update).eq('id',select.dataset.status);select.disabled=false;if(error){message('#dashboardMessage','Could not update order: '+error.message);return;}message('#dashboardMessage','Order status updated.',true);await loadOrders();});
  $('#ordersList').addEventListener('click',async e=>{const b=e.target.closest('[data-proof]');if(!b)return;const w=window.open('about:blank','_blank');const {data,error}=await client.storage.from('payment-proofs').createSignedUrl(b.dataset.proof,300);if(error||!data){if(w)w.close();message('#dashboardMessage','Could not open screenshot: '+(error?error.message:'not found'));return;}if(w)w.location.href=data.signedUrl;else window.location.href=data.signedUrl;});
  setInterval(()=>{if(currentUser&&!document.hidden)loadOrders().catch(()=>{});},60000);
  $('#refreshOrdersBtn').addEventListener('click',async()=>{try{await loadOrders();message('#dashboardMessage','Orders refreshed.',true);}catch(e){message('#dashboardMessage',e.message);}});
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));$('#productsPanel').hidden=btn.dataset.tab!=='productsPanel';$('#ordersPanel').hidden=btn.dataset.tab!=='ordersPanel';}));
  showSession().catch(error=>message('#loginMessage',error.message));
})();
