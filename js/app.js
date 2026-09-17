import {
    initAuth, login, logout, getCurrentRole, getCurrentProfile,
    isGuest, isMember, isAdmin, getGuestId,
    getGuestCart, saveGuestCart, getGuestFavorites, saveGuestFavorites,
    updatePassword, refreshProfile
} from './auth.js';
import {
    subscribeCategories, subscribeMenu, createOrder, toggleFavorite as sbToggleFavorite,
    fetchUserFavorites, updateProfile, fetchUserAddresses,
    subscribeUserAddresses, addAddress, updateAddress,
    setPrimaryAddress, deleteAddress, getPrimaryAddress,
    uploadAvatar, deleteOldAvatar, updateAvatarUrl,
    // ✅ TAMBAHKAN INI:
    fetchUserCart, subscribeUserCart, addToCart, updateCartItem,
    removeCartItem, clearUserCart, fetchUserFavoritesFromDB, toggleFavoriteInDB,
    subscribeUserFavorites, fetchMenuVariations
} from './supabase-service.js';
import { showNotification, showConfirmPopup, setupModalClose } from './ui-helpers.js';

// ============================================
// STATE APLIKASI
// ============================================
let MENU_DATA = [];
let currentCategory = 'semua';
let cart = [];
let favorites = [];
let selectedFoodForModal = null;
let selectedSpicyLevel = 'Tidak Pedas';
let modalQtyCount = 1;
let activeDiscountPercent = 0;
let appRole = 'guest'; // guest | member | admin
let CATEGORIES = []; // Akan diisi dari Supabase
let userAddresses = [];
let editingAddressId = null;
let selectedAvatarFile = null;
let currentAvatarUrl = null;
let currentMenuVariations = []; // Variasi untuk menu yang sedang dibuka
let variationSelections = {};   // { variationId: [optionId, optionId, ...] }

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Init Auth
    const authState = await initAuth();
    appRole = authState.role;

    // ✅ GANTI DENGAN INI:
    if (isGuest()) {
        // Guest: Load dari localStorage (terpisah dari member)
        cart = getGuestCart();
        favorites = getGuestFavorites();
        console.log('👤 Mode Tamu (Non-Member)');
    } else if (isMember()) {
        // ✅ Member: Load HANYA dari database Supabase
        // JANGAN baca dari localStorage guest!
        const profile = getCurrentProfile();
        if (profile) {
            cart = await fetchUserCart(profile.id);
            favorites = await fetchUserFavoritesFromDB(profile.id);
            console.log(`⭐ Mode Member - Loaded ${cart.length} cart items, ${favorites.length} favorites from DB`);
        }
    } else if (isAdmin()) {
        console.log('🛡️ Mode Admin');
    }

    // Subscribe real-time kategori dari Supabase
    subscribeCategories((categories) => {
        CATEGORIES = categories;
        renderCategoriesBar();
        console.log(`✅ Loaded ${categories.length} categories from Supabase`);
    });

    // 3. Render UI berdasarkan role
    renderAuthUI();
    renderMenuGrid();
    renderFavorites();
    updateCartUI();
    bindAllEvents();

    subscribeMenu((fetchedMenu) => {
        MENU_DATA = fetchedMenu;
        renderMenuGrid();
        renderFavorites();
        console.log(`✅ Berhasil memuat ${MENU_DATA.length} menu dari Supabase`);
    });

    updateCartUI();
    bindAllEvents();

    console.log(`✅ Antigravity Food Ready (Role: ${appRole})`);
});

function renderCategoriesBar() {
    const container = document.getElementById('categories-container');

    // Tombol "Semua" selalu ada
    let html = `
    <button data-action="select-category" data-category="semua" 
      class="category-card ${currentCategory === 'semua' ? 'active' : ''} flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-card border border-dark-accent font-medium text-xs text-gray-200 transition-all duration-200">
      <i class="fa-solid fa-border-all text-primary text-sm"></i>
      <span>Semua</span>
    </button>
  `;

    // Render kategori dari database
    CATEGORIES.forEach(cat => {
        const isActive = currentCategory === cat.slug;
        html += `
      <button data-action="select-category" data-category="${cat.slug}" 
        class="category-card ${isActive ? 'active' : ''} flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-card border border-dark-accent font-medium text-xs text-gray-200 transition-all duration-200">
        <i class="${cat.icon} text-primary text-sm"></i>
        <span>${cat.name}</span>
      </button>
    `;
    });

    container.innerHTML = html;
}

// ============================================
// RENDER AUTH UI (Dynamic Header & Profile)
// ============================================
function renderAuthUI() {
    const authSection = document.getElementById('auth-section');

    if (isGuest()) {
        authSection.innerHTML = `
      <a href="login.html" class="p-2.5 rounded-full bg-primary/20 hover:bg-primary/30 transition text-primary relative">
        <i class="fa-solid fa-right-to-bracket text-lg"></i>
      </a>
    `;
    } else {
        authSection.innerHTML = `
      <button data-action="toggle-notification" class="p-2.5 rounded-full bg-dark-card hover:bg-dark-accent transition text-gray-200 relative">
        <i class="fa-regular fa-bell text-lg text-gray-300"></i>
        <span class="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
      </button>
    `;
    }

    // Toggle profile views
    document.getElementById('profile-guest-view').classList.toggle('hidden', !isGuest());
    document.getElementById('profile-member-view').classList.toggle('hidden', !isMember());
    document.getElementById('profile-admin-view').classList.toggle('hidden', !isAdmin());

    // ✅ Fill member profile data + avatar
    if (isMember()) {
        const p = getCurrentProfile();
        if (p) {
            document.getElementById('profile-name').innerText = p.full_name || 'User';
            document.getElementById('profile-email').innerText = p.email;
            document.getElementById('profile-phone').innerText = p.phone ? `+62 ${p.phone}` : '';

            // ✅ Avatar: Foto atau Initial
            const avatarImg = document.getElementById('profile-avatar-img');
            const avatarInitial = document.getElementById('profile-avatar-initial');
            const initial = (p.full_name || 'U').charAt(0).toUpperCase();

            if (p.avatar_url) {
                avatarImg.src = p.avatar_url;
                avatarImg.classList.remove('hidden');
                avatarInitial.classList.add('hidden');
            } else {
                avatarImg.classList.add('hidden');
                avatarInitial.classList.remove('hidden');
                avatarInitial.innerText = initial;
            }

            loadUserAddresses();
        }
    }

    if (isAdmin()) {
        const p = getCurrentProfile();
        if (p) {
            document.getElementById('admin-name').innerText = p.full_name;
            document.getElementById('admin-email').innerText = p.email;
        }
    }
}

// ============================================
// EVENT BINDING (SINGLE SOURCE OF TRUTH)
// ============================================
function bindAllEvents() {
    document.addEventListener('click', handleGlobalClick);

    // Label buttons untuk form alamat
    document.querySelectorAll('.label-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.label-btn').forEach(b => {
                b.classList.remove('border-primary', 'bg-primary/20', 'text-primary');
                b.classList.add('border-dark-accent', 'bg-dark-bg', 'text-gray-300');
            });
            btn.classList.remove('border-dark-accent', 'bg-dark-bg', 'text-gray-300');
            btn.classList.add('border-primary', 'bg-primary/20', 'text-primary');
            document.getElementById('address-label').value = btn.dataset.label;
        });
    });

    // Form submit handlers
    document.getElementById('edit-profile-form')?.addEventListener('submit', handleEditProfileSubmit);
    document.getElementById('change-password-form')?.addEventListener('submit', handleChangePasswordSubmit);

    setupPhoneValidation(document.getElementById('edit-profile-phone'));
    setupPhoneValidation(document.getElementById('address-phone'));

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', filterMenu);
    }

    // ✅ Avatar input handler
    const avatarInput = document.getElementById('avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validasi
            const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                showNotification('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
                e.target.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showNotification('Ukuran file terlalu besar (maksimal 5MB).', 'error');
                e.target.value = '';
                return;
            }

            // Preview gambar
            const reader = new FileReader();
            reader.onload = (event) => {
                const avatarPreview = document.getElementById('avatar-preview');
                const avatarInitial = document.getElementById('avatar-initial');
                const removeBtn = document.getElementById('remove-avatar-btn');

                avatarPreview.src = event.target.result;
                avatarPreview.classList.remove('hidden');
                avatarInitial.classList.add('hidden');
                removeBtn.classList.remove('hidden');

                selectedAvatarFile = file;
            };
            reader.readAsDataURL(file);
        });
    }

    // ✅ Remove avatar button
    const removeAvatarBtn = document.getElementById('remove-avatar-btn');
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', () => {
            const avatarPreview = document.getElementById('avatar-preview');
            const avatarInitial = document.getElementById('avatar-initial');
            const p = getCurrentProfile();

            avatarPreview.classList.add('hidden');
            avatarPreview.src = '';
            avatarInitial.classList.remove('hidden');
            avatarInitial.innerText = (p?.full_name || 'U').charAt(0).toUpperCase();

            document.getElementById('avatar-input').value = '';
            document.getElementById('remove-avatar-btn').classList.add('hidden');

            selectedAvatarFile = null;
            currentAvatarUrl = null; // Tandai bahwa avatar akan dihapus saat save
        });
    }

    // ✅ SETUP MODAL CLOSE (Anti-Drag Bug) - TAMBAHKAN DI SINI
    setupModalClose('edit-profile-modal', closeEditProfile);
    setupModalClose('change-password-modal', closeChangePassword);
    setupModalClose('addresses-modal', closeAddressesModal);
    setupModalClose('address-form-modal', closeAddressForm);
    setupModalClose('logout-modal', () => {
        document.getElementById('logout-modal').classList.add('hidden');
        document.body.style.overflow = '';
    });
}

// ============================================
// GLOBAL CLICK HANDLER (Event Delegation)
// ============================================
function handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
        case 'switch-tab':
            switchTab(target.dataset.tab);
            break;
        case 'switch-tab-menu':
            switchTab('home');
            selectCategory('semua');
            break;
        case 'select-category':
            selectCategory(target.dataset.category, target);
            break;
        case 'open-food-modal':
            openFoodModal(target.dataset.id);
            break;
        case 'toggle-favorite':
            e.stopPropagation();
            toggleFavorite(target.dataset.id);
            break;
        case 'quick-add-cart':
            quickAddToCart(target.dataset.id);
            break;
        case 'close-food-modal':
            closeFoodModal();
            break;
        case 'select-spicy':
            selectSpicy(target, target.dataset.level);
            break;
        case 'adjust-qty':
            adjustModalQty(parseInt(target.dataset.delta));
            break;
        case 'confirm-add-cart':
            confirmAddToCart();
            break;
        case 'change-cart-qty':
            changeCartQty(parseInt(target.dataset.index), parseInt(target.dataset.delta));
            break;
        case 'remove-cart-item':
            removeItemFromCart(parseInt(target.dataset.index));
            break;
        case 'clear-cart':
            clearCart();
            break;
        case 'apply-voucher':
            applyVoucher();
            break;
        case 'apply-promo':
            applyPromoBanner(target.dataset.code);
            break;
        case 'open-checkout':
            openCheckoutModal();
            break;
        case 'close-checkout':
            closeCheckoutModal();
            break;
        case 'process-order':
            processOrder();
            break;
        case 'open-tracker':
            document.getElementById('tracker-modal').classList.remove('hidden');
            break;
        case 'close-tracker':
            closeTrackerModal();
            break;
        case 'simulate-call':
            simulateCall();
            break;
        case 'change-location':
            changeLocation();
            break;
        case 'toggle-notification':
            toggleNotification();
            break;
        case 'clear-search':
            clearSearch();
            break;
        case 'logout':
            handleLogout();
            break;

        case 'confirm-logout':
            confirmLogout();
            break;

        case 'cancel-logout':
            cancelLogout();
            break;
        case 'open-edit-profile':
            openEditProfile();
            break;
        case 'close-edit-profile':
            closeEditProfile();
            break;
        case 'open-change-password':
            openChangePassword();
            break;
        case 'close-change-password':
            closeChangePassword();
            break;
        case 'open-addresses':
            openAddressesModal();
            break;
        case 'close-addresses':
            closeAddressesModal();
            break;
        case 'open-add-address':
            openAddressForm();
            break;
        case 'close-address-form':
            closeAddressForm();
            break;
        case 'save-address':
            saveAddress();
            break;
        case 'edit-address':
            openAddressForm(target.dataset.id);
            break;
        case 'delete-address':
            handleDeleteAddress(target.dataset.id);
            break;
        case 'set-primary-address':
            handleSetPrimaryAddress(target.dataset.id);
            break;
    }
}

// ============================================
// LOGOUT - Buka Modal Konfirmasi
// ============================================
function handleLogout() {
    // Tampilkan modal konfirmasi
    document.getElementById('logout-modal').classList.remove('hidden');
    // Prevent body scroll saat modal terbuka
    document.body.style.overflow = 'hidden';
}

// ============================================
// KONFIRMASI LOGOUT - Eksekusi Logout
// ============================================
async function confirmLogout() {
    // Tutup modal dulu
    document.getElementById('logout-modal').classList.add('hidden');
    document.body.style.overflow = '';

    // Tampilkan loading toast
    showToast('Sampai jumpa lagi...');

    // Eksekusi logout
    await logout();

    // Redirect ke halaman login
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 500);
}

// ============================================
// BATAL LOGOUT - Tutup Modal
// ============================================
function cancelLogout() {
    document.getElementById('logout-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================
// AUTH-AWARE CART (Save per role - TERPISAH)
// ============================================
async function saveCart() {
  if (isGuest()) {
    // Guest: Simpan HANYA di localStorage
    saveGuestCart(cart);
  } else if (isMember()) {
    // ✅ Member: Simpan HANYA di database Supabase
    // JANGAN sentuh localStorage guest!
    const profile = getCurrentProfile();
    if (profile) {
      await clearUserCart(profile.id);
      for (const item of cart) {
        await addToCart(profile.id, item);
      }
    }
  }
}

// ============================================
// RENDER FUNCTIONS (Tetap sama seperti sebelumnya)
// ============================================
function renderMenuGrid(itemsToRender = null) {
    const grid = document.getElementById('food-grid');
    let items = itemsToRender || MENU_DATA;

    if (currentCategory !== 'semua' && !itemsToRender) {
        // Filter berdasarkan slug kategori (cocok dengan field 'category' di menu)
        items = MENU_DATA.filter(item => item.category === currentCategory);
    }

    if (items.length === 0) {
        grid.innerHTML = `
      <div class="col-span-full text-center py-10 space-y-2">
        <i class="fa-solid fa-cookie-bite text-4xl text-gray-500"></i>
        <p class="text-xs text-gray-400">Tidak ada menu yang sesuai.</p>
      </div>`;
        return;
    }

    grid.innerHTML = items.map(item => {
        const isFav = favorites.includes(item.id);
        return `
      <div class="bg-dark-card border border-dark-accent rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-card">
        <div class="relative cursor-pointer" data-action="open-food-modal" data-id="${item.id}">
          <img src="${item.img}" alt="${item.name}" class="w-full h-32 object-cover group-hover:scale-105 transition duration-300">
          <span class="absolute top-2 left-2 bg-primary text-dark-bg font-bold text-[9px] px-2 py-0.5 rounded-full shadow">${item.badge}</span>
          <button data-action="toggle-favorite" data-id="${item.id}" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-dark-bg/80 text-xs flex items-center justify-center transition hover:bg-dark-bg">
            <i class="fa-${isFav ? 'solid text-red-500' : 'regular text-gray-300'} fa-heart"></i>
          </button>
        </div>
        <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <div class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
              <span class="text-primary font-bold"><i class="fa-solid fa-star"></i> ${item.rating}</span>
              <span>•</span><span>${item.time}</span>
            </div>
            <h4 data-action="open-food-modal" data-id="${item.id}" class="font-bold text-xs text-white line-clamp-1 hover:text-primary cursor-pointer">${item.name}</h4>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-dark-accent/50">
            <span class="font-extrabold text-xs text-primary">Rp ${item.price.toLocaleString('id-ID')}</span>
            <button data-action="quick-add-cart" data-id="${item.id}" class="w-7 h-7 rounded-xl bg-primary text-dark-bg font-bold text-xs flex items-center justify-center hover:bg-primary-dark transition shadow-glow">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
}

function renderFavorites() {
    const grid = document.getElementById('favorites-grid');
    const empty = document.getElementById('favorites-empty');
    const favItems = MENU_DATA.filter(item => favorites.includes(item.id));

    if (favItems.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        grid.innerHTML = favItems.map(item => `
      <div class="bg-dark-card border border-dark-accent rounded-2xl overflow-hidden flex flex-col justify-between">
        <img src="${item.img}" alt="${item.name}" class="w-full h-28 object-cover">
        <div class="p-3 space-y-2">
          <h4 class="font-bold text-xs text-white line-clamp-1">${item.name}</h4>
          <p class="font-extrabold text-xs text-primary">Rp ${item.price.toLocaleString('id-ID')}</p>
          <button data-action="quick-add-cart" data-id="${item.id}" class="w-full bg-primary text-dark-bg text-xs font-bold py-1.5 rounded-xl hover:bg-primary-dark transition">+ Pesan Lagi</button>
        </div>
      </div>`).join('');
    }
}

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

    if (totalItemsCount > 0) {
        badge.innerText = totalItemsCount;
        badge.classList.remove('hidden');
        document.getElementById('floating-cart-bar').classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
        document.getElementById('floating-cart-bar').classList.add('hidden');
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountAmount = (subtotal * activeDiscountPercent);
    const total = Math.max(0, subtotal + 12000 - discountAmount);

    document.getElementById('floating-cart-count').innerText = totalItemsCount;
    document.getElementById('floating-cart-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;

    const emptyView = document.getElementById('cart-empty-view');
    const filledView = document.getElementById('cart-filled-view');
    const container = document.getElementById('cart-items-container');

    if (cart.length === 0) {
        emptyView.classList.remove('hidden');
        filledView.classList.add('hidden');
    } else {
        emptyView.classList.add('hidden');
        filledView.classList.remove('hidden');
        container.innerHTML = cart.map((item, idx) => `
            <div class="bg-dark-card border border-dark-accent rounded-2xl p-3 flex items-center gap-3">
                <img src="${item.img}" alt="${item.name}" class="w-16 h-16 rounded-xl object-cover">
                <div class="flex-1 space-y-0.5 min-w-0">
                <h4 class="font-bold text-xs text-white truncate">${item.name}</h4>
                
                ${item.variations && item.variations.length > 0 ? `
                    <div class="space-y-0.5">
                    ${item.variations.map(v => `
                        <p class="text-[10px] text-primary truncate">
                        ${v.variationName}: ${v.selectedOptions.map(o => o.name).join(', ')}
                        </p>
                    `).join('')}
                    </div>
                ` : ''}
                
                ${item.notes ? `<p class="text-[10px] text-gray-400 italic truncate">"${item.notes}"</p>` : ''}
                <p class="font-extrabold text-xs text-white">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</p>
                </div>
                <div class="flex flex-col items-end gap-2 flex-shrink-0">
                <button data-action="remove-cart-item" data-index="${idx}" class="text-gray-400 hover:text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button>
                <div class="flex items-center bg-dark-bg border border-dark-accent rounded-lg">
                    <button data-action="change-cart-qty" data-index="${idx}" data-delta="-1" class="w-6 h-6 text-xs text-gray-300 flex items-center justify-center">-</button>
                    <span class="w-6 text-center text-xs font-bold text-white">${item.qty}</span>
                    <button data-action="change-cart-qty" data-index="${idx}" data-delta="1" class="w-6 h-6 text-xs text-gray-300 flex items-center justify-center">+</button>
                </div>
                </div>
            </div>
            `).join('');

        document.getElementById('summary-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
        if (activeDiscountPercent > 0) {
            document.getElementById('summary-discount-row').classList.remove('hidden');
            document.getElementById('summary-discount').innerText = `-Rp ${discountAmount.toLocaleString('id-ID')}`;
        } else {
            document.getElementById('summary-discount-row').classList.add('hidden');
        }
        document.getElementById('summary-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    }
}

function renderOrdersList() {
    const container = document.getElementById('orders-list-container');
    container.innerHTML = `
    <div class="bg-dark-card rounded-2xl p-4 border border-dark-accent space-y-3">
      <div class="flex items-center justify-between border-b border-dark-accent/60 pb-2">
        <div>
          <span class="text-xs font-bold text-white">#AG-8942</span>
          <p class="text-[10px] text-gray-400">17 Sep 2026 • 12:45 WIB</p>
        </div>
        <span class="bg-primary/20 text-primary border border-primary/30 font-bold text-[10px] px-2.5 py-1 rounded-full">
          <i class="fa-solid fa-spinner animate-spin mr-1"></i> Sedang Diproses
        </span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-300">Nasi Goreng Spesial & 2 Item lainnya</span>
        <span class="font-bold text-white">Rp 74.000</span>
      </div>
      <div class="flex items-center justify-end gap-2 pt-1">
        <button data-action="open-tracker" class="bg-primary text-dark-bg font-bold text-xs px-3.5 py-1.5 rounded-xl hover:bg-primary-dark transition shadow-glow">
          <i class="fa-solid fa-motorcycle mr-1"></i> Lacak Driver
        </button>
      </div>
    </div>`;
}

// ============================================
// ACTION HANDLERS
// ============================================
function selectCategory(cat, clickedEl = null) {
    currentCategory = cat;
    document.querySelectorAll('.category-card').forEach(btn => btn.classList.remove('active'));
    if (clickedEl && clickedEl.classList.contains('category-card')) {
        clickedEl.classList.add('active');
    } else {
        const catBtn = document.querySelector(`[data-action="select-category"][data-category="${cat}"]`);
        if (catBtn) catBtn.classList.add('active');
    }
    renderMenuGrid();
}

function filterMenu() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const clearBtn = document.getElementById('clear-search-btn');
    clearBtn.classList.toggle('hidden', query.length === 0);
    const filtered = MENU_DATA.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
    renderMenuGrid(filtered);
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('clear-search-btn').classList.add('hidden');
    renderMenuGrid();
}

async function quickAddToCart(foodId) {
  const food = MENU_DATA.find(f => f.id === foodId);
  if (!food) return;
  
  const existing = cart.find(c => c.foodId === foodId && c.spicy === 'Tidak Pedas' && (!c.addons || c.addons.length === 0));
  
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      foodId: food.id,
      name: food.name,
      price: food.price,
      img: food.img,
      qty: 1,
      spicy: 'Tidak Pedas',
      addons: [],
      notes: ''
    });
  }
  
  await saveCart();
  updateCartUI();
  showToast(`"${food.name}" ditambahkan ke keranjang!`);
}

async function openFoodModal(foodId) {
  const food = MENU_DATA.find(f => f.id === foodId);
  if (!food) return;
  
  selectedFoodForModal = food;
  modalQtyCount = 1;
  variationSelections = {}; // Reset selections
  
  document.getElementById('modal-food-img').src = food.img;
  document.getElementById('modal-food-title').innerText = food.name;
  document.getElementById('modal-food-price').innerText = `Rp ${food.price.toLocaleString('id-ID')}`;
  document.getElementById('modal-food-desc').innerText = food.desc;
  document.getElementById('modal-food-badge').innerText = food.badge;
  document.getElementById('modal-qty').innerText = modalQtyCount;
  document.getElementById('modal-food-notes').value = '';
  
  // ✅ Load variasi dari database
  currentMenuVariations = await fetchMenuVariations(foodId);
  renderModalVariations();
  updateModalTotalPrice();
  
  document.getElementById('food-detail-modal').classList.remove('hidden');
}

function renderModalVariations() {
  const container = document.getElementById('modal-variations-container');
  
  if (currentMenuVariations.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  container.innerHTML = currentMenuVariations.map(variation => {
    const selectedOptions = variationSelections[variation.id] || [];
    
    return `
      <div class="space-y-2" data-variation-id="${variation.id}">
        <div class="flex items-center justify-between">
          <label class="font-bold text-white text-xs">
            ${variation.name}
            ${variation.is_required ? '<span class="text-red-400 ml-1">*</span>' : '<span class="text-gray-500 text-[10px] ml-1">(opsional)</span>'}
          </label>
          <span class="text-[10px] text-gray-400">
            ${variation.min_select === variation.max_select 
              ? `Pilih ${variation.min_select}` 
              : `Pilih ${variation.min_select}-${variation.max_select}`}
            <span id="var-count-${variation.id}" class="text-primary font-bold ml-1">(${selectedOptions.length})</span>
          </span>
        </div>
        <div class="space-y-1.5">
          ${variation.options.map(opt => {
            const isSelected = selectedOptions.includes(opt.id);
            const inputType = variation.max_select === 1 ? 'radio' : 'checkbox';
            
            return `
              <label class="variation-option flex items-center justify-between p-2.5 rounded-xl bg-dark-bg border ${isSelected ? 'border-primary bg-primary/10' : 'border-dark-accent'} cursor-pointer transition hover:border-primary/50">
                <div class="flex items-center gap-2 flex-1">
                  <input type="${inputType}" 
                    name="variation-${variation.id}" 
                    value="${opt.id}" 
                    class="variation-input accent-primary"
                    data-variation-id="${variation.id}"
                    data-option-id="${opt.id}"
                    data-price="${opt.price_addon}"
                    ${isSelected ? 'checked' : ''}>
                  <span class="text-gray-200 text-xs">${opt.name}</span>
                </div>
                <span class="text-primary font-semibold text-xs">
                  ${opt.price_addon > 0 ? `+Rp ${opt.price_addon.toLocaleString('id-ID')}` : ''}
                </span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  // Bind event listener untuk variasi
  container.querySelectorAll('.variation-input').forEach(input => {
    input.addEventListener('change', handleVariationChange);
  });
}

function handleVariationChange(e) {
  const variationId = e.target.dataset.variationId;
  const optionId = e.target.dataset.optionId;
  const variation = currentMenuVariations.find(v => v.id === variationId);
  
  if (!variation) return;
  
  // Initialize jika belum ada
  if (!variationSelections[variationId]) {
    variationSelections[variationId] = [];
  }
  
  if (e.target.type === 'radio') {
    // Radio: hanya 1 pilihan
    variationSelections[variationId] = [optionId];
  } else {
    // Checkbox: multi pilih dengan max limit
    const index = variationSelections[variationId].indexOf(optionId);
    
    if (index > -1) {
      // Uncheck
      variationSelections[variationId].splice(index, 1);
    } else {
      // Check - cek max limit
      if (variationSelections[variationId].length >= variation.max_select) {
        showNotification(`Maksimal ${variation.max_select} pilihan untuk ${variation.name}`, 'warning');
        e.target.checked = false;
        return;
      }
      variationSelections[variationId].push(optionId);
    }
  }
  
  // Update UI
  renderModalVariations();
  updateModalTotalPrice();
}

function updateModalTotalPrice() {
  if (!selectedFoodForModal) return;
  
  let totalAddon = 0;
  
  // Hitung total addon dari variasi yang dipilih
  Object.entries(variationSelections).forEach(([variationId, optionIds]) => {
    const variation = currentMenuVariations.find(v => v.id === variationId);
    if (!variation) return;
    
    optionIds.forEach(optionId => {
      const option = variation.options.find(o => o.id === optionId);
      if (option) totalAddon += option.price_addon;
    });
  });
  
  const totalPrice = (selectedFoodForModal.price + totalAddon) * modalQtyCount;
  document.getElementById('modal-total-price').innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;
}

function closeFoodModal() { document.getElementById('food-detail-modal').classList.add('hidden'); }

function selectSpicy(el, level) {
    selectedSpicyLevel = level;
    document.querySelectorAll('.spicy-opt').forEach(btn => {
        btn.className = 'spicy-opt border border-dark-accent bg-dark-bg text-gray-300 py-2 rounded-xl text-center font-medium';
    });
    el.className = 'spicy-opt border border-primary bg-primary/20 text-primary py-2 rounded-xl text-center font-medium';
}

function adjustModalQty(delta) {
    modalQtyCount = Math.max(1, modalQtyCount + delta);
    document.getElementById('modal-qty').innerText = modalQtyCount;
}

async function confirmAddToCart() {
  if (!selectedFoodForModal) return;
  
  // ✅ VALIDASI VARIASI WAJIB
  for (const variation of currentMenuVariations) {
    if (variation.is_required) {
      const selected = variationSelections[variation.id] || [];
      if (selected.length < variation.min_select) {
        showNotification(`Mohon pilih minimal ${variation.min_select} item pada "${variation.name}"`, 'error');
        return;
      }
    }
  }
  
  // Hitung total addon
  let extraPrice = 0;
  let selectedVariations = [];
  
  Object.entries(variationSelections).forEach(([variationId, optionIds]) => {
    const variation = currentMenuVariations.find(v => v.id === variationId);
    if (!variation || optionIds.length === 0) return;
    
    const selectedOptions = optionIds.map(optionId => {
      const option = variation.options.find(o => o.id === optionId);
      if (option) {
        extraPrice += option.price_addon;
        return {
          optionId: option.id,
          name: option.name,
          priceAdd: option.price_addon
        };
      }
    }).filter(Boolean);
    
    selectedVariations.push({
      variationId: variation.id,
      variationName: variation.name,
      selectedOptions
    });
  });
  
  const notes = document.getElementById('modal-food-notes').value;
  
  cart.push({
    id: selectedFoodForModal.id + '_' + Date.now(),
    foodId: selectedFoodForModal.id,
    name: selectedFoodForModal.name,
    price: selectedFoodForModal.price + extraPrice,
    basePrice: selectedFoodForModal.price,
    img: selectedFoodForModal.img,
    qty: modalQtyCount,
    variations: selectedVariations,
    notes: notes
  });
  
  await saveCart();
  updateCartUI();
  closeFoodModal();
  showToast('Berhasil menambahkan ke keranjang!');
}

async function changeCartQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    if (isMember() && cart[index].cartItemId) {
      await removeCartItem(cart[index].cartItemId);
    }
    cart.splice(index, 1);
  } else {
    if (isMember() && cart[index].cartItemId) {
      await updateCartItem(cart[index].cartItemId, cart[index].qty);
    }
  }
  await saveCart();
  updateCartUI();
}

async function removeItemFromCart(index) {
  if (isMember() && cart[index].cartItemId) {
    await removeCartItem(cart[index].cartItemId);
  }
  cart.splice(index, 1);
  await saveCart();
  updateCartUI();
  showToast("Item dihapus dari keranjang.");
}

async function clearCart() {
  if (isMember()) {
    const profile = getCurrentProfile();
    if (profile) {
      await clearUserCart(profile.id);
    }
  }
  cart = [];
  activeDiscountPercent = 0;
  await saveCart();
  updateCartUI();
  showToast("Keranjang dibersihkan.");
}

function applyVoucher() {
    const code = document.getElementById('voucher-code-input').value.trim().toUpperCase();
    if (code === 'ANTIGRAVITY') {
        activeDiscountPercent = 0.5;
        updateCartUI();
        showToast("Voucher ANTIGRAVITY 50% Berhasil Dipasang! 🎉");
    } else {
        showToast("Kode voucher tidak valid.");
    }
}

function applyPromoBanner(code) {
    document.getElementById('voucher-code-input').value = code;
    switchTab('cart');
    applyVoucher();
}

function openCheckoutModal() {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const total = Math.max(0, subtotal + 12000 - (subtotal * activeDiscountPercent));
    document.getElementById('checkout-items-count').innerText = `${cart.reduce((s, i) => s + i.qty, 0)} Porsi`;
    document.getElementById('checkout-final-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() { document.getElementById('checkout-modal').classList.add('hidden'); }
function closeTrackerModal() { document.getElementById('tracker-modal').classList.add('hidden'); }
function simulateCall() { showToast("Menghubungi driver..."); }

// ============================================
// AUTH-AWARE CHECKOUT
// ============================================
function processOrder() {
    if (isGuest()) {
        // Non-member: Checkout tanpa login
        closeCheckoutModal();
        cart = [];
        saveCart();
        updateCartUI();
        showToast("Pesanan Berhasil Dibuat! 🚀 (Mode Tamu)");
        renderOrdersList();
        switchTab('orders');
        document.getElementById('tracker-modal').classList.remove('hidden');
    } else {
        // Member/Admin: Simpan ke Supabase
        closeCheckoutModal();
        cart = [];
        saveCart();
        updateCartUI();
        showToast("Pesanan Berhasil Dibuat! 🚀");
        renderOrdersList();
        switchTab('orders');
        document.getElementById('tracker-modal').classList.remove('hidden');
    }
}

// ============================================
// AUTH-AWARE FAVORITES (TERPISAH)
// ============================================
async function toggleFavorite(id) {
  if (isGuest()) {
    // Guest: Simpan HANYA di localStorage
    const index = favorites.indexOf(id);
    if (index > -1) {
      favorites.splice(index, 1);
      showToast("Dihapus dari Favorit");
    } else {
      favorites.push(id);
      showToast("Ditambahkan ke Favorit ❤️ (Sementara - Login untuk simpan permanen)");
    }
    saveGuestFavorites(favorites);
  } else if (isMember()) {
    // ✅ Member: Simpan HANYA di database Supabase
    // JANGAN sentuh localStorage guest!
    const profile = getCurrentProfile();
    if (!profile) return;
    
    const result = await toggleFavoriteInDB(profile.id, id);
    if (result.success) {
      if (result.action === 'added') {
        favorites.push(id);
        showToast("Ditambahkan ke Favorit ❤️");
      } else {
        favorites = favorites.filter(favId => favId !== id);
        showToast("Dihapus dari Favorit");
      }
    } else {
      showToast("Gagal mengupdate favorit: " + result.error);
    }
  }
  
  renderMenuGrid();
  renderFavorites();
}



function switchTab(tabName) {
    ['home', 'cart', 'orders', 'favorites', 'profile'].forEach(t => {
        const section = document.getElementById(`tab-${t}`);
        const navBtn = document.getElementById(`nav-${t}`);
        if (t === tabName) {
            section.classList.remove('hidden');
            if (navBtn) navBtn.className = 'nav-btn py-1 flex flex-col items-center justify-center text-primary font-bold';
        } else {
            section.classList.add('hidden');
            if (navBtn) navBtn.className = 'nav-btn py-1 flex flex-col items-center justify-center text-gray-400 hover:text-primary transition';
        }
    });
    if (tabName === 'orders') renderOrdersList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changeLocation() {
    const newLoc = prompt("Masukkan Alamat:", "Jl. Sudirman No. 45, Jakarta");
    if (newLoc) {
        document.getElementById('current-location').innerText = newLoc;
        showToast("Alamat diperbarui.");
    }
}

function toggleNotification() { showToast("Belum ada notifikasi baru."); }

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = "bg-dark-accent text-white border border-primary/40 px-4 py-2.5 rounded-2xl shadow-xl text-xs flex items-center gap-2 animate-bounce pointer-events-auto";
    toast.innerHTML = `<i class="fa-solid fa-circle-info text-primary"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// 👤 EDIT PROFILE
// ============================================
function openEditProfile() {
    const p = getCurrentProfile();
    if (!p) return;

    document.getElementById('edit-profile-name').value = p.full_name || '';
    document.getElementById('edit-profile-email').value = p.email || '';
    document.getElementById('edit-profile-phone').value = p.phone || '';

    // Load avatar preview
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarInitial = document.getElementById('avatar-initial');
    const removeBtn = document.getElementById('remove-avatar-btn');

    currentAvatarUrl = p.avatar_url;
    selectedAvatarFile = null;
    document.getElementById('avatar-input').value = '';
    document.getElementById('avatar-upload-status').classList.add('hidden');

    if (p.avatar_url) {
        avatarPreview.src = p.avatar_url;
        avatarPreview.classList.remove('hidden');
        avatarInitial.classList.add('hidden');
        removeBtn.classList.remove('hidden');
    } else {
        avatarPreview.classList.add('hidden');
        avatarInitial.classList.remove('hidden');
        avatarInitial.innerText = (p.full_name || 'U').charAt(0).toUpperCase();
        removeBtn.classList.add('hidden');
    }

    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEditProfile() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function handleEditProfileSubmit(e) {
    e.preventDefault();
    const profile = getCurrentProfile();
    if (!profile) return;

    const saveBtn = document.getElementById('save-profile-btn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i> Menyimpan...';

    try {
        // 1. Update data profil (nama, phone)
        const result = await updateProfile(profile.id, {
            full_name: document.getElementById('edit-profile-name').value,
            phone: document.getElementById('edit-profile-phone').value
        });

        if (!result.success) throw new Error(result.error);

        // 2. Handle avatar jika ada perubahan
        let newAvatarUrl = currentAvatarUrl;

        // Kasus A: User upload foto baru
        if (selectedAvatarFile) {
            const statusEl = document.getElementById('avatar-upload-status');
            statusEl.classList.remove('hidden');
            statusEl.innerHTML = '<span class="text-blue-400"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Mengupload foto...</span>';

            // Hapus foto lama jika ada
            if (currentAvatarUrl) {
                await deleteOldAvatar(currentAvatarUrl);
            }

            // Upload foto baru
            const uploadResult = await uploadAvatar(profile.id, selectedAvatarFile);

            if (uploadResult.success) {
                newAvatarUrl = uploadResult.url;
                await updateAvatarUrl(profile.id, newAvatarUrl);
                statusEl.innerHTML = '<span class="text-green-400"><i class="fa-solid fa-check mr-1"></i> Foto berhasil diupload!</span>';
            } else {
                throw new Error(uploadResult.error);
            }
        }

        // Kasus B: User hapus foto (removeBtn diklik)
        else if (currentAvatarUrl && document.getElementById('avatar-preview').classList.contains('hidden') && !selectedAvatarFile) {
            // Cek apakah sebelumnya ada foto dan sekarang dihapus
            const profile_had_avatar = profile.avatar_url;
            if (profile_had_avatar) {
                await deleteOldAvatar(profile_had_avatar);
                await updateAvatarUrl(profile.id, null);
                newAvatarUrl = null;
            }
        }

        // 3. Refresh profile & tampilkan notifikasi
        await refreshProfile();
        showNotification('Profil berhasil diperbarui!', 'success');
        closeEditProfile();
        renderAuthUI();

    } catch (error) {
        console.error('Save profile error:', error);
        showNotification(error.message || 'Gagal menyimpan profil', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

// ============================================
// 🔐 CHANGE PASSWORD
// ============================================
function openChangePassword() {
    document.getElementById('change-password-form').reset();
    document.getElementById('change-password-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeChangePassword() {
    document.getElementById('change-password-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();

    const currentPwd = document.getElementById('current-password').value;
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (newPwd !== confirmPwd) {
        showNotification('Password baru dan konfirmasi tidak cocok', 'error');
        return;
    }

    if (newPwd.length < 6) {
        showNotification('Password minimal 6 karakter', 'error');
        return;
    }

    const result = await updatePassword(currentPwd, newPwd);

    if (result.success) {
        showNotification('Password berhasil diubah!', 'success');
        closeChangePassword();
    } else {
        showNotification(result.error, 'error');
    }
}

// ============================================
// 🏠 ADDRESSES MANAGEMENT
// ============================================
async function loadUserAddresses() {
    const profile = getCurrentProfile();
    if (!profile) return;

    userAddresses = await fetchUserAddresses(profile.id);
    renderAddressesList();

    // Update badge
    const badge = document.getElementById('address-count-badge');
    if (badge) badge.innerText = userAddresses.length;

    // Update alamat di checkout
    updateCheckoutAddress();
}

function renderAddressesList() {
    const list = document.getElementById('addresses-list');

    if (userAddresses.length === 0) {
        list.innerHTML = `
      <div class="text-center py-8">
        <i class="fa-solid fa-location-dot text-4xl text-gray-600 mb-3"></i>
        <p class="text-sm text-gray-400">Belum ada alamat tersimpan</p>
        <p class="text-xs text-gray-500 mt-1">Tambahkan alamat untuk checkout lebih cepat</p>
      </div>
    `;
        return;
    }

    list.innerHTML = userAddresses.map(addr => `
    <div class="bg-dark-bg rounded-2xl p-4 border ${addr.is_primary ? 'border-primary/50' : 'border-dark-accent'} relative">
      ${addr.is_primary ? `
        <span class="absolute top-3 right-3 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
          <i class="fa-solid fa-star mr-1"></i> Utama
        </span>
      ` : ''}
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
          <i class="fa-solid ${addr.label === 'Rumah' ? 'fa-house' : addr.label === 'Kantor' ? 'fa-briefcase' : 'fa-location-dot'}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-sm text-white">${addr.label}</h4>
          </div>
          <p class="text-xs text-gray-300 font-medium">${addr.recipient_name} • +62 ${addr.phone}</p>
          <p class="text-xs text-gray-400 mt-1 leading-relaxed">${addr.address}</p>
          ${addr.city ? `<p class="text-xs text-gray-500 mt-0.5">${addr.city}${addr.postal_code ? ` • ${addr.postal_code}` : ''}</p>` : ''}
          ${addr.notes ? `<p class="text-[10px] text-gray-500 italic mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${addr.notes}</p>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-dark-accent/50">
        ${!addr.is_primary ? `
          <button data-action="set-primary-address" data-id="${addr.id}" class="flex-1 bg-dark-accent hover:bg-primary/20 text-gray-300 hover:text-primary py-2 rounded-lg text-xs font-medium transition">
            <i class="fa-solid fa-star mr-1"></i> Jadikan Utama
          </button>
        ` : ''}
        <button data-action="edit-address" data-id="${addr.id}" class="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 rounded-lg text-xs font-medium transition">
          <i class="fa-solid fa-pen mr-1"></i> Edit
        </button>
        <button data-action="delete-address" data-id="${addr.id}" class="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs font-medium transition">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ============================================
// 🏠 ADDRESSES
// ============================================
function openAddressesModal() {
    document.getElementById('addresses-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    loadUserAddresses();
}

function closeAddressesModal() {
    document.getElementById('addresses-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function openAddressForm(addressId = null) {
    editingAddressId = addressId;
    const form = document.getElementById('address-form');
    form.reset();

    // Reset label buttons
    document.querySelectorAll('.label-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'bg-primary/20', 'text-primary');
        btn.classList.add('border-dark-accent', 'bg-dark-bg', 'text-gray-300');
    });

    if (!addressId) {
        // Add mode - auto-fill dari profile
        const p = getCurrentProfile();
        if (p) {
            document.getElementById('address-recipient').value = p.full_name || '';

            // ✅ Auto-fill phone dengan validasi
            const phoneInput = document.getElementById('address-phone');
            phoneInput.value = p.phone || '';
            validatePhoneInput(phoneInput); // Validasi nilai auto-fill
        }

        document.getElementById('address-form-title').innerHTML = '<i class="fa-solid fa-plus-circle text-primary"></i> <span>Tambah Alamat</span>';
    }

    if (addressId) {
        // Edit mode
        const addr = userAddresses.find(a => a.id === addressId);
        if (addr) {
            document.getElementById('address-id').value = addr.id;
            document.getElementById('address-label').value = addr.label;
            document.getElementById('address-recipient').value = addr.recipient_name;
            document.getElementById('address-phone').value = addr.phone;
            document.getElementById('address-detail').value = addr.address;
            document.getElementById('address-postal').value = addr.postal_code || '';
            document.getElementById('address-city').value = addr.city || '';
            document.getElementById('address-notes').value = addr.notes || '';
            document.getElementById('address-primary').checked = addr.is_primary;

            // Highlight active label
            const activeBtn = document.querySelector(`.label-btn[data-label="${addr.label}"]`);
            if (activeBtn) {
                activeBtn.classList.remove('border-dark-accent', 'bg-dark-bg', 'text-gray-300');
                activeBtn.classList.add('border-primary', 'bg-primary/20', 'text-primary');
            }

            document.getElementById('address-form-title').innerHTML = '<i class="fa-solid fa-pen text-primary"></i> <span>Edit Alamat</span>';
        }
    } else {
        // Add mode
        document.getElementById('address-id').value = '';
        document.getElementById('address-label').value = 'Rumah';
        const defaultBtn = document.querySelector('.label-btn[data-label="Rumah"]');
        if (defaultBtn) {
            defaultBtn.classList.remove('border-dark-accent', 'bg-dark-bg', 'text-gray-300');
            defaultBtn.classList.add('border-primary', 'bg-primary/20', 'text-primary');
        }

        // Auto-fill dari profile
        const p = getCurrentProfile();
        if (p) {
            document.getElementById('address-recipient').value = p.full_name || '';
            document.getElementById('address-phone').value = p.phone || '';
        }

        document.getElementById('address-form-title').innerHTML = '<i class="fa-solid fa-plus-circle text-primary"></i> <span>Tambah Alamat</span>';
    }

    document.getElementById('address-form-modal').classList.remove('hidden');
}

function closeAddressForm() {
    document.getElementById('address-form-modal').classList.add('hidden');
    editingAddressId = null;
}

async function saveAddress() {
    const profile = getCurrentProfile();
    if (!profile) return;

    const phoneInput = document.getElementById('address-phone');
    const phoneValue = phoneInput.value;

    // ✅ Validasi final no. HP
    if (!phoneValue || phoneValue.length < 8) {
        showNotification('No. HP minimal 8 digit', 'error');
        phoneInput.focus();
        return;
    }

    if (phoneValue.startsWith('0')) {
        showNotification('No. HP tidak boleh diawali dengan 0', 'error');
        phoneInput.focus();
        return;
    }

    const addressData = {
        label: document.getElementById('address-label').value,
        recipient_name: document.getElementById('address-recipient').value,
        phone: document.getElementById('address-phone').value,
        address: document.getElementById('address-detail').value,
        postal_code: document.getElementById('address-postal').value,
        city: document.getElementById('address-city').value,
        notes: document.getElementById('address-notes').value,
        is_primary: document.getElementById('address-primary').checked
    };

    // Validasi
    if (!addressData.recipient_name || !addressData.phone || !addressData.address) {
        showNotification('Mohon lengkapi data yang wajib diisi', 'error');
        return;
    }

    let result;
    if (editingAddressId) {
        result = await updateAddress(editingAddressId, addressData);
    } else {
        result = await addAddress(profile.id, addressData);
    }

    if (result.success) {
        showNotification(editingAddressId ? 'Alamat berhasil diupdate!' : 'Alamat berhasil ditambahkan!', 'success');
        closeAddressForm();
        loadUserAddresses();
    } else {
        showNotification(result.error, 'error');
    }
}

async function handleSetPrimaryAddress(addressId) {
    const profile = getCurrentProfile();
    if (!profile) return;

    const result = await setPrimaryAddress(addressId, profile.id);
    if (result.success) {
        showNotification('Alamat utama berhasil diubah', 'success');
        loadUserAddresses();
    } else {
        showNotification(result.error, 'error');
    }
}

function handleDeleteAddress(addressId) {
    const addr = userAddresses.find(a => a.id === addressId);
    if (!addr) return;

    showConfirmPopup({
        title: 'Hapus Alamat?',
        message: `Alamat "${addr.label}" akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
        type: 'danger',
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
            const result = await deleteAddress(addressId);
            if (result.success) {
                showNotification('Alamat berhasil dihapus', 'success');
                loadUserAddresses();
            } else {
                showNotification(result.error, 'error');
            }
        }
    });
}

function updateCheckoutAddress() {
    const primary = userAddresses.find(a => a.is_primary) || userAddresses[0];
    const addressText = document.querySelector('#checkout-modal .font-bold.text-white.text-sm');
    const addressDetail = document.querySelector('#checkout-modal .text-gray-300');

    if (primary && addressText && addressDetail) {
        addressText.innerText = `${primary.label} - ${primary.recipient_name}`;
        addressDetail.innerText = `${primary.address}${primary.city ? `, ${primary.city}` : ''}`;
    }
}

// ============================================
// 📱 HELPER: VALIDASI NO. HP
// ============================================

/**
 * Validasi input no. HP:
 * - Hanya angka (0-9)
 * - Tidak boleh diawali dengan "0"
 * - Maksimal 13 digit (format Indonesia tanpa prefix)
 * 
 * @param {HTMLInputElement} input - Elemen input yang divalidasi
 */
function validatePhoneInput(input) {
    // Ambil nilai saat ini
    let value = input.value;

    // 1. Hapus semua karakter non-digit
    value = value.replace(/\D/g, '');

    // 2. Hapus leading zero (angka 0 di awal)
    if (value.startsWith('0')) {
        value = value.replace(/^0+/, '');
    }

    // 3. Batasi maksimal 13 digit (format Indonesia)
    if (value.length > 13) {
        value = value.substring(0, 13);
    }

    // 4. Update nilai input
    input.value = value;
}

/**
 * Setup validasi real-time untuk field phone
 * @param {HTMLInputElement} input - Elemen input
 */
function setupPhoneValidation(input) {
    if (!input) return;

    // Validasi saat user mengetik
    input.addEventListener('input', () => validatePhoneInput(input));

    // Cegah paste karakter non-angka
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleaned = pastedText.replace(/\D/g, '').replace(/^0+/, '');

        // Insert text yang sudah dibersihkan di posisi cursor
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + cleaned + input.value.substring(end);

        // Validasi lagi setelah paste
        validatePhoneInput(input);
    });

    // Cegah input karakter non-angka via keyboard
    input.addEventListener('keypress', (e) => {
        // Izinkan control keys (backspace, delete, tab, escape, enter, dll)
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length > 1) return; // Arrow keys, dll
        if (!/\d/.test(e.key)) {
            e.preventDefault();
        }
    });

    // Cegah drag & drop text
    input.addEventListener('drop', (e) => e.preventDefault());
}