import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadProductImage, deleteProductImages } from '../services/cloudinary';
import { signOut, signInWithEmailAndPassword, onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth, db, isAdminUser } from '../firebase/firebase';
import { saveProduct, removeProduct, getProducts } from '../services/products';
import { money } from '../utils/format';
import toast from 'react-hot-toast';

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
const SETUP_HINT = 'Timed out. In Firebase Console make sure the Firestore database is created, then run: npm run deploy:rules';
const UPLOAD_HINT = 'Image upload timed out. Check your internet connection and the Cloudinary values in .env.local, then restart npm run dev.';

function formatAddress(order) {
  const c = order?.customer || {};
  const addr = order?.shippingAddress || order?.address || c?.address || c;
  let formatted = '';

  if (typeof addr === 'string' && addr.trim()) {
    formatted = addr.trim();
  } else if (addr && typeof addr === 'object') {
    const pin =
      addr.pincode ||
      addr.pinCode ||
      addr.pin ||
      addr.postalCode ||
      addr.zip ||
      addr.zipCode ||
      c.pincode ||
      c.pinCode ||
      c.pin ||
      c.postalCode ||
      c.zip ||
      order?.pincode ||
      order?.pinCode ||
      order?.pin ||
      '';

    const parts = [
      addr.line1 || addr.street || addr.addressLine1 || addr.doorNo || addr.house,
      addr.line2 || addr.landmark || addr.addressLine2 || addr.area,
      addr.city,
      addr.district,
      addr.state,
      pin,
      addr.country,
    ]
      .map(v => (typeof v === 'string' ? v.trim() : v))
      .filter(Boolean);

    formatted = parts.join(', ');
  }

  if (formatted && !/\b[1-9][0-9]{5}\b/.test(formatted)) {
    const rawText = JSON.stringify(order || {});
    const match = rawText.match(/\b[1-9][0-9]{5}\b/);
    if (match) formatted = `${formatted} - ${match[0]}`;
  }

  return formatted || '—';
}

export default function Admin() {
  const [user, setUser] = useState(undefined),
    [authorized, setAuthorized] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [tab, setTab] = useState('dashboard'),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [editing, setEditing] = useState(null),
    [selectedOrder, setSelectedOrder] = useState(null),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState({ storeName: 'Oosatyabhama', contactNumber: '', whatsappNumber: '', storeEmail: '', shippingCharges: 0, freeShippingThreshold: 0 });

  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u || null);
    if (u) {
      try {
        const t = await getIdTokenResult(u, true);
        setAuthorized(isAdminUser(u, t.claims));
      } catch {
        setAuthorized(false);
      }
    } else setAuthorized(false);
  }), []);

  async function refresh() {
    try {
      setProducts(await getProducts({ includeInactive: true }));
      const s = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      setOrders(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    if (user && authorized) refresh();
  }, [user, authorized]);

  async function login(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (user === undefined) return <div className="admin-shell">Loading administrator…</div>;
  if (!user) return (
    <main className="admin-shell">
      <form className="admin-login" onSubmit={login}>
        <span className="eyebrow">PRIVATE ACCESS</span>
        <h1>Admin sign in</h1>
        <p>Administrator accounts are created and authorized by the project owner. Public registration is disabled.</p>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button className="btn full">SIGN IN</button>
      </form>
    </main>
  );

  if (!authorized) return (
    <main className="admin-shell">
      <div className="admin-login">
        <h2>Access denied</h2>
        <p>This Firebase account does not have the trusted admin custom claim.</p>
        <button className="btn" onClick={() => signOut(auth)}>SIGN OUT</button>
      </div>
    </main>
  );

  const blank = { name: '', description: '', price: '', originalPrice: '', category: 'Cotton Kurtis', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], colors: ['Pink', 'Blue'], stock: 0, sku: '', featured: false, isNewArrival: false, isBestSeller: false, active: true, images: [] };
  const removeImage = i => setEditing(ed => ({ ...ed, images: (ed.images || []).filter((_, j) => j !== i), removedImages: [...(ed.removedImages || []), (ed.images || [])[i]] }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const uploaded = [];
    try {
      const f = new FormData(e.currentTarget), d = Object.fromEntries(f.entries());
      const id = editing?.id || `kurti-${Date.now()}`;
      const files = [...e.currentTarget.images.files];
      let images = [...(editing?.images || [])];
      for (const file of files) {
        const img = await withTimeout(uploadProductImage(file), 60000, UPLOAD_HINT);
        uploaded.push(img);
        images.push(img);
      }
      await withTimeout(saveProduct(id, {
        name: d.name,
        description: d.description,
        price: Number(d.price),
        originalPrice: Number(d.originalPrice || d.price),
        category: d.category,
        sizes: d.sizes.split(',').map(x => x.trim()).filter(Boolean),
        colors: d.colors.split(',').map(x => x.trim()).filter(Boolean),
        stock: Number(d.stock),
        sku: d.sku,
        featured: f.has('featured'),
        isNewArrival: f.has('isNewArrival'),
        isBestSeller: f.has('isBestSeller'),
        active: f.has('active'),
        images,
      }), 30000, SETUP_HINT);
      if (editing?.removedImages?.length) deleteProductImages(editing.removedImages).catch(() => toast('Product saved, but some old images could not be removed from storage.'));
      toast.success('Product saved');
      setEditing(null);
      refresh();
    } catch (e) {
      if (uploaded.length) deleteProductImages(uploaded).catch(() => {});
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function status(order, value) {
    if (value === 'Cancelled' && order.paymentStatus === 'Paid') {
      toast.error('Refund the payment in Razorpay before cancelling this paid order.');
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: value, updatedAt: serverTimestamp() });
      toast.success('Order updated');
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function tracking(order, value) {
    try {
      await updateDoc(doc(db, 'orders', order.id), { trackingNumber: value, updatedAt: serverTimestamp() });
      toast.success('Tracking information saved');
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const customerName = o => o?.customer?.fullName || o?.customer?.name || o?.shippingAddress?.fullName || '—';
  const customerPhone = o => o?.customer?.mobile || o?.customer?.phone || o?.shippingAddress?.mobile || o?.shippingAddress?.phone || '—';
  const customerEmail = o => o?.customer?.email || o?.shippingAddress?.email || '—';
  const orderItems = o => (Array.isArray(o?.items) ? o.items : Array.isArray(o?.products) ? o.products : []);

  return (
    <main className="admin-page">
      <aside className="admin-side">
        <h2>Oosatyabhama</h2>
        <small>STORE ADMIN</small>
        {['dashboard', 'products', 'orders', 'settings'].map(t => (
          <button key={t} className={tab === t ? 'current' : ''} onClick={() => { setTab(t); setEditing(null); }}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button onClick={() => signOut(auth)}>Sign out</button>
        <Link to="/">← View store</Link>
      </aside>

      <section className="admin-content">
        <div className="admin-top">
          <div>
            <span className="eyebrow">STORE MANAGEMENT</span>
            <h1>{tab[0].toUpperCase() + tab.slice(1)}</h1>
          </div>
          <button onClick={refresh}>Refresh data</button>
        </div>

        {tab === 'dashboard' && (
          <>
            <div className="stats">
              <div><small>PRODUCTS</small><strong>{products.length}</strong></div>
              <div><small>TOTAL ORDERS</small><strong>{orders.length}</strong></div>
              <div><small>PAID REVENUE</small><strong>{money(orders.filter(o => o.paymentStatus === 'Paid').reduce((s, o) => s + (o.total || 0), 0))}</strong></div>
              <div><small>PENDING</small><strong>{orders.filter(o => o.status === 'Pending').length}</strong></div>
            </div>
            <h3>Recent orders</h3>
            <OrderTable orders={orders.slice(0, 8)} status={status} tracking={tracking} onSelect={setSelectedOrder} customerName={customerName} customerPhone={customerPhone} />
          </>
        )}

        {tab === 'products' && (
          <>
            {!editing ? (
              <>
                <button className="btn" onClick={() => setEditing({ id: null, ...blank })}>+ Add product</button>
                <div className="admin-list">
                  {products.map(p => (
                    <div key={p.id} className="admin-item">
                      <img src={p.images?.[0]?.url || p.images?.[0] || ''} alt="" />
                      <div><b>{p.name}</b><small>{p.category} · {money(p.price)} · Stock {p.stock}</small></div>
                      <button onClick={() => setEditing({ ...p })}>Edit</button>
                      <button onClick={async () => {
                        if (confirm('Delete this product?')) {
                          await removeProduct(p.id);
                          deleteProductImages(p.images || []).catch(() => {});
                          refresh();
                        }
                      }}>Delete</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <form className="admin-form" onSubmit={save}>
                <h3>{editing.id ? 'Edit product' : 'New product'}</h3>
                <div className="form-grid">
                  <label>Name<input name="name" defaultValue={editing.name} required /></label>
                  <label>SKU<input name="sku" defaultValue={editing.sku} /></label>
                  <label>Price<input name="price" type="number" min="1" defaultValue={editing.price} required /></label>
                  <label>Original price<input name="originalPrice" type="number" defaultValue={editing.originalPrice} /></label>
                  <label>Category<select name="category" defaultValue={editing.category}>{['Cotton Kurtis', 'Anarkali Kurtis', 'Designer Kurtis', 'Party Wear Kurtis', 'Office Wear Kurtis'].map(x => <option key={x}>{x}</option>)}</select></label>
                  <label>Stock<input name="stock" type="number" min="0" defaultValue={editing.stock} /></label>
                  <label>Sizes (comma separated)<input name="sizes" defaultValue={[].concat(editing.sizes || []).join(',')} /></label>
                  <label>Colors (comma separated)<input name="colors" defaultValue={[].concat(editing.colors || []).join(',')} /></label>
                  <label className="span2">Description<textarea name="description" defaultValue={editing.description} /></label>
                  <label className="span2">Product images<input name="images" type="file" accept="image/*" multiple /></label>
                  {(editing.images || []).length > 0 && (
                    <div className="span2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {(editing.images || []).map((im, i) => (
                        <div key={(im?.url || im) + i} style={{ textAlign: 'center' }}>
                          <img src={im?.url || im} alt="" style={{ width: 72, height: 92, objectFit: 'cover', display: 'block', marginBottom: 4 }} />
                          <button type="button" onClick={() => removeImage(i)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="check-row">
                  {[['featured', 'Featured'], ['isNewArrival', 'New arrival'], ['isBestSeller', 'Best seller'], ['active', 'Active']].map(([k, n]) => (
                    <label key={k}><input type="checkbox" name={k} defaultChecked={editing[k]} />{n}</label>
                  ))}
                </div>
                <button className="btn" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PRODUCT'}</button>{' '}
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            )}
          </>
        )}

        {tab === 'orders' && (
          <OrderTable orders={orders} status={status} tracking={tracking} onSelect={setSelectedOrder} customerName={customerName} customerPhone={customerPhone} />
        )}

        {tab === 'settings' && (
          <form className="admin-form" onSubmit={async e => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await setDoc(doc(db, 'settings', 'store'), { ...d, shippingCharges: Number(d.shippingCharges), freeShippingThreshold: Number(d.freeShippingThreshold) }, { merge: true });
              toast.success('Settings updated');
            } catch (err) {
              toast.error('Create settings/store document once in Firestore, then retry. ' + err.message);
            }
          }}>
            <h3>Store settings</h3>
            <div className="form-grid">
              {Object.entries(settings).map(([k, v]) => (
                <label key={k}>{k.replace(/([A-Z])/g, ' $1')}<input name={k} defaultValue={v} /></label>
              ))}
            </div>
            <button className="btn">SAVE SETTINGS</button>
            <p className="fine">Payment method is fixed to Razorpay online only.</p>
          </form>
        )}

        {selectedOrder && (
          <div
            onClick={() => setSelectedOrder(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 9999,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                color: '#111',
                borderRadius: 8,
                padding: 20,
                maxWidth: 520,
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Order Details</h3>
                <button type="button" onClick={() => setSelectedOrder(null)}>Close</button>
              </div>
              <p style={{ margin: '6px 0' }}><strong>Order ID:</strong> {selectedOrder.id}</p>
              <p style={{ margin: '6px 0' }}><strong>Customer Name:</strong> {customerName(selectedOrder)}</p>
              <p style={{ margin: '6px 0' }}><strong>Phone:</strong> {customerPhone(selectedOrder)}</p>
              <p style={{ margin: '6px 0' }}><strong>Email:</strong> {customerEmail(selectedOrder)}</p>
              <p style={{ margin: '6px 0' }}><strong>Payment Status:</strong> {selectedOrder.paymentStatus || '—'} ({money(selectedOrder.total || 0)})</p>
              <p style={{ margin: '6px 0' }}><strong>Order Status:</strong> {selectedOrder.status || '—'}</p>
              <p style={{ margin: '6px 0' }}><strong>Tracking Number:</strong> {selectedOrder.trackingNumber || '—'}</p>
              <div style={{ marginTop: 10 }}>
                <strong>Shipping Address:</strong>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{formatAddress(selectedOrder)}</p>
              </div>
              {orderItems(selectedOrder).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Items:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {orderItems(selectedOrder).map((it, idx) => (
                      <li key={it?.id || it?.productId || idx}>
                        {it?.name || it?.title || 'Item'}
                        {it?.size ? ` (${it.size})` : ''}
                        {it?.color ? ` - ${it.color}` : ''} × {it?.quantity || it?.qty || 1}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function OrderTable({ orders, status, tracking, onSelect, customerName, customerPhone }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Order status</th>
            <th>Tracking number</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>
                {customerName(o)}
                <small>{customerPhone(o)}</small>
              </td>
              <td>{money(o.total)}</td>
              <td>{o.paymentStatus}</td>
              <td>
                <select value={o.status} onChange={e => status(o, e.target.value)}>
                  {['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  aria-label="Tracking number"
                  defaultValue={o.trackingNumber || ''}
                  onBlur={e => {
                    if (e.target.value !== (o.trackingNumber || '')) tracking(o, e.target.value);
                  }}
                  placeholder="Add tracking"
                />
              </td>
              <td>
                <button type="button" onClick={() => onSelect(o)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <p>No orders yet.</p>}
    </div>
  );
}
