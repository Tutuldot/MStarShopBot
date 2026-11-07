'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Layers, 
  AlertCircle,
  Radio,
  Sparkles,
  Link as LinkIcon,
  DownloadCloud,
  Check,
  Tag
} from 'lucide-react';

interface BasketSet {
  id: number;
  name: string;
  description: string;
  is_active: number;
  product_count: number;
  created_at: string;
}

interface Product {
  id: number;
  basket_set_id: number;
  name: string;
  price: number;
  price_max?: number | null;
  currency: string;
  description: string;
  image_url: string;
  product_url: string;
}

export default function BasketsPage() {
  const [sets, setSets] = useState<BasketSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewSetModal, setShowNewSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [activateImmediately, setActivateImmediately] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodPriceMax, setProdPriceMax] = useState('');
  const [isRangePrice, setIsRangePrice] = useState(false);
  const [prodCurrency, setProdCurrency] = useState('₱');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImg, setProdImg] = useState('');
  const [prodUrl, setProdUrl] = useState('');
  const [actionError, setActionError] = useState('');

  // Scraper Auto-fetch State
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  const fetchSets = async () => {
    try {
      const res = await fetch('/api/baskets');
      const data = await res.json();
      if (data.sets) {
        setSets(data.sets);
        if (!selectedSetId && data.sets.length > 0) {
          const active = data.sets.find((s: BasketSet) => s.is_active === 1);
          setSelectedSetId(active ? active.id : data.sets[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (setId: number) => {
    try {
      const res = await fetch(`/api/baskets/${setId}`);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      fetchProducts(selectedSetId);
    }
  }, [selectedSetId]);

  const handleActivateSet = async (setId: number) => {
    try {
      const res = await fetch(`/api/baskets/${setId}/activate`, { method: 'POST' });
      if (res.ok) {
        await fetchSets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) return;

    try {
      const res = await fetch('/api/baskets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSetName.trim(),
          description: newSetDesc.trim(),
          activateImmediately,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowNewSetModal(false);
        setNewSetName('');
        setNewSetDesc('');
        setActivateImmediately(false);
        await fetchSets();
        setSelectedSetId(data.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSet = async (setId: number) => {
    if (!confirm('Are you sure you want to delete this basket set and all its products?')) return;
    try {
      await fetch(`/api/baskets/${setId}`, { method: 'DELETE' });
      setSelectedSetId(null);
      await fetchSets();
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-fetch product details from WooCommerce URL
  const handleAutoFetch = async () => {
    const urlToFetch = (fetchUrl || prodUrl).trim();
    if (!urlToFetch) {
      setActionError('Please enter a product URL to fetch details from.');
      return;
    }

    setFetching(true);
    setActionError('');
    setFetchSuccess(false);

    try {
      const res = await fetch('/api/baskets/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch product details.');
      }

      const p = json.data;
      if (p.name) setProdName(p.name);
      if (p.product_url) setProdUrl(p.product_url);
      if (p.currency) setProdCurrency(p.currency);
      if (p.image_url) setProdImg(p.image_url);
      if (p.description) setProdDesc(p.description);

      // Handle prices
      if (p.price != null) {
        setProdPrice(p.price.toString());
      }
      if (p.price_max != null && p.price_max > (p.price || 0)) {
        setProdPriceMax(p.price_max.toString());
        setIsRangePrice(true);
      } else {
        setProdPriceMax('');
        setIsRangePrice(false);
      }

      setFetchSuccess(true);
      setTimeout(() => setFetchSuccess(false), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Error auto-fetching details');
    } finally {
      setFetching(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (!prodName.trim() || !prodUrl.trim()) {
      setActionError('Product Name and Product URL are required.');
      return;
    }

    const minPrice = parseFloat(prodPrice) || 0;
    const maxPrice = isRangePrice && prodPriceMax ? parseFloat(prodPriceMax) : null;

    if (isRangePrice && maxPrice != null && maxPrice < minPrice) {
      setActionError('Maximum price must be greater than minimum price.');
      return;
    }

    try {
      const payload = {
        name: prodName.trim(),
        price: minPrice,
        price_max: maxPrice,
        currency: prodCurrency.trim() || '₱',
        description: prodDesc.trim(),
        image_url: prodImg.trim(),
        product_url: prodUrl.trim(),
      };

      if (editingProductId) {
        const res = await fetch(`/api/baskets/products/${editingProductId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update product');
      } else {
        const res = await fetch(`/api/baskets/${selectedSetId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to add product');
      }

      setShowProductModal(false);
      resetProductForm();
      if (selectedSetId) {
        await fetchProducts(selectedSetId);
        await fetchSets();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error saving product');
    }
  };

  const handleDeleteProduct = async (prodId: number) => {
    if (!confirm('Delete this product from this basket?')) return;
    try {
      await fetch(`/api/baskets/products/${prodId}`, { method: 'DELETE' });
      if (selectedSetId) {
        await fetchProducts(selectedSetId);
        await fetchSets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdPrice(p.price.toString());
    setProdPriceMax(p.price_max ? p.price_max.toString() : '');
    setIsRangePrice(p.price_max != null && p.price_max > p.price);
    setProdCurrency(p.currency || '₱');
    setProdDesc(p.description || '');
    setProdImg(p.image_url || '');
    setProdUrl(p.product_url);
    setFetchUrl(p.product_url);
    setActionError('');
    setFetchSuccess(false);
    setShowProductModal(true);
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdPrice('');
    setProdPriceMax('');
    setIsRangePrice(false);
    setProdCurrency('₱');
    setProdDesc('');
    setProdImg('');
    setProdUrl('');
    setFetchUrl('');
    setActionError('');
    setFetchSuccess(false);
  };

  const formatPriceDisplay = (p: Product) => {
    const curr = p.currency || '₱';
    const min = Number(p.price) || 0;
    const max = p.price_max ? Number(p.price_max) : null;

    if (max && max > min) {
      return `${curr}${min.toLocaleString(undefined, { minimumFractionDigits: 2 })} – ${curr}${max.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    return `${curr}${min.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const selectedSet = sets.find((s) => s.id === selectedSetId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-brand-600" />
            <span>Product Basket Sets</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Group products into collections with auto-fetched WooCommerce details and price ranges. <span className="font-semibold text-slate-700">Only 1 basket set is activated at a time</span>.
          </p>
        </div>

        <button
          onClick={() => setShowNewSetModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Basket Set</span>
        </button>
      </div>

      {/* Main Grid: Basket Sets sidebar (1/3) & Products list (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Left Column: Basket Sets List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>All Sets ({sets.length})</span>
            </h2>
          </div>

          <div className="space-y-3">
            {sets.map((set) => {
              const isActive = set.is_active === 1;
              const isSelected = set.id === selectedSetId;

              return (
                <div
                  key={set.id}
                  onClick={() => setSelectedSetId(set.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-brand-500 bg-white ring-2 ring-brand-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{set.name}</h3>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {set.description || 'No description provided'}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSet(set.id);
                      }}
                      title="Delete set"
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      {set.product_count} product{set.product_count === 1 ? '' : 's'}
                    </span>

                    {!isActive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActivateSet(set.id);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Radio className="w-3 h-3" />
                        <span>Activate Set</span>
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-semibold text-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Live in Bot
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Products in the Selected Basket */}
        <div className="lg:col-span-8">
          {selectedSet ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              {/* Set Title and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedSet.name}</h2>
                    {selectedSet.is_active === 1 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Active in Bot
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        Inactive Set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedSet.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedSet.is_active !== 1 && (
                    <button
                      onClick={() => handleActivateSet(selectedSet.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Make This Active Set</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      resetProductForm();
                      setShowProductModal(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>

              {/* Products List */}
              <div className="mt-5 space-y-4">
                {products.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                    <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-700">No products in this basket set</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Click &quot;Add Product&quot; to auto-fetch details directly from your WooCommerce store URL.
                    </p>
                    <button
                      onClick={() => {
                        resetProductForm();
                        setShowProductModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
                    >
                      Add First Product
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((p) => {
                      const hasRange = p.price_max != null && p.price_max > p.price;

                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex flex-col justify-between transition-colors shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="text-sm font-bold text-slate-900 truncate" title={p.name}>
                                  {p.name}
                                </h4>
                              </div>

                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-extrabold text-brand-700">
                                  {formatPriceDisplay(p)}
                                </span>
                                {hasRange && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.2 rounded-full">
                                    Price Range
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                                {p.description || 'No description'}
                              </p>
                            </div>
                          </div>

                          {/* Product URL Link to PHP Store */}
                          <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                            <a
                              href={p.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 truncate max-w-[200px]"
                              title={p.product_url}
                            >
                              <LinkIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate">WooCommerce Link</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-200/60"
                                title="Edit product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">Select a basket set to view products</div>
          )}
        </div>
      </div>

      {/* Modal: Create New Basket Set */}
      {showNewSetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create Basket Set</h3>
            <p className="text-xs text-slate-500 mb-4">
              Group products together into a promotional set.
            </p>

            <form onSubmit={handleCreateSet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Set Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 18k Luxury Necklaces Collection"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="Featured items to pitch to Messenger inquiries..."
                  value={newSetDesc}
                  onChange={(e) => setNewSetDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activateNow"
                  checked={activateImmediately}
                  onChange={(e) => setActivateImmediately(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="activateNow" className="text-xs font-medium text-slate-700">
                  Activate this set immediately (deactivates other sets)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewSetModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm"
                >
                  Create Set
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Product (With Auto-Fetch & Price Range) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingProductId ? 'Edit Product' : 'Add Product to Basket'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste a WooCommerce URL to auto-fill details, or type them manually.
            </p>

            {/* Auto-Fetch Box */}
            <div className="mb-5 p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-xl">
              <label className="block text-xs font-bold text-purple-950 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Auto-Fetch from WooCommerce / Site URL</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://missmorningstar.com/product/..."
                  value={fetchUrl || prodUrl}
                  onChange={(e) => {
                    setFetchUrl(e.target.value);
                    setProdUrl(e.target.value);
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  disabled={fetching}
                  onClick={handleAutoFetch}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                >
                  {fetching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <DownloadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>{fetching ? 'Fetching...' : 'Fetch Details'}</span>
                </button>
              </div>

              {fetchSuccess && (
                <div className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Product title, price range, image, and description fetched!</span>
                </div>
              )}
            </div>

            {actionError && (
              <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="MsMorningstar 18k Premium Ball & Lock Necklace"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              {/* Price Range Controls */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-600" />
                    <span>Pricing &amp; Currency</span>
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRangePrice}
                      onChange={(e) => {
                        setIsRangePrice(e.target.checked);
                        if (!e.target.checked) setProdPriceMax('');
                      }}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Enable Price Range (Min – Max)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      value={prodCurrency}
                      onChange={(e) => setProdCurrency(e.target.value)}
                      placeholder="₱"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none text-center font-bold"
                    />
                  </div>

                  {!isRangePrice ? (
                    <div className="col-span-9">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="41715.00"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Min Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="41715.00"
                          value={prodPrice}
                          onChange={(e) => setProdPrice(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Max Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required={isRangePrice}
                          placeholder="42468.00"
                          value={prodPriceMax}
                          onChange={(e) => setProdPriceMax(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                {isRangePrice && prodPrice && prodPriceMax && (
                  <div className="text-[11px] text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                    Preview: <strong className="font-semibold">{prodCurrency}{Number(prodPrice).toLocaleString()} – {prodCurrency}{Number(prodPriceMax).toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Product URL (on your WooCommerce / PHP Store) *
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://missmorningstar.com/product/..."
                    value={prodUrl}
                    onChange={(e) => {
                      setProdUrl(e.target.value);
                      setFetchUrl(e.target.value);
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Image URL
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={prodImg}
                    onChange={(e) => setProdImg(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                  {prodImg && (
                    <img
                      src={prodImg}
                      alt="Preview"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description / Features
                </label>
                <textarea
                  rows={2}
                  placeholder="Key product highlights for customers..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
