import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase/firebase';

const content = {
  about: [
    'Our story',
    'Oosatyabhama celebrates the confidence and individuality of women through thoughtfully selected ethnic wear. Our philosophy is simple: everyday comfort can be beautifully elegant.',
  ],
  contact: [
    'Contact us',
    'For product, order or delivery questions, please contact our store team using the contact details shared by the store.',
  ],
  privacy: [
    'Privacy policy',
    'We collect the details you provide at checkout only to process and deliver your order, provide support and meet legal requirements. Payment details are handled by Razorpay; we do not store full card or UPI credentials. We use appropriate safeguards and retain order information only as required for business and legal purposes.',
  ],
  terms: [
    'Terms & conditions',
    'By using this website, you agree to provide accurate checkout information. Product images are representative; slight colour variations may occur due to display settings. Prices, availability and descriptions may be updated. Orders are subject to stock validation and successful Razorpay payment verification.',
  ],
  shipping: [
    'Shipping policy',
    'Orders are processed after successful payment verification. Delivery timelines and shipping charges, where applicable, are shown or confirmed before dispatch. Delivery can vary by PIN code, courier availability and unforeseen circumstances. Tracking details are added by the store when the parcel is dispatched.',
  ],
  returns: [
    'Return & refund policy',
    'For return or exchange assistance, contact the store with your order reference and clear product images within the return window communicated by the store. Items must be unused and in original condition with tags. Approved refunds are processed to the original payment method, subject to payment provider timelines. Shipping and return eligibility may vary by product and reason.',
  ],
};

export default function Info({ type }) {
  const [title, body] = content[type] || content.about;
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  useEffect(() => {
    if (type !== 'contact' || !firebaseConfigured) return;

    let active = true;
    setLoadingSettings(true);

    const loadStoreSettings = async () => {
      try {
        let snap = await getDoc(doc(db, 'settings', 'store'));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'store', 'settings'));
        }
        if (!active) return;
        setSettings(snap.exists() ? snap.data() : null);
      } catch {
        if (!active) return;
        setSettings(null);
      } finally {
        if (active) setLoadingSettings(false);
      }
    };

    loadStoreSettings();
    return () => {
      active = false;
    };
  }, [type]);

  const storeName =
    settings?.storeName || settings?.['store Name'] || 'Oosatyabhama';
  const contactNumber =
    settings?.contactNumber ||
    settings?.['contact Number'] ||
    settings?.phone ||
    '';
  const whatsappNumber =
    settings?.whatsappNumber ||
    settings?.['whatsapp Number'] ||
    settings?.whatsapp ||
    contactNumber;
  const storeEmail =
    settings?.storeEmail ||
    settings?.['store Email'] ||
    settings?.email ||
    '';

  const cleanPhone = String(contactNumber).replace(/[^\d+]/g, '');
  const cleanWhatsapp = String(whatsappNumber).replace(/\D/g, '');
  const hasContactDetails = Boolean(
    contactNumber || whatsappNumber || storeEmail
  );

  return (
    <main className="page-wrap narrow">
      <div className="page-title">
        <span className="eyebrow">{String(storeName).toUpperCase()}</span>
        <h1>{title}</h1>
      </div>

      <div className="policy-copy">
        <p>{body}</p>

        {type === 'contact' && (
          <>
            {loadingSettings ? (
              <p>Loading contact details...</p>
            ) : hasContactDetails ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '14px',
                  marginTop: '24px',
                }}
              >
                {contactNumber && (
                  <div
                    style={{
                      border: '1px solid #eee2df',
                      background: '#fff8f6',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <small
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        letterSpacing: '1.4px',
                        color: '#812d4b',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      CONTACT NUMBER
                    </small>
                    <a
                      href={`tel:${cleanPhone}`}
                      style={{ fontWeight: 600, color: '#39232b' }}
                    >
                      {contactNumber}
                    </a>
                  </div>
                )}

                {whatsappNumber && (
                  <div
                    style={{
                      border: '1px solid #eee2df',
                      background: '#fff8f6',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <small
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        letterSpacing: '1.4px',
                        color: '#812d4b',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      WHATSAPP NUMBER
                    </small>
                    <a
                      href={`https://wa.me/${cleanWhatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: '#39232b' }}
                    >
                      {whatsappNumber}
                    </a>
                  </div>
                )}

                {storeEmail && (
                  <div
                    style={{
                      border: '1px solid #eee2df',
                      background: '#fff8f6',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <small
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        letterSpacing: '1.4px',
                        color: '#812d4b',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      STORE EMAIL
                    </small>
                    <a
                      href={`mailto:${storeEmail}`}
                      style={{
                        fontWeight: 600,
                        color: '#39232b',
                        wordBreak: 'break-word',
                      }}
                    >
                      {storeEmail}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p>
                Please add your official phone, WhatsApp and email in Admin →
                Settings after setup.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
