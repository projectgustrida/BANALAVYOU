import { supabase } from './supabase-config.js';

let _menuChannel = null;
let _allMenuChannel = null;
let _categoryChannel = null;
let _allCategoryChannel = null;

// ============================================
// 🍔 MENU OPERATIONS
// ============================================

// Subscribe real-time menu (otomatis update saat ada perubahan)
export function subscribeMenu(callback) {
  // Fetch awal
  fetchActiveMenu().then(callback);
  
  // Cek apakah channel sudah ada
  if (_menuChannel) {
    console.log('ℹ️ Menu channel sudah ada, reuse');
    return _menuChannel;
  }
  
  // Buat channel baru
  _menuChannel = supabase
    .channel('menu-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'menu' }, 
      () => {
        fetchActiveMenu().then(callback);
      }
    )
    .subscribe();
  
  return _menuChannel;
}

// Fetch semua menu
export async function fetchAllMenu() {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetch all menu:', error);
    return [];
  }
  
  return data.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    rating: parseFloat(item.rating),
    time: item.time,
    badge: item.badge,
    desc: item.description,
    img: item.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
    is_active: item.is_active
  }));
}

// Tambah menu baru + upload foto
export async function addMenuItem(menuData, imageFile) {
  try {
    let imageUrl = null;
    
    // 1. Upload foto ke Storage (jika ada)
    if (imageFile) {
      const timestamp = Date.now();
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `menu/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Dapatkan public URL
      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);
      
      imageUrl = urlData.publicUrl;
    }
    
    // 2. Simpan data menu ke database
    const { data, error: dbError } = await supabase
      .from('menu')
      .insert([{
        name: menuData.name,
        category: menuData.category,
        price: parseInt(menuData.price),
        rating: parseFloat(menuData.rating) || 4.5,
        time: menuData.time || '15-20 min',
        badge: menuData.badge || 'Baru',
        description: menuData.desc,
        image_url: imageUrl
      }])
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    return { success: true, data: data };
  } catch (error) {
    console.error("Error add menu:", error);
    return { success: false, error: error.message };
  }
}

// ✅ UPDATE MENU (dengan upload foto baru opsional)
export async function updateMenuItem(menuId, newData, newImageFile = null) {
  try {
    const updates = {
      name: newData.name,
      category: newData.category,
      price: parseInt(newData.price),
      rating: parseFloat(newData.rating) || 4.5,
      time: newData.time || '15-20 min',
      badge: newData.badge || '',
      description: newData.desc,
      updated_at: new Date().toISOString()
    };
    
    // Upload foto baru jika ada
    if (newImageFile) {
      const timestamp = Date.now();
      const fileExt = newImageFile.name.split('.').pop();
      const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `menu/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, newImageFile);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);
      
      updates.image_url = urlData.publicUrl;
    }
    
    const { data, error } = await supabase
      .from('menu')
      .update(updates)
      .eq('id', menuId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error update menu:', error);
    return { success: false, error: error.message };
  }
}

// ✅ HAPUS MENU PERMANEN (Hard Delete + hapus foto)
export async function deleteMenuItem(menuId, imageUrl) {
  try {
    // Hapus foto dari Storage (jika ada)
    if (imageUrl && imageUrl.includes('supabase')) {
      try {
        const urlParts = imageUrl.split('/menu/');
        if (urlParts.length > 1) {
          await supabase.storage
            .from('menu-images')
            .remove([`menu/${urlParts[1]}`]);
        }
      } catch (e) {
        console.warn('Gagal hapus foto:', e);
      }
    }
    
    // Hapus dari database
    const { error } = await supabase
      .from('menu')
      .delete()
      .eq('id', menuId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 🛒 ORDERS OPERATIONS
// ============================================

export async function createOrder(userId, items, total, address, paymentMethod, discount = 0) {
  try {
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        user_id: userId,
        items: items,
        subtotal: subtotal,
        shipping: 10000,
        service_fee: 2000,
        discount: discount,
        total: total,
        address: address,
        payment_method: paymentMethod,
        status: 'processing'
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, orderId: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchUserOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetch orders:", error);
    return [];
  }
  return data;
}

// ============================================
// ❤️ FAVORITES OPERATIONS
// ============================================

export async function fetchUserFavorites(userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('menu_id')
    .eq('user_id', userId);
  
  if (error) return [];
  return data.map(f => f.menu_id);
}

export async function toggleFavorite(userId, menuId) {
  try {
    // Cek apakah sudah difavoritkan
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('menu_id', menuId)
      .single();
    
    if (existing) {
      // Hapus dari favorit
      await supabase.from('favorites').delete().eq('id', existing.id);
      return { success: true, action: 'removed' };
    } else {
      // Tambah ke favorit
      await supabase.from('favorites').insert([{ user_id: userId, menu_id: menuId }]);
      return { success: true, action: 'added' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 🏷️ CATEGORIES OPERATIONS
// ============================================

// Fetch semua kategori (untuk user app - hanya yang aktif)
export async function fetchActiveCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  
  if (error) return [];
  return data;
}

// Fetch SEMUA kategori (untuk admin - termasuk yang non-aktif)
export async function fetchAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error) return [];
  return data;
}

// Subscribe real-time kategori
export function subscribeCategories(callback) {
  fetchActiveCategories().then(callback);
  
  if (_categoryChannel) {
    console.log('ℹ️ Category channel sudah ada, reuse');
    return _categoryChannel;
  }
  
  _categoryChannel = supabase
    .channel('category-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'categories' },
      () => {
        fetchActiveCategories().then(callback);
      }
    )
    .subscribe();
  
  return _categoryChannel;
}

// Subscribe semua kategori (untuk admin)
export function subscribeAllCategories(callback) {
  fetchAllCategories().then(callback);
  
  if (_allCategoryChannel) {
    console.log('ℹ️ All-category channel sudah ada, reuse');
    return _allCategoryChannel;
  }
  
  _allCategoryChannel = supabase
    .channel('all-category-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'categories' },
      () => {
        fetchAllCategories().then(callback);
      }
    )
    .subscribe();
  
  return _allCategoryChannel;
}

// Tambah kategori baru (dengan error handling yang lebih baik)
export async function addCategory(categoryData) {
  try {
    const slug = categoryData.slug || generateSlug(categoryData.name);
    
    // ✅ CEK DULU: Apakah slug sudah ada?
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name, is_active')
      .eq('slug', slug)
      .maybeSingle();
    
    if (existing) {
      // Slug sudah ada - kembalikan error yang ramah
      if (!existing.is_active) {
        return { 
          success: false, 
          errorType: 'inactive_duplicate',
          error: `Kategori "${existing.name}" sudah ada tetapi sedang dinonaktifkan. Silakan aktifkan kembali atau gunakan nama berbeda.`,
          existingId: existing.id
        };
      }
      return { 
        success: false, 
        errorType: 'duplicate',
        error: `Kategori "${existing.name}" sudah ada. Silakan gunakan nama yang berbeda.`
      };
    }
    
    // Lanjut insert jika belum ada
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: categoryData.name,
        slug: slug,
        icon: categoryData.icon || 'fa-solid fa-utensils',
        sort_order: categoryData.sort_order || 0,
        is_active: categoryData.is_active !== false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error add category:', error);
    
    // Fallback: tangani error PostgreSQL unique constraint
    if (error.code === '23505') {
      return { 
        success: false, 
        errorType: 'duplicate',
        error: `Kategori dengan nama serupa sudah ada. Silakan gunakan nama yang berbeda.`
      };
    }
    
    return { success: false, error: error.message };
  }
}

// Update kategori
export async function updateCategory(categoryId, categoryData) {
  try {
    const updates = {
      ...categoryData,
      updated_at: new Date().toISOString()
    };
    
    // Jika nama berubah tapi slug tidak dikirim, generate slug baru
    if (categoryData.name && !categoryData.slug) {
      updates.slug = generateSlug(categoryData.name);
    }
    
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error update category:', error);
    return { success: false, error: error.message };
  }
}

// Hapus kategori (soft delete - set is_active = false)
export async function deactivateCategory(categoryId) {
  try {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', categoryId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Aktifkan kembali kategori
export async function activateCategory(categoryId) {
  try {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', categoryId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hard delete kategori
export async function deleteCategory(categoryId) {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper: Generate slug dari nama
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================
// 🍔 MENU OPERATIONS (UPDATED)
// ============================================

// Fetch menu yang aktif saja (untuk user app)
export async function fetchActiveMenu() {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetch menu:', error);
    return [];
  }
  
  return data.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    rating: parseFloat(item.rating),
    time: item.time,
    badge: item.badge,
    desc: item.description,
    img: item.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
    is_active: item.is_active
  }));
}

// ✅ Subscribe SEMUA menu (untuk admin)
export function subscribeAllMenu(callback) {
  // Fetch awal
  fetchAllMenu().then(callback);
  
  // ✅ CEK: Jika channel sudah ada, JANGAN buat lagi
  if (_allMenuChannel) {
    console.log('ℹ️ All-menu channel sudah ada, reuse');
    return _allMenuChannel;
  }
  
  // Buat channel baru (hanya sekali)
  _allMenuChannel = supabase
    .channel('all-menu-channels')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'menu' }, 
      () => {
        fetchAllMenu().then(callback);
      }
    )
    .subscribe();
  
  return _allMenuChannel;
}

// ✅ NONAKTIFKAN MENU (Soft Delete)
export async function deactivateMenuItem(menuId) {
  try {
    const { error } = await supabase
      .from('menu')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', menuId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ✅ AKTIFKAN KEMBALI MENU
export async function activateMenuItem(menuId) {
  try {
    const { error } = await supabase
      .from('menu')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', menuId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ✅ AMBIL DATA MENU BY ID (untuk edit)
export async function fetchMenuItemById(menuId) {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('id', menuId)
    .single();
  
  if (error) {
    console.error('Error fetch menu by id:', error);
    return null;
  }
  return data;
}

// ============================================
// 👤 PROFILE OPERATIONS
// ============================================

// Update profile (nama, phone, dll)
export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update password
export async function updatePassword(currentPassword, newPassword) {
  try {
    // Verifikasi password lama dulu
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user.email,
      password: currentPassword
    });
    
    if (signInError) {
      return { success: false, error: 'Password lama tidak sesuai' };
    }
    
    // Update password baru
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 🏠 ADDRESS OPERATIONS
// ============================================

// Fetch semua alamat user
export async function fetchUserAddresses(userId) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetch addresses:', error);
    return [];
  }
  return data;
}

// Subscribe real-time alamat
export function subscribeUserAddresses(userId, callback) {
  fetchUserAddresses(userId).then(callback);
  
  const channel = supabase
    .channel(`addresses-${userId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'addresses', filter: `user_id=eq.${userId}` },
      () => {
        fetchUserAddresses(userId).then(callback);
      }
    )
    .subscribe();
  
  return channel;
}

// Tambah alamat baru
export async function addAddress(userId, addressData) {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .insert([{
        user_id: userId,
        label: addressData.label || 'Rumah',
        recipient_name: addressData.recipient_name,
        phone: addressData.phone,
        address: addressData.address,
        postal_code: addressData.postal_code || '',
        city: addressData.city || '',
        notes: addressData.notes || '',
        is_primary: addressData.is_primary || false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update alamat
export async function updateAddress(addressId, addressData) {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .update({
        label: addressData.label,
        recipient_name: addressData.recipient_name,
        phone: addressData.phone,
        address: addressData.address,
        postal_code: addressData.postal_code || '',
        city: addressData.city || '',
        notes: addressData.notes || '',
        is_primary: addressData.is_primary || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', addressId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Set alamat sebagai primary
export async function setPrimaryAddress(addressId, userId) {
  try {
    // Reset semua alamat jadi non-primary
    await supabase
      .from('addresses')
      .update({ is_primary: false })
      .eq('user_id', userId);
    
    // Set alamat ini jadi primary
    const { error } = await supabase
      .from('addresses')
      .update({ is_primary: true })
      .eq('id', addressId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hapus alamat (soft delete)
export async function deleteAddress(addressId) {
  try {
    const { error } = await supabase
      .from('addresses')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', addressId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Ambil alamat primary user
export async function getPrimaryAddress(userId) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error) return null;
  return data;
}

// ============================================
// 📸 AVATAR OPERATIONS
// ============================================

/**
 * Compress gambar di client sebelum upload
 * @param {File} file - File gambar
 * @param {number} maxSize - Ukuran maksimal (width/height) dalam px
 * @param {number} quality - Kualitas JPEG (0-1)
 * @returns {Promise<Blob>} - Blob gambar yang sudah di-compress
 */
export async function compressImage(file, maxSize = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize jika lebih besar dari maxSize
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Gagal compress gambar'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload foto profil user
 * @param {string} userId - ID user
 * @param {File} file - File gambar
 * @returns {Object} - { success, url, error }
 */
export async function uploadAvatar(userId, file) {
  try {
    // Validasi file
    if (!file) return { success: false, error: 'File tidak ditemukan' };
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return { success: false, error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.' };
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB sebelum compress
      return { success: false, error: 'Ukuran file terlalu besar (maksimal 5MB sebelum compress).' };
    }
    
    // Compress gambar
    const compressedBlob = await compressImage(file, 512, 0.85);
    const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
    
    // Generate nama file unik
    const timestamp = Date.now();
    const fileExt = 'jpg';
    const fileName = `${userId}/avatar_${timestamp}.${fileExt}`;
    
    // Upload ke storage
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (uploadError) throw uploadError;
    
    // Dapatkan public URL
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);
    
    return { success: true, url: urlData.publicUrl, path: fileName };
  } catch (error) {
    console.error('Upload avatar error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Hapus foto profil lama dari storage
 * @param {string} oldAvatarUrl - URL avatar lama
 */
export async function deleteOldAvatar(oldAvatarUrl) {
  if (!oldAvatarUrl || !oldAvatarUrl.includes('profile-images')) return;
  
  try {
    // Extract path dari URL
    const urlParts = oldAvatarUrl.split('/profile-images/');
    if (urlParts.length < 2) return;
    
    const filePath = urlParts[1];
    
    await supabase.storage
      .from('profile-images')
      .remove([filePath]);
  } catch (error) {
    console.warn('Gagal hapus avatar lama:', error);
    // Jangan throw error, biarkan proses lanjut
  }
}

/**
 * Update avatar URL di tabel profiles
 * @param {string} userId - ID user
 * @param {string} avatarUrl - URL avatar baru
 */
export async function updateAvatarUrl(userId, avatarUrl) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 🛒 CART OPERATIONS (untuk Member)
// ============================================

// Fetch keranjang user dari database
export async function fetchUserCart(userId) {
  const { data, error } = await supabase
    .from('carts')
    .select(`
      *,
      menu:food_id (
        id,
        name,
        price,
        image_url,
        category
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetch cart:', error);
    return [];
  }
  
  // Format data agar kompatibel dengan struktur cart di app.js
  return data.map(item => ({
    id: item.food_id + '_' + item.spicy_level + '_' + JSON.stringify(item.addons),
    foodId: item.food_id,
    name: item.menu?.name || 'Menu tidak ditemukan',
    price: item.menu?.price || 0,
    img: item.menu?.image_url || 'https://via.placeholder.com/100x100?text=No+Image',
    qty: item.quantity,
    spicy: item.spicy_level,
    addons: item.addons || [],
    notes: item.notes || '',
    cartItemId: item.id // ID dari tabel carts (untuk update/delete)
  }));
}

// Subscribe real-time keranjang
export function subscribeUserCart(userId, callback) {
  fetchUserCart(userId).then(callback);
  
  const channel = supabase
    .channel(`cart-${userId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'carts', filter: `user_id=eq.${userId}` },
      () => {
        fetchUserCart(userId).then(callback);
      }
    )
    .subscribe();
  
  return channel;
}

// Tambah item ke keranjang
export async function addToCart(userId, cartItem) {
  try {
    // Cek apakah item dengan konfigurasi sama sudah ada
    const { data: existing } = await supabase
      .from('carts')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('food_id', cartItem.foodId)
      .eq('spicy_level', cartItem.spicy)
      .single();
    
    if (existing) {
      // Update quantity jika sudah ada
      const { error } = await supabase
        .from('carts')
        .update({ 
          quantity: existing.quantity + cartItem.qty,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) throw error;
      return { success: true };
    } else {
      // Insert baru
      const { error } = await supabase
        .from('carts')
        .insert([{
          user_id: userId,
          food_id: cartItem.foodId,
          quantity: cartItem.qty,
          spicy_level: cartItem.spicy,
          addons: cartItem.addons || [],
          notes: cartItem.notes || ''
        }]);
      
      if (error) throw error;
      return { success: true };
    }
  } catch (error) {
    console.error('Error add to cart:', error);
    return { success: false, error: error.message };
  }
}

// Update quantity item di keranjang
export async function updateCartItem(cartItemId, newQuantity) {
  try {
    if (newQuantity <= 0) {
      // Hapus item jika quantity 0
      return await removeCartItem(cartItemId);
    }
    
    const { error } = await supabase
      .from('carts')
      .update({ 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', cartItemId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hapus item dari keranjang
export async function removeCartItem(cartItemId) {
  try {
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('id', cartItemId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Kosongkan keranjang
export async function clearUserCart(userId) {
  try {
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// ❤️ FAVORITES OPERATIONS (untuk Member)
// ============================================

// Fetch favorit user dari database
export async function fetchUserFavoritesFromDB(userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('menu_id')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetch favorites:', error);
    return [];
  }
  
  return data.map(fav => fav.menu_id);
}

// Subscribe real-time favorit
export function subscribeUserFavorites(userId, callback) {
  fetchUserFavoritesFromDB(userId).then(callback);
  
  const channel = supabase
    .channel(`favorites-${userId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${userId}` },
      () => {
        fetchUserFavoritesFromDB(userId).then(callback);
      }
    )
    .subscribe();
  
  return channel;
}

// Toggle favorit (add/remove)
export async function toggleFavoriteInDB(userId, menuId) {
  try {
    // Cek apakah sudah difavoritkan
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('menu_id', menuId)
      .single();
    
    if (existing) {
      // Hapus dari favorit
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id);
      
      if (error) throw error;
      return { success: true, action: 'removed' };
    } else {
      // Tambah ke favorit
      const { error } = await supabase
        .from('favorites')
        .insert([{ user_id: userId, menu_id: menuId }]);
      
      if (error) throw error;
      return { success: true, action: 'added' };
    }
  } catch (error) {
    console.error('Error toggle favorite:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 🔄 MIGRASI DATA (localStorage → Database)
// ============================================

// Migrasi cart dari localStorage ke database saat user login
export async function migrateGuestCartToDB(userId, guestCart) {
  if (!guestCart || guestCart.length === 0) return { success: true };
  
  try {
    for (const item of guestCart) {
      await addToCart(userId, item);
    }
    
    // Hapus cart dari localStorage setelah migrasi
    localStorage.removeItem('ag_guest_cart');
    
    return { success: true, migrated: guestCart.length };
  } catch (error) {
    console.error('Error migrate cart:', error);
    return { success: false, error: error.message };
  }
}

// Migrasi favorites dari localStorage ke database
export async function migrateGuestFavoritesToDB(userId, guestFavorites) {
  if (!guestFavorites || guestFavorites.length === 0) return { success: true };
  
  try {
    for (const menuId of guestFavorites) {
      await toggleFavoriteInDB(userId, menuId);
    }
    
    // Hapus favorites dari localStorage setelah migrasi
    localStorage.removeItem('ag_guest_favorites');
    
    return { success: true, migrated: guestFavorites.length };
  } catch (error) {
    console.error('Error migrate favorites:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 🎨 VARIASI MENU OPERATIONS
// ============================================

// Fetch semua variasi untuk menu tertentu (dengan options)
export async function fetchMenuVariations(menuId) {
  const { data, error } = await supabase
    .from('menu_variations')
    .select(`
      *,
      options:variation_options (
        id,
        name,
        price_addon,
        sort_order
      )
    `)
    .eq('menu_id', menuId)
    .order('sort_order', { ascending: true });
  
  if (error) {
    console.error('Error fetch variations:', error);
    return [];
  }
  
  // Sort options di dalam setiap variasi
  return data.map(variation => ({
    ...variation,
    options: (variation.options || []).sort((a, b) => a.sort_order - b.sort_order)
  }));
}

// Tambah variasi baru
export async function addVariation(menuId, variationData) {
  try {
    const { data, error } = await supabase
      .from('menu_variations')
      .insert([{
        menu_id: menuId,
        name: variationData.name,
        min_select: parseInt(variationData.min_select) || 0,
        max_select: parseInt(variationData.max_select) || 1,
        is_required: variationData.is_required !== false,
        sort_order: parseInt(variationData.sort_order) || 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update variasi
export async function updateVariation(variationId, variationData) {
  try {
    const { data, error } = await supabase
      .from('menu_variations')
      .update({
        name: variationData.name,
        min_select: parseInt(variationData.min_select) || 0,
        max_select: parseInt(variationData.max_select) || 1,
        is_required: variationData.is_required !== false,
        sort_order: parseInt(variationData.sort_order) || 0
      })
      .eq('id', variationId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hapus variasi (cascade hapus options)
export async function deleteVariation(variationId) {
  try {
    const { error } = await supabase
      .from('menu_variations')
      .delete()
      .eq('id', variationId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Tambah opsi ke variasi
export async function addVariationOption(variationId, optionData) {
  try {
    const { data, error } = await supabase
      .from('variation_options')
      .insert([{
        variation_id: variationId,
        name: optionData.name,
        price_addon: parseInt(optionData.price_addon) || 0,
        sort_order: parseInt(optionData.sort_order) || 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update opsi variasi
export async function updateVariationOption(optionId, optionData) {
  try {
    const { data, error } = await supabase
      .from('variation_options')
      .update({
        name: optionData.name,
        price_addon: parseInt(optionData.price_addon) || 0,
        sort_order: parseInt(optionData.sort_order) || 0
      })
      .eq('id', optionId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hapus opsi variasi
export async function deleteVariationOption(optionId) {
  try {
    const { error } = await supabase
      .from('variation_options')
      .delete()
      .eq('id', optionId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}