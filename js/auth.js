import { supabase } from './supabase-config.js';

let currentUser = null;
let currentProfile = null;

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    currentUser = session.user;
    currentProfile = await fetchProfile(currentUser.id);
    
    // 🛡️ FALLBACK: Jika profile null, coba buat atau update otomatis
    if (!currentProfile) {
      currentProfile = await createOrUpdateProfile(currentUser);
    }

    if (currentProfile) {
      console.log(`✅ Logged in as ${currentProfile.role}: ${currentProfile.email}`);
      return { loggedIn: true, role: currentProfile.role, profile: currentProfile };
    } else {
      console.warn('⚠️ Gagal memuat profile, masuk sebagai guest sementara.');
      return createGuestSession();
    }
  }
  return createGuestSession();
}

function createGuestSession() {
  const guestId = localStorage.getItem('ag_guest_id') || 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  localStorage.setItem('ag_guest_id', guestId);
  return { loggedIn: false, role: 'guest', guestId };
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle(); // 🛡️ Lebih aman daripada .single()
  
  if (error) {
    console.error('Error fetch profile:', error);
    return null;
  }
  return data;
}

// 🛡️ FUNGSI BARU: Menggunakan upsert untuk menghindari error 409 Conflict
async function createOrUpdateProfile(user) {
  try {
    const fullName = user.user_metadata?.full_name || 'User';
    const role = user.user_metadata?.role || 'member';
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { 
          id: user.id, 
          email: user.email, 
          full_name: fullName, 
          role: role 
        }, 
        { onConflict: 'id' } // Jika id sudah ada, update saja, jangan insert baru
      )
      .select()
      .maybeSingle();
    
    if (error) {
      console.error('Error upsert profile:', error);
      // Jika tetap gagal, coba fetch sekali lagi sebagai last resort
      return await fetchProfile(user.id);
    }
    
    console.log('✅ Profile berhasil dimuat/dibuat:', data);
    return data;
  } catch (error) {
    console.error('Create/Update profile error:', error);
    return null;
  }
}

export async function registerMember(email, password, fullName, phone = '') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'member' } }
    });
    if (error) throw error;
    return { success: true, message: 'Registrasi berhasil! Silakan login.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Di fungsi login() di auth.js, setelah login sukses:
export async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    currentUser = data.user;
    currentProfile = await fetchProfile(currentUser.id);
    
    if (!currentProfile) {
      currentProfile = await createOrUpdateProfile(currentUser);
    }
    
    if (!currentProfile) throw new Error('Gagal memuat profile. Hubungi admin.');
    
    localStorage.setItem('ag_user_role', currentProfile.role);
    localStorage.setItem('ag_user_name', currentProfile.full_name);
    
    // ✅ PENTING: JANGAN migrasi data guest ke member!
    // Data guest dan member harus terpisah sepenuhnya.
    // Guest data tetap di localStorage, member data di database.
    
    return { 
      success: true, 
      role: currentProfile.role, 
      profile: currentProfile,
      message: `Selamat datang, ${currentProfile.full_name}!`
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// LOGOUT
// ============================================
export async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  localStorage.removeItem('ag_user_role');
  localStorage.removeItem('ag_user_name');
}

// ✅ TAMBAHKAN FUNGSI INI ↓↓↓

// ============================================
// REFRESH PROFILE (Fetch ulang dari database)
// ============================================
export async function refreshProfile() {
  if (!currentUser) return null;
  
  currentProfile = await fetchProfile(currentUser.id);
  
  if (currentProfile) {
    // Update juga localStorage agar konsisten
    localStorage.setItem('ag_user_role', currentProfile.role);
    localStorage.setItem('ag_user_name', currentProfile.full_name);
    console.log('🔄 Profile refreshed:', currentProfile);
  }
  
  return currentProfile;
}

// ============================================
// UPDATE PASSWORD
// ============================================
export async function updatePassword(currentPassword, newPassword) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User tidak ditemukan');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInError) {
      return { success: false, error: 'Password lama tidak sesuai' };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: error.message };
  }
}

export function getGuestId() { return localStorage.getItem('ag_guest_id') || null; }
export function getGuestCart() { return JSON.parse(localStorage.getItem('ag_guest_cart') || '[]'); }
export function saveGuestCart(cart) { localStorage.setItem('ag_guest_cart', JSON.stringify(cart)); }
export function getGuestFavorites() { return JSON.parse(localStorage.getItem('ag_guest_favorites') || '[]'); }
export function saveGuestFavorites(favs) { localStorage.setItem('ag_guest_favorites', JSON.stringify(favs)); }

export function getCurrentProfile() { return currentProfile; }
export function isAdmin() { return currentProfile?.role === 'admin'; }
export function isMember() { return currentProfile?.role === 'member'; }
export function isGuest() { return !currentProfile; }
// ============================================
// GETTERS
// ============================================
export function getCurrentUser() {
  return currentUser;
}

export function getCurrentRole() {
  if (currentProfile) return currentProfile.role;
  return 'guest';
}