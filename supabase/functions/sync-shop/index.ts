// Keeps the Wichita Life shop row on Explore up to date from the Shopify store's public product
// list. Runs every 6 hours. Sold-out products, and products taken off the store, are hidden.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';

const STORE = 'https://wichitalifeshop.myshopify.com';
const UA = 'Mozilla/5.0 (compatible; WichitaLifeApp/1.0; +https://wichitalifeict.com)';

type Product = {
  id: number;
  handle: string;
  title: string;
  variants: { price: string; available: boolean }[];
  images: { src: string }[];
};

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  const res = await fetch(`${STORE}/products.json?limit=250`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return json({ error: `Shopify: HTTP ${res.status}` }, 502);
  const { products } = (await res.json()) as { products?: Product[] };
  if (!Array.isArray(products)) return json({ error: 'Shopify: no product list' }, 502);

  const now = new Date().toISOString();
  const rows = products.map((p, i) => {
    const inStock = p.variants.filter((v) => v.available);
    const prices = (inStock.length ? inStock : p.variants).map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
    const image = p.images[0]?.src;
    return {
      id: p.id,
      handle: p.handle,
      title: p.title.trim(),
      price: prices.length ? Math.min(...prices) : 0,
      image_url: image?.startsWith('https://') ? image : null,
      url: `${STORE}/products/${encodeURIComponent(p.handle)}`,
      available: inStock.length > 0 && prices.length > 0,
      position: i,
      synced_at: now,
    };
  });

  const db = adminClient();
  if (rows.length) {
    const { error } = await db.from('shop_products').upsert(rows, { onConflict: 'id' });
    if (error) return json({ error: error.message }, 500);
  }
  // Products no longer on the store are hidden too.
  let gone = db.from('shop_products').update({ available: false }).eq('available', true);
  if (rows.length) gone = gone.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`);
  const { data: removed, error } = await gone.select('id');
  if (error) return json({ error: error.message }, 500);

  return json({ products: rows.length, inStock: rows.filter((r) => r.available).length, removed: removed?.length ?? 0 });
});
