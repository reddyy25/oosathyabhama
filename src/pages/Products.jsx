import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProducts } from '../services/products';
import ProductGrid from '../components/ProductGrid';

export default function Products({ flag }) {
  const { category } = useParams();
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('All');
  const [sort, setSort] = useState('featured');
  const [max, setMax] = useState(10000);
  const [error, setError] = useState('');

  const cat = category ? decodeURIComponent(category) : '';

  useEffect(() => {
    getProducts({ category: cat, flag })
      .then(setAll)
      .catch(() =>
        setError(
          'Products will appear here after Firebase is configured and the catalogue is seeded.'
        )
      );
  }, [cat, flag]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();

    return all
      .filter((p) => {
        const matchesSearch =
          !q ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.SKU || '').toLowerCase().includes(q) ||
          (p.productCode || '').toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q);

        const matchesSize = size === 'All' || p.sizes?.includes(size);
        const matchesPrice = Number(p.price) <= max;

        return matchesSearch && matchesSize && matchesPrice;
      })
      .sort((a, b) =>
        sort === 'low'
          ? a.price - b.price
          : sort === 'high'
          ? b.price - a.price
          : sort === 'new'
          ? (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          : 0
      );
  }, [all, search, size, sort, max]);

  const title =
    flag === 'new'
      ? 'New Arrivals'
      : flag === 'best'
      ? 'Best Sellers'
      : cat || 'Shop All Kurtis';

  return (
    <main className="page-wrap">
      <div className="page-title">
        <span className="eyebrow">THE OOSATYABHAMA EDIT</span>
        <h1>{title}</h1>
        <p>Find a style that feels unmistakably yours.</p>
      </div>
      <div className="filters">
        <input
          placeholder="Search kurtis or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option>All</option>
          {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">Sort: Featured</option>
          <option value="low">Price: Low to high</option>
          <option value="high">Price: High to low</option>
          <option value="new">Newest</option>
        </select>
        <label>
          Up to ₹{max.toLocaleString('en-IN')}
          <input
            type="range"
            min="500"
            max="10000"
            step="250"
            value={max}
            onChange={(e) => setMax(+e.target.value)}
          />
        </label>
      </div>
      {error && <p className="notice">{error}</p>}
      <ProductGrid products={items} />
    </main>
  );
}
