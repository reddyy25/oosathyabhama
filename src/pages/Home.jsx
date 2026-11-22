import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getProducts } from '../services/products';
import ProductGrid from '../components/ProductGrid';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() =>
        setErr('Connect Firebase and add products to show your live collection.')
      );
  }, []);

  const featuredList = products.filter((p) => p.featured);
  const displayProducts = [
    ...featuredList,
    ...products.filter((p) => !p.featured),
  ].slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE NEW ETHNIC EDIT</span>
          <h1>
            Elegance that
            <br />
            <em>feels like you.</em>
          </h1>
          <p>
            Beautifully expressive kurtis for everyday moments and celebrations
            alike.
          </p>
          <Link className="btn" to="/products">
            EXPLORE THE COLLECTION
          </Link>
        </div>
        <div className="hero-art">
          <div className="hero-circle">
            <span>
              STYLE
              <br />
              YOUR
              <br />
              STORY
            </span>
          </div>
          <div className="hero-note">
            A timeless kind of beautiful <b>✦</b>
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
