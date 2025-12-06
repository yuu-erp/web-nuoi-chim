const API_BASE = 'http://localhost:3000/api';

const storage = {
  get token() {
    return localStorage.getItem('authToken');
  },
  set token(value) {
    localStorage.setItem('authToken', value);
  },
  clearToken() {
    localStorage.removeItem('authToken');
  },
  get user() {
    const raw = localStorage.getItem('authUser');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  },
  set user(value) {
    localStorage.setItem('authUser', JSON.stringify(value));
  },
  clearUser() {
    localStorage.removeItem('authUser');
  },
  get cart() {
    const raw = localStorage.getItem('cartItems');
    try {
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  },
  set cart(value) {
    localStorage.setItem('cartItems', JSON.stringify(value));
  },
};

function setAuth(token, user) {
  storage.token = token;
  storage.user = user;
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function clearAuth() {
  storage.clearToken();
  storage.clearUser();
}

function addToCart(product, qty) {
  const quantity = Math.max(1, Number(qty) || 1);
  const items = storage.cart;
  const existing = items.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += quantity;
  } else {
    items.push({ id: product.id, name: product.name, price: product.price, qty: quantity });
  }
  storage.cart = items;
  updateHomeAuthUI();
  alert(`Đã thêm ${quantity} x ${product.name} vào giỏ`);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resolveImage(urlInputId, fileInputId) {
  const urlVal = document.getElementById(urlInputId)?.value.trim();
  const fileElm = document.getElementById(fileInputId);
  const file = fileElm?.files?.[0];
  if (file) {
    const dataUrl = await fileToDataUrl(file);
    return dataUrl;
  }
  if (urlVal) return urlVal;
  return undefined;
}

async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = storage.token;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (data && data.message) || 'Có lỗi xảy ra';
    throw new Error(message);
  }
  return data;
}

function showMessage(target, message, type = 'error') {
  if (!target) return;
  target.textContent = message;
  target.className = type === 'error' ? 'text-sm text-red-600 mt-2' : 'text-sm text-emerald-600 mt-2';
}

function redirect(url) {
  window.location.href = url;
}

function updateHomeAuthUI() {
  const authButtons = document.getElementById('authButtons');
  const greeting = document.getElementById('greeting');
  const greetingName = document.getElementById('greetingName');
  const cartCount = document.getElementById('cartCount');
  const cartCountTop = document.getElementById('cartCountTop');
  const adminLink = document.getElementById('adminLink');
  const user = storage.user;
  if (user) {
    authButtons?.classList.add('hidden');
    greeting?.classList.remove('hidden');
    if (greetingName) greetingName.textContent = user.name || user.email || 'bạn';
  } else {
    authButtons?.classList.remove('hidden');
    greeting?.classList.add('hidden');
  }
  if (adminLink) {
    if (user && user.role === 'admin') {
      adminLink.classList.remove('hidden');
    } else {
      adminLink.classList.add('hidden');
    }
  }
  if (cartCount) {
    const totalQty = storage.cart.reduce((sum, i) => sum + Number(i.qty || 0), 0);
    cartCount.textContent = totalQty;
  }
  if (cartCountTop) {
    const totalQty = storage.cart.reduce((sum, i) => sum + Number(i.qty || 0), 0);
    cartCountTop.textContent = totalQty;
  }
}

function renderHomeProducts(products = []) {
  const list = document.getElementById('productList');
  if (!list) return;
  if (!products.length) {
    list.innerHTML =
      '<p class="col-span-2 md:col-span-4 text-sm text-slate-500">Chưa có sản phẩm.</p>';
    return;
  }
  list.innerHTML = '';
  products.forEach((p) => {
    const card = document.createElement('article');
    card.className =
      'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col';
    card.innerHTML = `
      <div class="h-24 md:h-28 bg-slate-100 overflow-hidden">
        <img src="${p.image || 'https://placehold.co/400x240?text=Product'}" alt="${p.name || ''}" class="w-full h-full object-cover">
      </div>
      <div class="p-3 flex flex-col gap-1 flex-1">
        <h3 class="text-xs md:text-sm font-semibold line-clamp-2">${p.name || 'Sản phẩm'}</h3>
        <p class="text-xs text-slate-500">${p.status || 'available'}</p>
        <div class="mt-1 flex items-center justify-between">
          <span class="text-xs font-semibold text-emerald-600">
            ${(Number(p.price || 0)).toLocaleString('vi-VN')}đ
          </span>
          <span class="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
            Kho: ${p.stock ?? 0}
          </span>
        </div>
        <a href="product.html?id=${p.id}" class="mt-2 text-[11px] text-emerald-600 hover:text-emerald-700">Xem chi tiết →</a>
        <div class="mt-2 flex items-center gap-2">
          <input type="number" min="1" value="1" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg qty-input" data-id="${p.id}">
          <button data-id="${p.id}" class="add-cart-home text-[11px] px-3 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">Thêm vào giỏ</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-cart-home')) {
      const id = e.target.dataset.id;
      const product = products.find((x) => x.id === id);
      const qtyInput = list.querySelector(`input.qty-input[data-id="${id}"]`);
      if (product) addToCart(product, qtyInput?.value || 1);
    }
  });
}

function renderHomePosts(posts = []) {
  const list = document.getElementById('postList');
  if (!list) return;
  if (!posts.length) {
    list.innerHTML =
      '<p class="col-span-1 md:col-span-3 text-sm text-slate-500">Chưa có bài viết.</p>';
    return;
  }
  list.innerHTML = '';
  posts.forEach((p) => {
    const card = document.createElement('article');
    card.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-2';
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '';
    card.innerHTML = `
      <div class="h-32 bg-slate-100 rounded-xl overflow-hidden">
        <img src="${p.image || 'https://placehold.co/400x240?text=Post'}" alt="${p.title || ''}" class="w-full h-full object-cover">
      </div>
      <p class="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">${p.status || 'published'}</p>
      <h3 class="font-semibold text-sm md:text-base">${p.title || 'Bài viết'}</h3>
      <p class="text-[11px] text-slate-500">${date}</p>
      <p class="text-xs text-slate-500 line-clamp-3">${p.excerpt || p.content || ''}</p>
      <a href="post.html?id=${p.id}" class="text-[11px] text-emerald-600 hover:text-emerald-700">Đọc tiếp →</a>
    `;
    list.appendChild(card);
  });
}

async function loadHomeData() {
  try {
    const products = await apiFetch('/products');
    renderHomeProducts(products.products || []);
  } catch (err) {
    const list = document.getElementById('productList');
    if (list) {
      list.innerHTML = `<p class="col-span-2 md:col-span-4 text-sm text-red-600">${err.message}</p>`;
    }
  }

  try {
    const posts = await apiFetch('/posts');
    renderHomePosts(posts.posts || []);
  } catch (err) {
    const list = document.getElementById('postList');
    if (list) {
      list.innerHTML = `<p class="col-span-1 md:col-span-3 text-sm text-red-600">${err.message}</p>`;
    }
  }
}

function wireLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearAuth();
    updateHomeAuthUI();
    Swal.fire({ icon: 'success', title: 'Đã đăng xuất', timer: 2000, showConfirmButton: false });
  });
}

function wireRegisterPage() {
  const form = document.getElementById('registerForm');
  if (!form) return;
  const message = document.getElementById('registerMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = form.querySelector('#fullName')?.value.trim();
    const email = form.querySelector('#regEmail')?.value.trim();
    const password = form.querySelector('#regPassword')?.value;
    const confirm = form.querySelector('#regConfirm')?.value;

    if (!fullName || !email || !password) {
      showMessage(message, 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (password !== confirm) {
      showMessage(message, 'Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: fullName, email, password }),
      });
      setAuth(data.token, data.user);
      showMessage(message, 'Đăng ký thành công! Đang chuyển trang...', 'success');
      Swal.fire({ icon: 'success', title: 'Đăng ký thành công', timer: 1200, showConfirmButton: false });
      setTimeout(() => redirect('index.html'), 700);
    } catch (err) {
      showMessage(message, err.message);
      Swal.fire({ icon: 'error', title: 'Lỗi', text: err.message || 'Không đăng ký được' });
    }
  });
}

function wireLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  const message = document.getElementById('loginMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#loginEmail')?.value.trim();
    const password = form.querySelector('#loginPassword')?.value;
    if (!email || !password) {
      showMessage(message, 'Thiếu email hoặc mật khẩu');
      return;
    }

    const endpoint = '/auth/login';
    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuth(data.token, data.user);
      showMessage(message, 'Đăng nhập thành công!', 'success');
      Swal.fire({ icon: 'success', title: 'Đăng nhập thành công', timer: 2000, showConfirmButton: false });
      const dest = data.user.role === 'admin' ? 'admin-dashboard.html' : 'index.html';
      setTimeout(() => redirect(dest), 500);
    } catch (err) {
      showMessage(message, err.message);
    }
  });
}

function ensureAdminOrRedirect() {
  const user = storage.user;
  if (!user || user.role !== 'admin') {
    alert('Bạn cần đăng nhập tài khoản admin để vào trang này.');
    redirect('login.html');
    return false;
  }
  return true;
}

function renderProducts(products = []) {
  const tbody = document.querySelector('#productTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  products.forEach((p) => {
    const row = document.createElement('tr');
    row.className = 'border-t';
    row.innerHTML = `
      <td class="px-4 py-2 col-name" data-name="${p.name}">${p.name}</td>
      <td class="px-4 py-2 col-price" data-price="${p.price}">${Number(p.price || 0).toLocaleString('vi-VN')}đ</td>
      <td class="px-4 py-2 col-stock" data-stock="${p.stock ?? 0}">${p.stock ?? 0}</td>
      <td class="px-4 py-2 col-status" data-status="${p.status || 'available'}" data-image="${p.image || ''}">
        <span class="inline-flex items-center px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[11px]">${p.status || 'available'}</span>
      </td>
      <td class="px-4 py-2 text-right space-x-2">
        <button data-id="${p.id}" class="text-[11px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 edit-product">Sửa</button>
        <button data-id="${p.id}" class="text-[11px] px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 delete-product">Xóa</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadProducts() {
  const data = await apiFetch('/products');
  renderProducts(data.products);
  const available = (data.products || []).filter((p) => p.status !== 'unavailable').length;
  setStat('productsCount', available);
}

async function loadOrders() {
  const tbody = document.getElementById('orderTableBody');
  const msg = document.getElementById('orderMessage');
  if (!tbody) return;
  try {
    const data = await apiFetch('/orders');
    tbody.innerHTML = '';
    const today = new Date().toISOString().slice(0, 10);
    let todayCount = 0;
    data.orders.forEach((o) => {
      const row = document.createElement('tr');
      row.className = 'border-t';
      const date = o.date ? new Date(o.date).toLocaleDateString('vi-VN') : '';
      let itemsCount = 0;
      try { itemsCount = o.items ? JSON.parse(o.items).length : 0; } catch (_) {}
      if (o.date && o.date.slice(0, 10) === today) todayCount += 1;
      row.innerHTML = `
        <td class="px-4 py-2">${o.code}</td>
        <td class="px-4 py-2">${o.customerName}</td>
        <td class="px-4 py-2 text-xs text-slate-500">${o.phone || ''}<br>${o.address || ''}</td>
        <td class="px-4 py-2">${(Number(o.total || 0)).toLocaleString('vi-VN')}đ</td>
        <td class="px-4 py-2">${date}</td>
        <td class="px-4 py-2">
          <span class="inline-flex items-center px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[11px]">${o.status}</span>
        </td>
        <td class="px-4 py-2 text-right text-[11px]">${itemsCount} món</td>
      `;
      tbody.appendChild(row);
    });
    setStat('ordersTodayCount', todayCount);
    showMessage(msg, '', 'success');
  } catch (err) {
    showMessage(msg, err.message);
  }
}

async function loadUsers() {
  const message = document.getElementById('userMessage');
  try {
    const data = await apiFetch('/users');
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.users.forEach((u) => {
      const row = document.createElement('tr');
      row.className = 'border-t';
      row.innerHTML = `
        <td class="px-4 py-2 user-name">${u.name}</td>
        <td class="px-4 py-2 user-email">${u.email}</td>
        <td class="px-4 py-2">
          <select data-id="${u.id}" class="role-select text-xs border border-slate-300 rounded-lg px-2 py-1">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td class="px-4 py-2 text-right space-x-2">
          <button data-id="${u.id}" data-role="${u.role}" class="edit-user text-[11px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200">Sửa</button>
          <button data-id="${u.id}" class="delete-user text-[11px] px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200">Xóa</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    showMessage(message, '', 'success');
  } catch (err) {
    showMessage(message, err.message);
  }
}

function renderPosts(posts = []) {
  const tbody = document.querySelector('#postTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  posts.forEach((p) => {
    const row = document.createElement('tr');
    row.className = 'border-t';
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '--';
    row.innerHTML = `
      <td class="px-4 py-2 post-title">${p.title}</td>
      <td class="px-4 py-2">${date}</td>
      <td class="px-4 py-2 post-status" data-status="${p.status || 'published'}" data-excerpt="${p.excerpt || ''}" data-content="${(p.content || '').replace(/"/g,'&quot;')}" data-image="${p.image || ''}">
        <span class="inline-flex items-center px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[11px]">${p.status || 'published'}</span>
      </td>
      <td class="px-4 py-2 text-right space-x-2">
        <button data-id="${p.id}" class="text-[11px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 edit-post">Sửa</button>
        <button data-id="${p.id}" class="text-[11px] px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 delete-post">Xóa</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadPosts() {
  const data = await apiFetch('/posts');
  renderPosts(data.posts);
  const published = (data.posts || []).filter((p) => p.status === 'published').length;
  setStat('postsCount', published);
}

// Trạng thái danh mục bài viết trong trang admin
const adminCategoryState = {
  flat: [],
  tree: [],
};

function adminRenderCategoryTree(nodes, level, lines) {
  level = level || 0;
  lines = lines || [];
  nodes.forEach((node) => {
    const indent = '&nbsp;'.repeat(level * 4);
    lines.push(`<div class="py-0.5">${indent}${node.name}</div>`);
    if (node.children && node.children.length) {
      adminRenderCategoryTree(node.children, level + 1, lines);
    }
  });
  return lines;
}

async function adminLoadPostCategories() {
  const categoryParentSelect = document.getElementById('categoryParent');
  const categoryList = document.getElementById('categoryList');
  const categoryMessage = document.getElementById('categoryMessage');
  const postParentCategorySelect = document.getElementById('postParentCategory');
  const postChildCategorySelect = document.getElementById('postChildCategory');

  try {
    const data = await apiFetch('/post-categories');
    adminCategoryState.tree = data.categories || [];
    adminCategoryState.flat = data.flat || [];

    if (categoryParentSelect) {
      categoryParentSelect.innerHTML = '<option value="">Danh m���c g��`c</option>';
      function addParentOptions(nodes, level) {
        nodes.forEach((node) => {
          const prefix = level > 0 ? Array(level + 1).join('-- ') : '';
          const opt = document.createElement('option');
          opt.value = node.id;
          opt.textContent = prefix + node.name;
          categoryParentSelect.appendChild(opt);
          if (node.children && node.children.length) addParentOptions(node.children, level + 1);
        });
      }
      addParentOptions(adminCategoryState.tree || [], 0);
    }

    if (postParentCategorySelect) {
      postParentCategorySelect.innerHTML = '<option value="">Danh m���c chA-nh</option>';
      (adminCategoryState.tree || []).forEach((node) => {
        const opt = document.createElement('option');
        opt.value = node.id;
        opt.textContent = node.name;
        postParentCategorySelect.appendChild(opt);
      });
    }

    if (postChildCategorySelect) {
      postChildCategorySelect.innerHTML = '<option value="">Danh m���c con</option>';
      postChildCategorySelect.disabled = true;
    }

    if (categoryList) {
      if (!adminCategoryState.tree.length) {
        categoryList.innerHTML =
          '<p class="text-xs text-slate-400">Ch��a cA3 danh m���c nA�o.</p>';
      } else {
        const lines = adminRenderCategoryTree(adminCategoryState.tree, 0, []);
        categoryList.innerHTML = lines.join('');
      }
    }

    if (categoryMessage) showMessage(categoryMessage, '', 'success');
  } catch (err) {
    if (categoryMessage) showMessage(categoryMessage, err.message);
  }
}

function adminUpdatePostChildCategories(parentId) {
  const postChildCategorySelect = document.getElementById('postChildCategory');
  if (!postChildCategorySelect) return;
  postChildCategorySelect.innerHTML = '<option value="">Danh m���c con</option>';
  const children = (adminCategoryState.flat || []).filter((c) => c.parentId === parentId);
  if (!children.length) {
    postChildCategorySelect.disabled = true;
    return;
  }
  children.forEach((child) => {
    const opt = document.createElement('option');
    opt.value = child.id;
    opt.textContent = child.name;
    postChildCategorySelect.appendChild(opt);
  });
  postChildCategorySelect.disabled = false;
}

function wireAdminDashboard() {
  const productForm = document.getElementById('productForm');
  const postForm = document.getElementById('postForm');
  const categoryForm = document.getElementById('categoryForm');
  if (!productForm && !postForm) return;
  if (!ensureAdminOrRedirect()) return;

  const adminLogout = document.getElementById('adminLogout');
  adminLogout?.addEventListener('click', () => {
    clearAuth();
    Swal.fire({ icon: 'success', title: 'Đã đăng xuất', timer: 2000, showConfirmButton: false });
    redirect('login.html');
  });

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idInput = document.getElementById('productId');
      const name = productForm.querySelector('#productName')?.value.trim();
      const price = productForm.querySelector('#productPrice')?.value;
      const stock = productForm.querySelector('#productStock')?.value;
      const status = productForm.querySelector('#productStatus')?.value;
      const image = await resolveImage('productImage', 'productImageFile');
      const message = document.getElementById('productMessage');
      if (!name) {
        showMessage(message, 'Tên sản phẩm bắt buộc');
        return;
      }
      try {
        if (idInput?.value) {
          await apiFetch(`/products/${idInput.value}`, {
            method: 'PUT',
            body: JSON.stringify({ name, price, stock, status, image }),
          });
          showMessage(message, 'Đã cập nhật sản phẩm', 'success');
          Swal.fire({ icon: 'success', title: 'Đã cập nhật sản phẩm', timer: 1200, showConfirmButton: false });
        } else {
          await apiFetch('/products', {
            method: 'POST',
            body: JSON.stringify({ name, price, stock, status, image }),
          });
          showMessage(message, 'Đã thêm sản phẩm', 'success');
          Swal.fire({ icon: 'success', title: 'Đã thêm sản phẩm', timer: 1200, showConfirmButton: false });
        }
        productForm.reset();
        if (idInput) { idInput.value = ''; document.getElementById('productSubmit').textContent = '+ Thêm sản phẩm'; }
        loadProducts();
      } catch (err) {
        showMessage(message, err.message);
      }
    });
  }

  if (postForm) {
    postForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idInput = document.getElementById('postId');
      const title = postForm.querySelector('#postTitle')?.value.trim();
      const excerpt = postForm.querySelector('#postExcerpt')?.value.trim();
      const content = postForm.querySelector('#postContent')?.value.trim();
      const status = postForm.querySelector('#postStatus')?.value;
      const image = await resolveImage('postImage', 'postImageFile');
      const message = document.getElementById('postMessage');
      if (!title) {
        showMessage(message, 'Tiêu đề bắt buộc');
        return;
      }
      try {
        if (idInput?.value) {
          await apiFetch(`/posts/${idInput.value}`, {
            method: 'PUT',
            body: JSON.stringify({ title, excerpt, content, status, image }),
          });
          showMessage(message, 'Đã cập nhật bài viết', 'success');
          Swal.fire({ icon: 'success', title: 'Đã cập nhật bài viết', timer: 1200, showConfirmButton: false });
        } else {
          await apiFetch('/posts', {
            method: 'POST',
            body: JSON.stringify({ title, excerpt, content, status, image }),
          });
          showMessage(message, 'Đã thêm bài viết', 'success');
          Swal.fire({ icon: 'success', title: 'Đã thêm bài viết', timer: 1200, showConfirmButton: false });
        }
        postForm.reset();
        if (idInput) { idInput.value = ''; document.getElementById('postSubmit').textContent = '+ Viết bài mới'; }
        loadPosts();
      } catch (err) {
        showMessage(message, err.message);
      }
    });
  }

  const userForm = document.getElementById('userForm');
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idInput = document.getElementById('userId');
      const name = document.getElementById('userName')?.value.trim();
      const email = document.getElementById('userEmail')?.value.trim();
      const password = document.getElementById('userPassword')?.value;
      const role = document.getElementById('userRole')?.value;
      const msg = document.getElementById('userMessage');
      if (!name || !email) {
        showMessage(msg, 'Thiếu tên hoặc email');
        return;
      }
      try {
        if (idInput?.value) {
          await apiFetch(`/users/${idInput.value}`, {
            method: 'PUT',
            body: JSON.stringify({ name, email, password, role }),
          });
          showMessage(msg, 'Đã cập nhật tài khoản', 'success');
          Swal.fire({ icon: 'success', title: 'Đã cập nhật tài khoản', timer: 1200, showConfirmButton: false });
        } else {
          if (!password) {
            showMessage(msg, 'Nhập mật khẩu khi tạo mới');
            return;
          }
          await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role }),
          });
          showMessage(msg, 'Đã thêm tài khoản', 'success');
          Swal.fire({ icon: 'success', title: 'Đã thêm tài khoản', timer: 1200, showConfirmButton: false });
        }
        userForm.reset();
        if (idInput) idInput.value = '';
        document.getElementById('userSubmit').textContent = '+ Thêm tài khoản';
        loadUsers();
      } catch (err) {
        showMessage(msg, err.message);
      }
    });
  }

  document.body.addEventListener('click', async (e) => {
    const productId = e.target.dataset?.id;
    if (e.target.classList.contains('delete-product')) {
      if (confirm('Xóa sản phẩm này?')) {
        await apiFetch(`/products/${productId}`, { method: 'DELETE' });
        loadProducts();
        Swal.fire({ icon: 'success', title: 'Đã xóa sản phẩm', timer: 1200, showConfirmButton: false });
      }
    }
    if (e.target.classList.contains('edit-product')) {
      const row = e.target.closest('tr');
      document.getElementById('productId').value = productId;
      document.getElementById('productName').value = row.querySelector('.col-name')?.dataset?.name || row.querySelector('.col-name')?.textContent || '';
      document.getElementById('productPrice').value = row.querySelector('.col-price')?.dataset?.price || '';
      document.getElementById('productStock').value = row.querySelector('.col-stock')?.dataset?.stock || '';
      document.getElementById('productStatus').value = row.querySelector('.col-status')?.dataset?.status || 'available';
      document.getElementById('productImage').value = row.querySelector('.col-status')?.dataset?.image || '';
      const fileInput = document.getElementById('productImageFile'); if (fileInput) fileInput.value = '';
      document.getElementById('productSubmit').textContent = 'Cập nhật sản phẩm';
      Swal.fire({ icon: 'info', title: 'Đã load dữ liệu sản phẩm', timer: 1200, showConfirmButton: false });
    }
    if (e.target.classList.contains('delete-post')) {
      if (confirm('Xóa bài viết này?')) {
        await apiFetch(`/posts/${productId}`, { method: 'DELETE' });
        loadPosts();
        Swal.fire({ icon: 'success', title: 'Đã xóa bài viết', timer: 1200, showConfirmButton: false });
      }
    }
    if (e.target.classList.contains('edit-post')) {
      const row = e.target.closest('tr');
      document.getElementById('postId').value = productId;
      document.getElementById('postTitle').value = row.querySelector('.post-title')?.textContent || '';
      document.getElementById('postExcerpt').value = row.querySelector('.post-status')?.dataset?.excerpt || '';
      document.getElementById('postContent').value = row.querySelector('.post-status')?.dataset?.content || '';
      document.getElementById('postImage').value = row.querySelector('.post-status')?.dataset?.image || '';
      const fileInput = document.getElementById('postImageFile'); if (fileInput) fileInput.value = '';
      document.getElementById('postStatus').value = row.querySelector('.post-status')?.dataset?.status || 'published';
      document.getElementById('postSubmit').textContent = 'Cập nhật bài viết';
      Swal.fire({ icon: 'info', title: 'Đã load dữ liệu bài viết', timer: 1200, showConfirmButton: false });
    }
    if (e.target.classList.contains('delete-user')) {
      const id = e.target.dataset.id;
      if (confirm('Xóa tài khoản này?')) {
        try {
          await apiFetch(`/users/${id}`, { method: 'DELETE' });
          loadUsers();
          Swal.fire({ icon: 'success', title: 'Đã xóa tài khoản', timer: 1200, showConfirmButton: false });
        } catch (err) {
          showMessage(document.getElementById('userMessage'), err.message);
        }
      }
    }
    if (e.target.classList.contains('edit-user')) {
      const id = e.target.dataset.id;
      const row = e.target.closest('tr');
      document.getElementById('userId').value = id;
      document.getElementById('userName').value = row.querySelector('.user-name')?.textContent || '';
      document.getElementById('userEmail').value = row.querySelector('.user-email')?.textContent || '';
      document.getElementById('userRole').value = e.target.dataset.role || 'user';
      document.getElementById('userPassword').value = '';
      document.getElementById('userSubmit').textContent = 'Cập nhật tài khoản';
      Swal.fire({ icon: 'info', title: 'Đã load dữ liệu tài khoản', timer: 1200, showConfirmButton: false });
    }
  });

  const userTable = document.getElementById('userTableBody');
  userTable?.addEventListener('change', async (e) => {
    if (e.target.classList.contains('role-select')) {
      const id = e.target.dataset.id;
      const role = e.target.value;
      try {
        await apiFetch(`/users/${id}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        });
        loadUsers();
      } catch (err) {
        showMessage(document.getElementById('userMessage'), err.message);
      }
    }
  });

  loadProducts();
  loadPosts();
  loadOrders();
  loadUsers();
}

function wireCountdownPage() {
  const container = document.getElementById('listTo');
  const addBtn = document.getElementById('addNestBtn');
  const notice = document.getElementById('countdownNotice');
  if (!container || !addBtn) return;

  if (!storage.token) {
    if (notice) {
      notice.innerHTML = 'Hãy <a class="text-emerald-600 underline" href="login.html">đăng nhập</a> để lưu tổ chim của bạn.';
    }
    addBtn.disabled = true;
    addBtn.classList.add('opacity-50', 'cursor-not-allowed');
    return;
  }

  const state = {
    nests: [],
    intervals: {},
  };

  addBtn.addEventListener('click', () => {
    const newNest = {
      id: Date.now().toString(),
      name: 'Tổ mới',
      hatchDate: '',
      notes: '',
      dirty: true,
    };
    state.nests.push(newNest);
    renderNest(newNest);
  });

  async function saveNest(id) {
    try {
      await apiFetch('/bird-nests', {
        method: 'PUT',
        body: JSON.stringify({ nests: state.nests }),
      });
      const item = state.nests.find((n) => n.id === id);
      if (item) item.dirty = false;
      if (notice) showMessage(notice, 'Đã lưu tổ chim', 'success');
      renderNestList();
    } catch (err) {
      if (notice) showMessage(notice, err.message);
    }
  }

  async function loadNests() {
    try {
      const data = await apiFetch('/bird-nests');
      state.nests = data.nests || [];
      container.innerHTML = '';
      state.nests.forEach((nest) => renderNest(nest));
    } catch (err) {
      if (notice) showMessage(notice, err.message);
    }
  }

  function renderNest(nest) {
    const html = `
      <div id="to-${nest.id}" class="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 space-y-4">
        <div class="flex justify-between items-center">
          <div class="flex flex-col">
            <label class="text-sm font-semibold">Tên tổ</label>
            <input id="tenTo-${nest.id}" type="text" value="${nest.name || ''}" class="w-40 mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"/>
          </div>
          <div class="flex items-center gap-2">
            <span id="saveHint-${nest.id}" class="text-xs text-slate-500">Đã lưu</span>
            <button data-id="${nest.id}" id="save-${nest.id}" class="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
              Lưu
            </button>
            <button data-id="${nest.id}" class="delete-nest text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
              Xóa
            </button>
          </div>
        </div>

        <div>
          <label class="text-sm font-semibold">Ngày chim nở</label>
          <input id="ngayDe-${nest.id}" type="date" value="${nest.hatchDate || ''}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"/>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <p class="text-sm text-slate-600">Thời gian còn lại (<span id="tenToLabel-${nest.id}" class="font-semibold">${nest.name || ''}</span>):</p>
          <div id="countdownText-${nest.id}" class="text-2xl font-semibold text-emerald-600">--:--:--:--</div>
          <div class="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
            <div id="progress-${nest.id}" class="h-full bg-emerald-500 rounded-full" style="width:0%"></div>
          </div>
          <p id="percent-${nest.id}" class="text-xs text-slate-500 text-right">0%</p>
        </div>

        <div>
          <label class="text-sm font-semibold">Ghi chú</label>
          <textarea id="note-${nest.id}" class="w-full mt-1 px-3 py-2 h-24 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none" placeholder="Tình trạng trứng, nhiệt độ, độ ẩm...">${nest.notes || ''}</textarea>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    const nameInput = document.getElementById(`tenTo-${nest.id}`);
    const nameLabel = document.getElementById(`tenToLabel-${nest.id}`);
    const dateInput = document.getElementById(`ngayDe-${nest.id}`);
    const noteInput = document.getElementById(`note-${nest.id}`);

    nameInput?.addEventListener('input', () => {
      nest.name = nameInput.value;
      nest.dirty = true;
      if (nameLabel) nameLabel.textContent = nest.name;
      renderSaveHint(nest.id);
    });

    dateInput?.addEventListener('change', () => {
      nest.hatchDate = dateInput.value;
      nest.dirty = true;
      startCountdown(nest);
      renderSaveHint(nest.id);
    });

    noteInput?.addEventListener('input', () => {
      nest.notes = noteInput.value;
      nest.dirty = true;
      renderSaveHint(nest.id);
    });

    const saveBtn = document.getElementById(`save-${nest.id}`);
    saveBtn?.addEventListener('click', () => saveNest(nest.id));

    startCountdown(nest);
  }

  function renderSaveHint(id) {
    const hint = document.getElementById(`saveHint-${id}`);
    if (!hint) return;
    const nest = state.nests.find((n) => n.id === id);
    if (nest?.dirty) {
      hint.textContent = 'Chưa lưu';
      hint.className = 'text-xs text-amber-600';
    } else {
      hint.textContent = 'Đã lưu';
      hint.className = 'text-xs text-emerald-600';
    }
  }

  function renderNestList() {
    container.querySelectorAll('[id^="saveHint-"]').forEach((el) => {
      const id = el.id.replace('saveHint-', '');
      renderSaveHint(id);
    });
  }

  function startCountdown(nest) {
    if (state.intervals[nest.id]) clearInterval(state.intervals[nest.id]);
    const dateInput = document.getElementById(`ngayDe-${nest.id}`);
    const countdownText = document.getElementById(`countdownText-${nest.id}`);
    const progress = document.getElementById(`progress-${nest.id}`);
    const percentText = document.getElementById(`percent-${nest.id}`);
    const nameLabel = document.getElementById(`tenToLabel-${nest.id}`);

    if (nameLabel) nameLabel.textContent = nest.name || 'Tổ mới';
    const hatchDate = dateInput?.value;
    if (!hatchDate || !countdownText || !progress || !percentText) return;

    const dateDe = new Date(hatchDate);
    const dateNo = new Date(dateDe);
    dateNo.setDate(dateNo.getDate() + 12);
    const totalSeconds = 12 * 24 * 3600;

    const tick = () => {
      const now = new Date();
      let remainingSeconds = Math.floor((dateNo - now) / 1000);
      if (remainingSeconds <= 0) {
        clearInterval(state.intervals[nest.id]);
        countdownText.textContent = 'Chim đã nở 🎉';
        progress.style.width = '100%';
        percentText.textContent = '100%';
        return;
      }
      const days = Math.floor(remainingSeconds / 86400);
      remainingSeconds %= 86400;
      const hours = Math.floor(remainingSeconds / 3600);
      remainingSeconds %= 3600;
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      countdownText.textContent = `${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const passedSeconds = totalSeconds - (days * 86400 + hours * 3600 + mins * 60 + secs);
      const percent = Math.min(100, Math.max(0, (passedSeconds / totalSeconds) * 100));
      progress.style.width = `${percent}%`;
      percentText.textContent = `${Math.floor(percent)}%`;
    };

    tick();
    state.intervals[nest.id] = setInterval(tick, 1000);
  }

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-nest')) {
      const id = e.target.dataset.id;
      const item = document.getElementById(`to-${id}`);
      if (item) item.remove();
      if (state.intervals[id]) clearInterval(state.intervals[id]);
      state.nests = state.nests.filter((n) => n.id !== id);
      triggerSave();
    }
  });

  loadNests();
}

function wireHomePage() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const productList = document.getElementById('productList');
  const postList = document.getElementById('postList');
  if (!loginBtn && !registerBtn && !productList && !postList) return;

  loginBtn?.addEventListener('click', () => redirect('login.html'));
  registerBtn?.addEventListener('click', () => redirect('register.html'));

  updateHomeAuthUI();
  loadHomeData();
  wireLogout();
}

function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

async function wireProductPage() {
  const listPage = document.getElementById('productListPage');
  const detailContainer = document.getElementById('productDetail');
  if (!listPage && !detailContainer) return;

  if (listPage) {
    try {
      const data = await apiFetch('/products');
      const products = data.products || [];
      if (!products.length) {
        listPage.innerHTML =
          '<p class="col-span-2 md:col-span-3 lg:col-span-4 text-sm text-slate-500">Chưa có sản phẩm.</p>';
        return;
      }
      listPage.innerHTML = '';
      products.forEach((p) => {
        const card = document.createElement('article');
        card.className =
          'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col';
        card.innerHTML = `
          <div class="h-28 bg-slate-100 overflow-hidden">
            <img src="${p.image || 'https://placehold.co/400x240?text=Product'}" alt="${p.name || ''}" class="w-full h-full object-cover">
          </div>
          <div class="p-3 flex flex-col gap-1 flex-1">
            <h3 class="text-sm font-semibold line-clamp-2">${p.name}</h3>
            <p class="text-xs text-slate-500">${p.status || 'available'}</p>
            <div class="mt-1 flex items-center justify-between">
              <span class="text-sm font-semibold text-emerald-600">
                ${(Number(p.price || 0)).toLocaleString('vi-VN')}đ
              </span>
              <span class="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                Kho: ${p.stock ?? 0}
              </span>
            </div>
            <a href="product.html?id=${p.id}" class="text-[11px] text-emerald-600 hover:text-emerald-700 mt-2">Xem chi tiết →</a>
            <div class="mt-2 flex items-center gap-2">
              <input type="number" min="1" value="1" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg qty-input" data-id="${p.id}">
              <button data-id="${p.id}" class="add-cart text-[11px] px-3 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">Thêm vào giỏ</button>
            </div>
          </div>
        `;
        listPage.appendChild(card);
      });

      listPage.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-cart')) {
          const id = e.target.dataset.id;
          const product = products.find((x) => x.id === id);
          const qtyInput = listPage.querySelector(`input.qty-input[data-id="${id}"]`);
          if (product) addToCart(product, qtyInput?.value || 1);
        }
      });
    } catch (err) {
      listPage.innerHTML = `<p class="col-span-2 md:col-span-3 lg:col-span-4 text-sm text-red-600">${err.message}</p>`;
    }
  }

  if (detailContainer) {
    const id = getQueryParam('id');
    if (!id) {
      detailContainer.innerHTML = '<p class="text-sm text-red-600">Thiếu mã sản phẩm.</p>';
      return;
    }
    try {
      const { product } = await apiFetch(`/products/${id}`);
      detailContainer.innerHTML = `
        <div class="h-52 bg-slate-100 rounded-2xl overflow-hidden mb-3">
          <img src="${product.image || 'https://placehold.co/600x320?text=Product'}" alt="${product.name}" class="w-full h-full object-cover">
        </div>
        <h1 class="text-xl font-semibold">${product.name}</h1>
        <p class="text-sm text-slate-500">${product.status || 'available'}</p>
        <p class="text-lg font-semibold text-emerald-600 mb-2">${(Number(product.price || 0)).toLocaleString('vi-VN')}đ</p>
        <p class="text-sm text-slate-600">Tồn kho: ${product.stock ?? 0}</p>
        <p class="text-xs text-slate-500 mt-3">Mã: ${product.id}</p>
        <div class="mt-4 flex items-center gap-2">
          <input type="number" min="1" value="1" id="detailQty" class="w-20 px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 outline-none">
          <button id="detailAddCart" class="px-3 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-sm">Thêm vào giỏ</button>
        </div>
      `;
      const btn = document.getElementById('detailAddCart');
      const qtyInput = document.getElementById('detailQty');
      btn?.addEventListener('click', () => addToCart(product, qtyInput?.value || 1));
    } catch (err) {
      detailContainer.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
    }
  }
}

async function wirePostPage() {
  const listPage = document.getElementById('postListPage');
  const detailContainer = document.getElementById('postDetail');
  if (!listPage && !detailContainer) return;

  if (listPage) {
    try {
      const data = await apiFetch('/posts');
      const posts = data.posts || [];
      if (!posts.length) {
        listPage.innerHTML =
          '<p class="col-span-1 md:col-span-2 text-sm text-slate-500">Chưa có bài viết.</p>';
        return;
      }
      listPage.innerHTML = '';
      posts.forEach((p) => {
        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '';
        const card = document.createElement('article');
        card.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-2';
        card.innerHTML = `
          <p class="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">${p.status || 'published'}</p>
          <h3 class="font-semibold text-sm md:text-base">${p.title}</h3>
          <p class="text-[11px] text-slate-500">${date}</p>
          <p class="text-xs text-slate-500 line-clamp-3">${p.excerpt || p.content || ''}</p>
          <a href="post.html?id=${p.id}" class="text-[11px] text-emerald-600 hover:text-emerald-700">Đọc tiếp →</a>
        `;
        listPage.appendChild(card);
      });
    } catch (err) {
      listPage.innerHTML = `<p class="col-span-1 md:col-span-2 text-sm text-red-600">${err.message}</p>`;
    }
  }

  if (detailContainer) {
    const id = getQueryParam('id');
    if (!id) {
      detailContainer.innerHTML = '<p class="text-sm text-red-600">Thiếu mã bài viết.</p>';
      return;
    }
    try {
      const { post } = await apiFetch(`/posts/${id}`);
      const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : '';
      detailContainer.innerHTML = `
        <div class="h-52 bg-slate-100 rounded-2xl overflow-hidden mb-3">
          <img src="${post.image || 'https://placehold.co/600x320?text=Post'}" alt="${post.title}" class="w-full h-full object-cover">
        </div>
        <p class="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">${post.status || 'published'}</p>
        <h1 class="text-2xl font-semibold">${post.title}</h1>
        <p class="text-sm text-slate-500">${date}</p>
        <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mt-3">${post.content || post.excerpt || ''}</p>
      `;
    } catch (err) {
      detailContainer.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireRegisterPage();
  wireLoginPage();
  wireHomePage();
  wireProductPage();
  wirePostPage();
  wireAdminDashboard();
  wireCountdownPage();
  renderCartPage();
});
function renderCartPage() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const checkoutForm = document.getElementById('checkoutForm');
  if (!container || !totalEl) return;

  updateHomeAuthUI();
  const items = storage.cart;
  if (!items.length) {
    container.innerHTML = '<p class="text-slate-500">Giỏ hàng trống.</p>';
    totalEl.textContent = '0đ';
  } else {
    container.innerHTML = '';
    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between border rounded-xl px-3 py-2';
      div.innerHTML = `
        <div>
          <p class="font-semibold">${item.name}</p>
          <p class="text-xs text-slate-500">${(Number(item.price || 0)).toLocaleString('vi-VN')}đ</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="number" min="1" value="${item.qty}" data-id="${item.id}" class="cart-qty w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg">
          <button data-id="${item.id}" class="remove-cart text-[11px] px-2 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200">Xóa</button>
        </div>
      `;
      container.appendChild(div);
    });
    const total = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 1), 0);
    totalEl.textContent = `${total.toLocaleString('vi-VN')}đ`;
  }

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-cart')) {
      const id = e.target.dataset.id;
      storage.cart = storage.cart.filter((i) => i.id !== id);
      updateHomeAuthUI();
      renderCartPage();
    }
  });

  container.addEventListener('change', (e) => {
    if (e.target.classList.contains('cart-qty')) {
      const id = e.target.dataset.id;
      const qty = Math.max(1, Number(e.target.value) || 1);
      const items = storage.cart;
      const found = items.find((i) => i.id === id);
      if (found) found.qty = qty;
      storage.cart = items;
      updateHomeAuthUI();
      renderCartPage();
    }
  });

  checkoutForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const customerName = document.getElementById('checkoutName')?.value.trim();
    const phone = document.getElementById('checkoutPhone')?.value.trim();
    const address = document.getElementById('checkoutAddress')?.value.trim();
    const message = document.getElementById('checkoutMessage');
    if (!storage.cart.length) {
      showMessage(message, 'Giỏ hàng trống');
      return;
    }
    if (!customerName || !phone || !address) {
      showMessage(message, 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    try {
      await apiFetch('/orders/public', {
        method: 'POST',
        body: JSON.stringify({ customerName, phone, address, items: storage.cart }),
      });
      storage.cart = [];
      updateHomeAuthUI();
      renderCartPage();
      checkoutForm.reset();
      Swal.fire({ icon: 'success', title: 'Đặt hàng thành công', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: err.message || 'Không đặt được đơn' });
    }
  });
}
