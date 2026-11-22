import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct } from '../services/products';
import { useShop } from '../context/ShopContext';
import { money } from '../utils/format';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [copied, setCopied] = useState(false);
  const { add } = useShop();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProduct(id)
      .then((x) => {
        if (!active) return;
        setP(x || null);
        setSize(x?.sizes?.[0] || '');
        setColor(x?.colors?.[0] || '');
      })
      .catch(() => {
        if (!active) return;
        setP(null);
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

  return (
    <main className="detail page-wrap">
      <div className="detail-images">
        {images.map((im, i) => (
          <img key={i} src={im.url || im} alt={`${p.name} ${i + 1}`} />
        ))}
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
          className="btn full"
          disabled={!p.stock || !size}
          onClick={() => {
            add(p, size, color);
            toast.success('Added to your bag');
          }}
        >
          ADD TO BAG
        </button>

        <div className="share-row">
          <span className="share-label">Share:</span>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn"
          >
            WhatsApp
          </a>
          <button
            type="button"
            className="share-btn"
            onClick={handleNativeShare}
          >
            Share
          </button>
          <button
            type="button"
            className="share-btn"
            onClick={handleCopyLink}
          >
            {copied ? 'Copied ✓' : 'Copy Link'}
          </button>
        </div>

        <p className="fine">
          Secure online payment through Razorpay. No account required.
        </p>
      </div>
    </main>
  );
}
