import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getProducts } from '../services/products';
import ProductGrid from '../components/ProductGrid';

const HERO_SLIDES = [
  {
    eyebrow: 'THE NEW ETHNIC EDIT',
    titleLine1: 'Elegance that',
    titleItalic: 'feels like you.',
    description:
      'Beautifully expressive kurtis for everyday moments and celebrations alike.',
    ctaText: 'EXPLORE THE COLLECTION',
    ctaLink: '/products',
    desktopImg: '/hero-desktop.webp',
    mobileImg: '/hero-mobile.webp',
    alt: 'Oo Sathyabhama — Maroon & Antique Gold Ethnic Kurtis Collection',
    isPrimary: true,
  },
  {
    eyebrow: 'FESTIVE & CELEBRATION EDIT',
    titleLine1: 'Crafted for',
    titleItalic: 'golden moments.',
    description:
      'Rich embroidery, breathable weaves, and graceful silhouettes made to stand out.',
    ctaText: 'SHOP FESTIVE WEAR',
    ctaLink: '/category/Party%20Wear%20Kurtis',
    desktopImg: '/hero-desktop-2.webp',
    mobileImg: '/hero-mobile-2.webp',
    alt: 'Oo Sathyabhama — Festive & Celebration Ethnic Kurtis',
    isPrimary: false,
  },
  {
    eyebrow: 'EVERYDAY COMFORT EDIT',
    titleLine1: 'Soft cottons,',
    titleItalic: 'timeless grace.',
    description:
      'Light, airy daily kurtis designed for effortless comfort from morning to evening.',
    ctaText: 'SHOP COTTON KURTIS',
    ctaLink: '/category/Cotton%20Kurtis',
    desktopImg: '/hero-desktop-3.webp',
    mobileImg: '/hero-mobile-3.webp',
    alt: 'Oo Sathyabhama — Everyday Cotton Kurtis Collection',
    isPrimary: false,
  },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() =>
        setErr('Connect Firebase and add products to show your live collection.')
      );
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [paused]);

  const featuredList = products.filter((p) => p.featured);
  const displayProducts = [
    ...featuredList,
    ...products.filter((p) => !p.featured),
  ].slice(0, 8);

  const current = HERO_SLIDES[activeSlide];

  return (
    <>
      <section
        className="hero hero-banner"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <picture className="hero-media" key={current.desktopImg}>
          <source media="(max-width: 768px)" srcSet={current.mobileImg} />
          <img
            src={current.desktopImg}
            alt={current.alt}
            className="hero-bg-img"
            loading={current.isPrimary ? 'eager' : 'lazy'}
            fetchPriority={current.isPrimary ? 'high' : 'auto'}
          />
        </picture>

        <div className="hero-overlay" />

        <div className="hero-copy">
          <span className="eyebrow">{current.eyebrow}</span>
          <h1>
            {current.titleLine1}
            <br />
            <em>{current.titleItalic}</em>
          </h1>
          <p>{current.description}</p>
          <Link className="btn" to={current.ctaLink}>
            {current.ctaText}
          </Link>

          <div className="hero-dots" aria-label="Hero banner slides">
            {HERO_SLIDES.map((slide, idx) => (
              <button
                key={slide.eyebrow}
                type="button"
                className={`hero-dot ${idx === activeSlide ? 'active' : ''}`}
                onClick={() => setActiveSlide(idx)}
                aria-label={`Show slide ${idx + 1}: ${slide.eyebrow}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURATED FOR YOU</span>
            <h2>Shop the collection</h2>
          </div>
          <Link to="/products" className="text-link">
            View all styles →
          </Link>
        </div>
        <div className="category-tiles">
          {[
            'Cotton Kurtis',
            'Anarkali Kurtis',
            'Designer Kurtis',
            'Party Wear Kurtis',
          ].map((x, i) => (
            <Link
              to={`/category/${encodeURIComponent(x)}`}
              className={`category-tile tile-${i}`}
              key={x}
            >
              <span>{x}</span>
              <b>DISCOVER →</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="section blush">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE LOVED EDIT</span>
            <h2>Featured favourites</h2>
          </div>
          <Link to="/best-sellers" className="text-link">
            Shop best sellers →
          </Link>
        </div>
        {err && <p className="notice">{err}</p>}
        <ProductGrid products={displayProducts} />
        {displayProducts.length > 0 && (
          <div className="section-cta" style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/products" className="btn">
              VIEW MORE
            </Link>
          </div>
        )}
      </section>

      <section className="promise">
        <div>
          ✦ <b>Thoughtful styles</b>
          <small>For every day & occasion</small>
        </div>
        <div>
          ♡ <b>Easy shopping</b>
          <small>Checkout without an account</small>
        </div>
        <div>
          ⌁ <b>Secure payments</b>
          <small>Razorpay protected checkout</small>
        </div>
      </section>
    </>
  );
}
