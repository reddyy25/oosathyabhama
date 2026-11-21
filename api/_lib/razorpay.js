// Minimal Razorpay REST client (no extra npm package). Docs: https://razorpay.com/docs/api/
import { httpError } from './errors.js';

export function razorpayClient({ keyId, keySecret, fetchImpl = fetch }) {
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  async function call(method, path, body) {
    const r = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw httpError(r.status === 401 ? 500 : 502, data?.error?.description || `Razorpay error (${r.status})`);
    return data;
  }
  const id = (x) => encodeURIComponent(x);
  return {
    createOrder: (b) => call('POST', '/orders', b),
    fetchPayment: (pid) => call('GET', `/payments/${id(pid)}`),
    capture: (pid, b) => call('POST', `/payments/${id(pid)}/capture`, b),
    refund: (pid, b) => call('POST', `/payments/${id(pid)}/refund`, b),
  };
}
