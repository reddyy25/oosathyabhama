import { useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { money } from '../utils/format';

export function OrderSuccess() {
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);

  const orderId = state?.orderId || localStorage.getItem('last_order_id') || '';

  useEffect(() => {
    if (state?.orderId) {
      localStorage.setItem('last_order_id', state.orderId);
    }
  }, [state?.orderId]);

  const handleCopy = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trackUrl = `${window.location.origin}/tracking`;
  const waText = encodeURIComponent(
    `Oosathyabhama Order Confirmed!\nOrder Reference: ${orderId}\nTrack your order here: ${trackUrl}`
  );
  const waUrl = `https://wa.me/?text=${waText}`;

  return (
    <main className="page-wrap empty">
      <div className="success-mark">✓</div>
      <span className="eyebrow">PAYMENT VERIFIED</span>
      <h1>Thank you for your order.</h1>
      <p>Your payment has been verified and your order is confirmed.</p>

      {orderId && (
        <>
          <p>
            Order reference: <b>{orderId}</b>
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button type="button" className="btn" onClick={handleCopy}>
              {copied ? 'COPIED ✓' : 'COPY ORDER ID'}
            </button>
            <a
              className="btn"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: '#25D366', color: '#fff', borderColor: '#25D366' }}
            >
              SAVE ON WHATSAPP
            </a>
          </div>
        </>
      )}

      <Link className="btn" to="/tracking">TRACK YOUR ORDER</Link>
    </main>
  );
}

export function Tracking() {
  const [id, setId] = useState('');
  const [mobile, setMobile] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function track(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api('track-order', { orderId: id.trim(), mobile: mobile.trim() }));
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-wrap narrow">
      <div className="page-title">
        <span className="eyebrow">STAY IN THE LOOP</span>
        <h1>Track your order</h1>
        <p>Enter your order reference and delivery mobile number.</p>
      </div>
      <form className="checkout-form" onSubmit={track}>
        <label>
          Order reference
          <input required value={id} onChange={e => setId(e.target.value)} />
        </label>
        <label>
          Mobile number
          <input required maxLength="10" value={mobile} onChange={e => setMobile(e.target.value)} />
        </label>
        <button className="btn full" disabled={busy}>
          {busy ? 'CHECKING…' : 'FIND MY ORDER'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      {result && (
        <div className="tracking-result">
          <h3>{result.orderId}</h3>
          <p>Status: <b>{result.status}</b></p>
          <p>Payment: <b>{result.paymentStatus}</b></p>
          {result.trackingNumber && <p>Tracking: {result.trackingNumber}</p>}
        </div>
      )}
    </main>
  );
}

export function Wishlist() {
  return (
    <main className="page-wrap empty">
      <h1>Your wishlist</h1>
      <p>Saved styles are kept on this device.</p>
      <Link className="btn" to="/products">EXPLORE STYLES</Link>
    </main>
  );
}
