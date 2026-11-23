import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, getProducts } from '../services/products';
import { useShop } from '../context/ShopContext';
import { money } from '../utils/format';
import ProductGrid from '../components/ProductGrid';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [copied, setCopied] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const { add } = useShop();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setZoomImg(null);
    setZoomed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    getProduct(id)
      .then(async (x) => {
        if (!active) return;
        setP(x || null);
        setSize(x?.sizes?.[0] || '');
        setColor(x?.colors?.[0] || '');

        if (x) {
          const allProducts = await getProducts();
          if (!active) return;
          const others = allProducts.filter((item) => item.id !== x.id);
          const sameCategory = others.filter(
            (item) => item.category === x.category
          );
          const differentCategory = others.filter(
            (item) => item.category !== x.category
          );
          setRelated([...sameCategory, ...differentCategory].slice(0, 4));
        } else {
          setRelated([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setP(null);
        setRelated([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="page-wrap empty">
        <h2>Loading product...</h2>
      </main>
    );
  }

  if (!p) {
    return (
      <main className="page-wrap empty">
        <h2>Product not available</h2>
        <Link to="/products">Back to shop</Link>
      </main>
    );
  }

  const images = p.images || [];
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Check out ${p.name} (${money(p.price)}) at Oo Sathyabhama:`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: p.name,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      handleCopyLink();
    }
  };

  const closeLightbox = () => {
    setZoomImg(null);
    setZoomed(false);
  };

  return (
    <>
      <main className="detail page-wrap">
        <div className="detail-images">
          {images.map((im, i) => {
            const src = im.url || im;
            return (
              <button
                type="button"
                className="detail-img-btn"
                key={i}
                onClick={() => {
                  setZoomImg(src);
                  setZoomed(false);
                }}
                aria-label={`View ${p.name} image ${i + 1} larger`}
              >
                <img
                  src={src}
                  alt={`${p.name} ${i + 1}`}
                  className="detail-main-img"
                />
                <span className="img-zoom-hint">Tap to zoom</span>
              </button>
            );
          })}
        </div>

        <div className="detail-copy">
          <span className="eyebrow">{p.category}</span>
          <h1>{p.name}</h1>
          <div className="price large">
            {money(p.price)}{' '}
            {p.originalPrice > p.price && <del>{money(p.originalPrice)}</del>}
          </div>
          <p>{p.description}</p>

          <label>Size</label>
          <div className="chips">
            {(p.sizes || []).map((s) => (
              <button
                type="button"
                className={size === s ? 'active' : ''}
                onClick={() => setSize(s)}
                key={s}
              >
                {s}
              </button>
            ))}
          </div>

          <label>Colour</label>
          <div className="chips">
            {(p.colors || []).map((c) => (
              <button
                type="button"
                className={color === c ? 'active' : ''}
                onClick={() => setColor(c)}
                key={c}
              >
                {c}
              </button>
            ))}
          </div>

          <p className="stock">
            {p.stock > 0 ? `${p.stock} pieces available` : 'Currently out of stock'}
          </p>

          <button
            type="button"
            className="btn full"
            disabled={!p.stock || !size}
            onClick={() => {
              add(p, size, color);
              toast.success('Added to your bag');
            }}
          >
            ADD TO BAG
          </button>

          <div className="share-block">
            <span className="share-title">Share this product</span>
            <div className="share-pills">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="share-pill"
                aria-label="Share on WhatsApp"
                title="Share on WhatsApp"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </a>

              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  shareUrl
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-pill"
                aria-label="Share on Facebook"
                title="Share on Facebook"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.7v3.2h2.8V22h3z" />
                </svg>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `${shareText} ${shareUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-pill"
                aria-label="Share on X"
                title="Share on X"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              <a
                href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
                  shareUrl
                )}&description=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-pill"
                aria-label="Share on Pinterest"
                title="Share on Pinterest"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M10.2 20.6l1.3-5.2" />
                  <path d="M9.6 13.8c-.4-1.2.2-2.8 1.5-3.3 1.4-.5 2.9.3 3.1 1.8.2 1.6-.7 3.2-2.2 3.2-.8 0-1.4-.5-1.5-1.2" />
                </svg>
              </a>

              <button
                type="button"
                className="share-pill"
                onClick={handleNativeShare}
                aria-label="Share product"
                title="Share"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>

              <button
                type="button"
                className={`share-pill ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
                aria-label="Copy product link"
                title={copied ? 'Copied!' : 'Copy Link'}
              >
                {copied ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <p className="fine">
            Secure online payment through Razorpay. No account required.
          </p>
        </div>
      </main>

      {related.length > 0 && (
        <section className="section blush">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMPLETE YOUR WARDROBE</span>
              <h2>You may also like</h2>
            </div>
            <Link
              to={
                p.category
                  ? `/category/${encodeURIComponent(p.category)}`
                  : '/products'
              }
              className="text-link"
            >
              View more styles →
            </Link>
          </div>
          <ProductGrid products={related} />
        </section>
      )}

      {zoomImg && (
        <div className="img-lightbox" onClick={closeLightbox}>
          <div
            className="img-lightbox-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="img-lightbox-bar">
              <button
                type="button"
                className="lightbox-action"
                onClick={() => setZoomed((prev) => !prev)}
              >
                {zoomed ? 'Reset Zoom' : 'Zoom In +'}
              </button>
              <button
                type="button"
                className="lightbox-close"
                onClick={closeLightbox}
                aria-label="Close image preview"
              >
                ✕
              </button>
            </div>
            <div
              className={`img-lightbox-stage ${zoomed ? 'is-zoomed' : ''}`}
              onClick={() => setZoomed((prev) => !prev)}
            >
              <img src={zoomImg} alt={p.name} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
