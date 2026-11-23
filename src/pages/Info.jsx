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
  return (
    <main className="page-wrap narrow">
      <div className="page-title">
        <span className="eyebrow">OOSATYABHAMA</span>
        <h1>{title}</h1>
      </div>
      <div className="policy-copy">
        <p>{body}</p>
        {type === 'contact' && (
          <p>
            Please add your official phone, WhatsApp and email in Admin → Settings
            after setup.
          </p>
        )}
      </div>
    </main>
  );
}
