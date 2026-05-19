(() => {
  'use strict';

  const API_BASE = '/api';
  const STORAGE_TOKEN = 'bs_token';
  const STORAGE_USER = 'bs_user';

  const state = {
    user: loadUser(),
    token: localStorage.getItem(STORAGE_TOKEN) || null,
    products: [],
    searchTerm: '',
    statusFilter: 'all',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function loadUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER)) || null; } catch { return null; }
  }
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
    render();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatIDR(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
  function colorForName(name) {
    const palette = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#06b6d4,#3b82f6)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#10b981,#06b6d4)',
      'linear-gradient(135deg,#ec4899,#f43f5e)',
      'linear-gradient(135deg,#84cc16,#22c55e)',
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  function toast(msg, kind = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(API_BASE + path, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error((body && body.message) || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // === Routing within page ===
  function render() {
    const loginNeeded = !state.user || !state.token;
    const isAdmin = !loginNeeded && state.user.role === 'admin';

    $('#loginRequired').hidden = !loginNeeded;
    $('#promoteBlock').hidden = loginNeeded || isAdmin;
    $('#dashboard').hidden = !isAdmin;

    const userMenu = $('.user-menu');
    if (state.user) {
      userMenu.hidden = false;
      $('#userName').textContent = state.user.username || state.user.email || '';
      $('#rolePill').textContent = state.user.role || 'user';
    } else {
      userMenu.hidden = true;
    }

    if (!loginNeeded && !isAdmin) {
      $('#promoteUser').textContent = state.user.username || state.user.email || '';
    }
    if (isAdmin) loadProducts();
  }

  // === Login (shop API) ===
  async function onLogin(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const errEl = $('#adminLoginError');
    errEl.hidden = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      setAuth(r.data.user, r.data.token);
      toast('Selamat datang, ' + r.data.user.username, 'success');
    } catch (ex) {
      errEl.textContent = ex.message;
      errEl.hidden = false;
    }
  }

  // === Promote ===
  async function onPromote(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const errEl = $('#promoteError');
    errEl.hidden = true;
    try {
      const r = await api('/auth/promote-to-admin', { method: 'POST', body: JSON.stringify(data) });
      setAuth(r.data.user, r.data.token);
      toast('Akun Anda sekarang admin', 'success');
    } catch (ex) {
      errEl.textContent = ex.message;
      errEl.hidden = false;
    }
  }

  function logout() {
    setAuth(null, null);
    toast('Anda telah keluar', '');
  }

  // === Products ===
  async function loadProducts() {
    const tbody = $('#productTbody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Memuat…</td></tr>';
    try {
      const r = await api('/products?include_inactive=true');
      state.products = r.data || [];
      renderProductTable();
    } catch (ex) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">Gagal memuat: ${escapeHtml(ex.message)}</td></tr>`;
    }
  }

  function renderProductTable() {
    const term = state.searchTerm.trim().toLowerCase();
    const items = state.products.filter(p => {
      const matchTerm = !term
        || (p.name || '').toLowerCase().includes(term)
        || (p.sku || '').toLowerCase().includes(term);
      const active = p.is_active === true || p.is_active === 1;
      const matchStatus = state.statusFilter === 'all'
        || (state.statusFilter === 'active' && active)
        || (state.statusFilter === 'inactive' && !active);
      return matchTerm && matchStatus;
    });

    $('#productCount').textContent = `${items.length} dari ${state.products.length} produk`;
    const tbody = $('#productTbody');
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Tidak ada produk yang cocok.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(p => {
      const active = p.is_active === true || p.is_active === 1;
      const initial = (p.name || '?').trim().charAt(0).toUpperCase();
      const thumb = p.image_url
        ? `<span class="thumb"><img src="${escapeHtml(p.image_url)}" alt="" onerror="this.style.display='none'" /></span>`
        : `<span class="thumb" style="background:${colorForName(p.name || '')}">${initial}</span>`;
      return `
        <tr>
          <td>${thumb}</td>
          <td><strong>${escapeHtml(p.name || '')}</strong></td>
          <td><code>${escapeHtml(p.sku || '')}</code></td>
          <td>${escapeHtml(p.category || '—')}</td>
          <td>${formatIDR(p.price)}</td>
          <td>${Number(p.stock || 0).toLocaleString('id-ID')}</td>
          <td class="${active ? 'status-on' : 'status-off'}">${active ? 'Aktif' : 'Nonaktif'}</td>
          <td class="cell-actions">
            <button class="btn btn-outline" data-edit="${p.id}">Edit</button>
            <button class="btn btn-outline" data-toggle="${p.id}">${active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => openEditModal(parseInt(b.dataset.edit, 10));
    });
    tbody.querySelectorAll('[data-toggle]').forEach(b => {
      b.onclick = () => toggleActive(parseInt(b.dataset.toggle, 10));
    });
  }

  function openCreateModal() {
    const form = $('#productForm');
    form.reset();
    form.elements['id'].value = '';
    form.elements['is_active'].checked = true;
    $('#productModalTitle').textContent = 'Tambah Produk Baru';
    $('#productFormError').hidden = true;
    updateImgPreview('');
    $('#productModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => form.elements['name'].focus(), 50);
  }

  function openEditModal(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const form = $('#productForm');
    form.elements['id'].value = p.id;
    form.elements['name'].value = p.name || '';
    form.elements['sku'].value = p.sku || '';
    form.elements['category'].value = p.category || '';
    form.elements['price'].value = p.price || 0;
    form.elements['stock'].value = p.stock || 0;
    form.elements['image_url'].value = p.image_url || '';
    form.elements['description'].value = p.description || '';
    form.elements['is_active'].checked = (p.is_active === true || p.is_active === 1);
    $('#productModalTitle').textContent = 'Edit Produk #' + p.id;
    $('#productFormError').hidden = true;
    updateImgPreview(p.image_url || '');
    $('#productModal').setAttribute('aria-hidden', 'false');
  }

  function closeProductModal() {
    $('#productModal').setAttribute('aria-hidden', 'true');
  }

  function updateImgPreview(url) {
    const wrap = $('#imgPreview');
    if (!url) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = `<img src="${escapeHtml(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=preview-text>Gambar gagal dimuat. Cek URL-nya.</span>'" /><span class="preview-text">Preview gambar</span>`;
  }

  async function onProductSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.id;
    const errEl = $('#productFormError');
    const btn = $('#saveProductBtn');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    const payload = {
      name: data.name,
      sku: data.sku,
      category: data.category || null,
      description: data.description || null,
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
      image_url: data.image_url || null,
      is_active: form.elements['is_active'].checked,
    };
    try {
      if (id) {
        await api('/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        toast('Produk diperbarui', 'success');
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
        toast('Produk baru ditambahkan', 'success');
      }
      closeProductModal();
      loadProducts();
    } catch (ex) {
      errEl.textContent = ex.message;
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  }

  async function toggleActive(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const newState = !(p.is_active === true || p.is_active === 1);
    try {
      await api('/products/' + id, { method: 'PUT', body: JSON.stringify({ is_active: newState }) });
      toast(newState ? 'Produk diaktifkan' : 'Produk dinonaktifkan', 'success');
      loadProducts();
    } catch (ex) {
      toast('Gagal: ' + ex.message, 'error');
    }
  }

  // === Init ===
  function init() {
    render();
    $('#adminLoginForm').addEventListener('submit', onLogin);
    $('#promoteForm').addEventListener('submit', onPromote);
    $('#logoutBtn').addEventListener('click', logout);
    $('#addProductBtn').addEventListener('click', openCreateModal);
    $('#productForm').addEventListener('submit', onProductSubmit);
    $('#productForm').elements['image_url'].addEventListener('input', (e) => updateImgPreview(e.target.value));
    $$('[data-close-modal]').forEach(el => el.addEventListener('click', closeProductModal));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProductModal();
    });

    $('#adminSearch').addEventListener('input', (e) => {
      state.searchTerm = e.target.value;
      renderProductTable();
    });
    $('#filterStatus').addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      renderProductTable();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
