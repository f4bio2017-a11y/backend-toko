(() => {
  'use strict';

  const API_BASE = '/api';
  const STORAGE_TOKEN = 'bs_token';
  const STORAGE_USER = 'bs_user';
  const STORAGE_CART = 'bs_cart';

  const state = {
    products: [],
    filteredCategory: 'all',
    searchTerm: '',
    cart: loadCart(),
    user: loadUser(),
    token: localStorage.getItem(STORAGE_TOKEN) || null,
    view: 'catalog',
  };

  // === Helpers ===
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_CART)) || []; }
    catch { return []; }
  }
  function saveCart() { localStorage.setItem(STORAGE_CART, JSON.stringify(state.cart)); }
  function loadUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER)) || null; }
    catch { return null; }
  }

  function formatIDR(n) {
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }

  function colorForName(name) {
    const palette = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#06b6d4,#3b82f6)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#10b981,#06b6d4)',
      'linear-gradient(135deg,#ec4899,#f43f5e)',
      'linear-gradient(135deg,#84cc16,#22c55e)',
      'linear-gradient(135deg,#f97316,#eab308)',
      'linear-gradient(135deg,#0ea5e9,#6366f1)',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  function toast(msg, kind = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.classList.remove('show'); }, 2400);
  }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(API_BASE + path, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch { /* non-json */ }
    if (!res.ok) {
      const msg = (body && body.message) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // === Auth ===
  function setAuth(user, token) {
    state.user = user;
    state.token = token;
    if (user && token) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_USER);
      localStorage.removeItem(STORAGE_TOKEN);
    }
    renderAuthUI();
  }

  function renderAuthUI() {
    const loginBtn = $('#loginBtn');
    const userMenu = $('.user-menu');
    const userName = $('#userName');
    if (state.user) {
      loginBtn.hidden = true;
      userMenu.hidden = false;
      userName.textContent = state.user.username || state.user.email;
    } else {
      loginBtn.hidden = false;
      userMenu.hidden = true;
    }
    // Show/hide auth-only nav
    $$('.nav-link[data-auth-only]').forEach(el => {
      el.style.display = state.user ? '' : 'none';
    });
  }

  function openAuthModal(tab = 'login') {
    $('#authModal').setAttribute('aria-hidden', 'false');
    switchAuthTab(tab);
  }
  function closeAuthModal() { $('#authModal').setAttribute('aria-hidden', 'true'); }
  function switchAuthTab(tab) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $('#loginForm').hidden = tab !== 'login';
    $('#registerForm').hidden = tab !== 'register';
    $('#authTitle').textContent = tab === 'login' ? 'Masuk' : 'Daftar Akun';
    // Re-render Google button after form becomes visible (so width is correct)
    if (typeof renderGoogleButtons === 'function') setTimeout(renderGoogleButtons, 0);
  }

  // === Products ===
  async function loadProducts() {
    try {
      const res = await api('/products');
      state.products = (res.data || []).filter(p => p.is_active !== false);
      renderCategories();
      renderProducts();
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        // Backend requires auth even for browsing — prompt login
        $('#productGrid').innerHTML = `<div class="empty">Silakan <a href="#" id="loginInline" style="color:var(--accent)">masuk</a> untuk melihat katalog produk.</div>`;
        $('#loginInline').addEventListener('click', (ev) => { ev.preventDefault(); openAuthModal('login'); });
      } else {
        $('#productGrid').innerHTML = `<div class="empty">Gagal memuat produk: ${e.message}</div>`;
      }
    }
  }

  function renderCategories() {
    const cats = Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort();
    const wrap = $('#categoryChips');
    wrap.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'chip' + (state.filteredCategory === 'all' ? ' active' : '');
    all.textContent = 'Semua';
    all.onclick = () => { state.filteredCategory = 'all'; renderCategories(); renderProducts(); };
    wrap.appendChild(all);
    cats.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.filteredCategory === cat ? ' active' : '');
      chip.textContent = cat;
      chip.onclick = () => { state.filteredCategory = cat; renderCategories(); renderProducts(); };
      wrap.appendChild(chip);
    });
  }

  function renderProducts() {
    const grid = $('#productGrid');
    const term = state.searchTerm.trim().toLowerCase();
    const items = state.products.filter(p => {
      const matchCat = state.filteredCategory === 'all' || p.category === state.filteredCategory;
      const matchTerm = !term || (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
      return matchCat && matchTerm;
    });
    if (items.length === 0) {
      grid.innerHTML = '<div class="empty">Tidak ada produk yang cocok.</div>';
      return;
    }
    grid.innerHTML = items.map(p => {
      const outOfStock = (p.stock || 0) <= 0;
      const initial = (p.name || '?').trim().charAt(0).toUpperCase();
      return `
        <article class="card">
          <div class="card-img" style="background:${colorForName(p.name || '')}">${initial}</div>
          <div class="card-body">
            ${p.category ? `<div class="card-cat">${escapeHtml(p.category)}</div>` : ''}
            <h3 class="card-name">${escapeHtml(p.name || '-')}</h3>
            <div class="card-foot">
              <span class="card-price">${formatIDR(p.price)}</span>
              ${outOfStock
                ? '<span class="card-stock-out">Stok habis</span>'
                : `<button class="btn-add" data-add="${p.id}">Tambah</button>`}
            </div>
          </div>
        </article>
      `;
    }).join('');
    grid.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => addToCart(parseInt(btn.dataset.add, 10)));
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // === Cart ===
  function addToCart(productId) {
    const p = state.products.find(x => x.id === productId);
    if (!p) return;
    const existing = state.cart.find(x => x.id === productId);
    if (existing) {
      if (existing.qty + 1 > p.stock) { toast('Stok tidak cukup', 'error'); return; }
      existing.qty += 1;
    } else {
      state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock });
    }
    saveCart();
    renderCart();
    toast(`${p.name} ditambahkan`, 'success');
  }

  function changeQty(id, delta) {
    const item = state.cart.find(x => x.id === id);
    if (!item) return;
    const prod = state.products.find(p => p.id === id);
    const max = prod ? prod.stock : item.stock;
    const next = item.qty + delta;
    if (next <= 0) { state.cart = state.cart.filter(x => x.id !== id); }
    else if (next > max) { toast('Stok tidak cukup', 'error'); return; }
    else { item.qty = next; }
    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(x => x.id !== id);
    saveCart();
    renderCart();
  }

  function cartTotal() {
    return state.cart.reduce((sum, it) => sum + Number(it.price) * it.qty, 0);
  }

  function renderCart() {
    const badge = $('#cartBadge');
    const count = state.cart.reduce((s, x) => s + x.qty, 0);
    badge.textContent = count;
    badge.dataset.empty = count === 0;
    const wrap = $('#cartItems');
    if (state.cart.length === 0) {
      wrap.innerHTML = '<div class="empty">Keranjang kosong</div>';
    } else {
      wrap.innerHTML = state.cart.map(it => {
        const initial = (it.name || '?').trim().charAt(0).toUpperCase();
        return `
          <div class="cart-item">
            <div class="cart-thumb" style="background:${colorForName(it.name || '')}">${initial}</div>
            <div class="cart-info">
              <div class="cart-name">${escapeHtml(it.name)}</div>
              <div class="cart-price">${formatIDR(it.price)} × ${it.qty} = <strong>${formatIDR(it.price * it.qty)}</strong></div>
              <button class="cart-remove" data-remove="${it.id}">Hapus</button>
            </div>
            <div class="qty">
              <button data-dec="${it.id}" aria-label="Kurangi">−</button>
              <span>${it.qty}</span>
              <button data-inc="${it.id}" aria-label="Tambah">+</button>
            </div>
          </div>
        `;
      }).join('');
      wrap.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => changeQty(parseInt(b.dataset.inc, 10), +1));
      wrap.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => changeQty(parseInt(b.dataset.dec, 10), -1));
      wrap.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeFromCart(parseInt(b.dataset.remove, 10)));
    }
    $('#cartTotal').textContent = formatIDR(cartTotal());
    $('#checkoutBtn').disabled = state.cart.length === 0;
  }

  function openCart() { $('#cartDrawer').setAttribute('aria-hidden', 'false'); }
  function closeCart() { $('#cartDrawer').setAttribute('aria-hidden', 'true'); }

  // === Checkout ===
  function openCheckout() {
    if (!state.user) { closeCart(); openAuthModal('login'); toast('Masuk dulu untuk checkout', ''); return; }
    if (state.cart.length === 0) return;
    const form = $('#checkoutForm');
    form.reset();
    form.elements['customer_name'].value = state.user.username || '';
    const sum = state.cart.map(it =>
      `<div class="row"><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${formatIDR(it.price * it.qty)}</span></div>`
    ).join('') + `<div class="row total"><span>Total</span><span>${formatIDR(cartTotal())}</span></div>`;
    $('#checkoutSummary').innerHTML = sum;
    $('#checkoutError').hidden = true;
    $('#checkoutModal').setAttribute('aria-hidden', 'false');
  }
  function closeCheckout() { $('#checkoutModal').setAttribute('aria-hidden', 'true'); }

  async function submitCheckout(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = $('#confirmCheckoutBtn');
    const errEl = $('#checkoutError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    try {
      // Backend's /api/sales takes one product per request. Post one sale per cart line.
      const notes = [data.address ? `Alamat: ${data.address}` : '', data.notes].filter(Boolean).join(' | ');
      const results = [];
      for (const it of state.cart) {
        const r = await api('/sales', {
          method: 'POST',
          body: JSON.stringify({
            product_id: it.id,
            quantity: it.qty,
            unit_price: Number(it.price),
            customer_name: data.customer_name,
            notes,
          }),
        });
        results.push(r.data);
      }
      state.cart = [];
      saveCart();
      renderCart();
      closeCheckout();
      closeCart();
      toast(`Pesanan berhasil dibuat (${results.length} item)`, 'success');
      navigate('orders');
    } catch (err) {
      errEl.textContent = 'Gagal: ' + err.message;
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Konfirmasi Pesanan';
    }
  }

  // === Orders ===
  async function loadOrders() {
    if (!state.user) {
      $('#ordersList').innerHTML = '<div class="empty">Silakan masuk untuk melihat pesanan.</div>';
      return;
    }
    $('#ordersList').innerHTML = '<div class="empty">Memuat pesanan…</div>';
    try {
      const res = await api('/sales?limit=200');
      const myName = (state.user.username || '').toLowerCase();
      const myEmail = (state.user.email || '').toLowerCase();
      const mine = (res.data || []).filter(s => {
        const cn = String(s.customer_name || '').toLowerCase();
        return cn === myName || cn === myEmail || cn.includes(myName);
      }).sort((a, b) => (b.id || 0) - (a.id || 0));

      // Hydrate product names
      const productMap = new Map(state.products.map(p => [p.id, p]));
      const missing = mine.map(s => s.product_id).filter(id => id && !productMap.has(id));
      if (missing.length && state.products.length === 0) {
        try {
          const pRes = await api('/products');
          (pRes.data || []).forEach(p => productMap.set(p.id, p));
        } catch { /* ignore */ }
      }

      if (mine.length === 0) {
        $('#ordersList').innerHTML = '<div class="empty">Belum ada pesanan.</div>';
        return;
      }
      $('#ordersList').innerHTML = mine.map(s => {
        const prod = productMap.get(s.product_id);
        const dt = s.sale_date ? new Date(s.sale_date).toLocaleString('id-ID') : '';
        return `
          <div class="order-card">
            <div>
              <div class="order-id">Order #${s.id}</div>
              <div class="order-product">${escapeHtml((prod && prod.name) || `Produk #${s.product_id}`)} × ${s.quantity}</div>
              <div class="order-meta">${dt}</div>
            </div>
            <div class="order-total">${formatIDR(s.total_price)}</div>
          </div>
        `;
      }).join('');
    } catch (e) {
      $('#ordersList').innerHTML = `<div class="empty">Gagal memuat pesanan: ${e.message}</div>`;
    }
  }

  // === Navigation ===
  function navigate(view) {
    state.view = view;
    $('#view-catalog').hidden = view !== 'catalog';
    $('#view-orders').hidden = view !== 'orders';
    $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.nav === view));
    if (view === 'orders') loadOrders();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // === Form handlers ===
  async function onLogin(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const err = $('#loginError');
    err.hidden = true;
    try {
      const res = await api('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      setAuth(res.data.user, res.data.token);
      closeAuthModal();
      toast('Selamat datang, ' + (res.data.user.username || ''), 'success');
      loadProducts();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const err = $('#registerError');
    err.hidden = true;
    try {
      const res = await api('/auth/register', { method: 'POST', body: JSON.stringify(data) });
      setAuth(res.data.user, res.data.token);
      closeAuthModal();
      toast('Akun berhasil dibuat', 'success');
      loadProducts();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  }

  // === Google Sign-In ===
  let googleInitialized = false;

  async function initGoogleSignIn() {
    try {
      const res = await fetch(API_BASE + '/auth/google-config');
      const body = await res.json();
      const clientId = body && body.data && body.data.clientId;
      if (!clientId) return;
      waitForGoogle(() => {
        if (googleInitialized) return;
        googleInitialized = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
          auto_select: false,
        });
        renderGoogleButtons();
      });
    } catch (e) {
      console.warn('Google Sign-In tidak aktif:', e.message);
    }
  }

  function waitForGoogle(cb, tries = 0) {
    if (window.google && window.google.accounts && window.google.accounts.id) return cb();
    if (tries > 50) return;
    setTimeout(() => waitForGoogle(cb, tries + 1), 100);
  }

  function renderGoogleButtons() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
    const opts = { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 };
    ['googleBtnLogin', 'googleBtnRegister'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.rendered) {
        window.google.accounts.id.renderButton(el, opts);
        el.dataset.rendered = '1';
      }
    });
  }

  async function handleGoogleCredential(response) {
    try {
      const r = await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential }),
      });
      setAuth(r.data.user, r.data.token);
      $('#authModal').setAttribute('aria-hidden', 'true');
      toast('Selamat datang, ' + (r.data.user.username || r.data.user.email), 'success');
      loadProducts();
    } catch (e) {
      toast('Login Google gagal: ' + e.message, 'error');
    }
  }

  function logout() {
    setAuth(null, null);
    state.cart = [];
    saveCart();
    renderCart();
    navigate('catalog');
    toast('Anda telah keluar', '');
    loadProducts();
  }

  // === Wire up ===
  function init() {
    renderAuthUI();
    renderCart();

    // Topbar
    $('#cartBtn').addEventListener('click', openCart);
    $('#loginBtn').addEventListener('click', () => openAuthModal('login'));
    $('#logoutBtn').addEventListener('click', logout);

    // Nav
    $$('.nav-link, .brand').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.nav || 'catalog'));
    });
    $('#heroCtaBtn').addEventListener('click', () => {
      $('#searchInput').focus();
      document.querySelector('.catalog').scrollIntoView({ behavior: 'smooth' });
    });

    // Drawer / Modal close
    $$('[data-close-drawer]').forEach(el => el.addEventListener('click', closeCart));
    $$('[data-close-modal]').forEach(el => el.addEventListener('click', () => {
      $('#authModal').setAttribute('aria-hidden', 'true');
      $('#checkoutModal').setAttribute('aria-hidden', 'true');
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCart();
        $('#authModal').setAttribute('aria-hidden', 'true');
        $('#checkoutModal').setAttribute('aria-hidden', 'true');
      }
    });

    // Tabs
    $$('.tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));

    // Search
    $('#searchInput').addEventListener('input', (e) => {
      state.searchTerm = e.target.value;
      renderProducts();
    });

    // Checkout
    $('#checkoutBtn').addEventListener('click', openCheckout);
    $('#checkoutForm').addEventListener('submit', submitCheckout);

    // Auth forms
    $('#loginForm').addEventListener('submit', onLogin);
    $('#registerForm').addEventListener('submit', onRegister);

    loadProducts();
    initGoogleSignIn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
