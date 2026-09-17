// ============================================
// UI HELPERS - Reusable Components
// ============================================

export function showNotification(message, type = 'info', duration = 4000) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-5 right-5 z-[110] space-y-2 pointer-events-none max-w-sm';
    document.body.appendChild(container);
  }
  
  const config = {
    success: { bg: 'bg-green-500/15', border: 'border-green-500/40', icon: 'fa-solid fa-circle-check text-green-400', title: 'Berhasil' },
    error: { bg: 'bg-red-500/15', border: 'border-red-500/40', icon: 'fa-solid fa-circle-xmark text-red-400', title: 'Gagal' },
    warning: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', icon: 'fa-solid fa-triangle-exclamation text-yellow-400', title: 'Peringatan' },
    info: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', icon: 'fa-solid fa-circle-info text-blue-400', title: 'Informasi' }
  }[type] || { bg: 'bg-blue-500/15', border: 'border-blue-500/40', icon: 'fa-solid fa-circle-info text-blue-400', title: 'Informasi' };
  
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto ${config.bg} backdrop-blur-md border ${config.border} rounded-2xl p-4 shadow-2xl flex items-start gap-3`;
  toast.style.animation = 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  toast.innerHTML = `
    <div class="flex-shrink-0 mt-0.5"><i class="${config.icon} text-lg"></i></div>
    <div class="flex-1 min-w-0">
      <p class="font-bold text-sm text-white">${config.title}</p>
      <p class="text-xs text-gray-300 mt-0.5 leading-relaxed">${message}</p>
    </div>
    <button class="flex-shrink-0 text-gray-400 hover:text-white transition">
      <i class="fa-solid fa-xmark text-sm"></i>
    </button>
  `;
  container.appendChild(toast);
  
  const remove = () => {
    toast.style.animation = 'slide-out-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => toast.remove(), 300);
  };
  
  toast.querySelector('button').onclick = remove;
  setTimeout(remove, duration);
}

export function showConfirmPopup(options) {
  let popup = document.getElementById('confirm-popup');
  if (!popup) {
    popup = document.createElement('div'); // ✅ TYPO FIXED!
    popup.id = 'confirm-popup';
    popup.className = 'hidden fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4';
    popup.innerHTML = `
      <div class="bg-dark-card w-full max-w-sm rounded-3xl border border-dark-accent overflow-hidden shadow-2xl">
        <div class="pt-8 pb-4 text-center">
          <div id="confirm-icon-wrapper" class="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
            <i id="confirm-icon" class="text-2xl"></i>
          </div>
          <h3 id="confirm-title" class="text-lg font-bold text-white">Konfirmasi</h3>
          <p id="confirm-message" class="text-xs text-gray-400 mt-2 px-6 leading-relaxed"></p>
        </div>
        <div id="confirm-info-box" class="hidden mx-5 mb-4 bg-dark-bg/60 rounded-2xl p-3 border border-dark-accent flex items-start gap-3">
          <i class="fa-solid fa-circle-info text-primary mt-0.5"></i>
          <div id="confirm-info-text" class="text-[11px] text-gray-300 leading-relaxed"></div>
        </div>
        <div class="p-5 pt-2 grid grid-cols-2 gap-3">
          <button id="confirm-cancel-btn" class="bg-dark-bg hover:bg-dark-accent border border-dark-accent text-gray-200 font-bold py-3 rounded-xl transition text-sm">
            <i class="fa-solid fa-xmark mr-1"></i> Batal
          </button>
          <button id="confirm-ok-btn" class="font-bold py-3 rounded-xl transition text-sm shadow-lg">
            <i id="confirm-ok-icon" class="mr-1"></i>
            <span id="confirm-ok-text">Ya</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
  }
  
  const typeConfig = {
    danger: { wrapper: 'bg-red-500/15 border-2 border-red-500/30', icon: 'fa-solid fa-triangle-exclamation text-red-400', btn: 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20', okIcon: 'fa-solid fa-trash' },
    warning: { wrapper: 'bg-yellow-500/15 border-2 border-yellow-500/30', icon: 'fa-solid fa-eye-slash text-yellow-400', btn: 'bg-yellow-500 hover:bg-yellow-600 text-dark-bg shadow-yellow-500/20', okIcon: 'fa-solid fa-check' },
    info: { wrapper: 'bg-blue-500/15 border-2 border-blue-500/30', icon: 'fa-solid fa-circle-info text-blue-400', btn: 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20', okIcon: 'fa-solid fa-check' },
    success: { wrapper: 'bg-green-500/15 border-2 border-green-500/30', icon: 'fa-solid fa-circle-check text-green-400', btn: 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20', okIcon: 'fa-solid fa-check' }
  };
  
  const config = typeConfig[options.type] || typeConfig.info;
  
  document.getElementById('confirm-icon-wrapper').className = `w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${config.wrapper}`;
  document.getElementById('confirm-icon').className = `${config.icon} text-2xl ${options.icon || ''}`;
  document.getElementById('confirm-title').textContent = options.title || 'Konfirmasi';
  document.getElementById('confirm-message').textContent = options.message || '';
  
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.className = `font-bold py-3 rounded-xl transition text-sm shadow-lg ${config.btn}`;
  document.getElementById('confirm-ok-icon').className = config.okIcon;
  document.getElementById('confirm-ok-text').textContent = options.confirmText || 'Ya';
  document.getElementById('confirm-cancel-btn').innerHTML = `<i class="fa-solid fa-xmark mr-1"></i> ${options.cancelText || 'Batal'}`;
  
  const infoBox = document.getElementById('confirm-info-box');
  if (options.infoText) {
    infoBox.classList.remove('hidden');
    document.getElementById('confirm-info-text').innerHTML = options.infoText;
  } else {
    infoBox.classList.add('hidden');
  }
  
  popup.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  const cleanup = () => {
    popup.classList.add('hidden');
    document.body.style.overflow = '';
    okBtn.onclick = null;
    document.getElementById('confirm-cancel-btn').onclick = null;
    popup.onmousedown = null;
  };
  
  okBtn.onclick = () => { cleanup(); if (options.onConfirm) options.onConfirm(); };
  document.getElementById('confirm-cancel-btn').onclick = cleanup;
  popup.onmousedown = (e) => { if (e.target === popup) cleanup(); };
  
  const escHandler = (e) => {
    if (e.key === 'Escape' && !popup.classList.contains('hidden')) {
      cleanup();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Setup modal close yang anti-drag bug
 */
export function setupModalClose(modalId, closeCallback) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.warn(`Modal ${modalId} tidak ditemukan`);
    return;
  }
  
  // Hapus semua event listener lama
  if (modal._closeHandler) {
    modal.removeEventListener('mousedown', modal._closeHandler);
    modal.removeEventListener('click', modal._closeHandler);
  }
  
  // Handler baru dengan mousedown
  const closeHandler = (e) => {
    if (e.target === modal) {
      e.preventDefault();
      e.stopPropagation();
      closeCallback();
    }
  };
  
  modal.addEventListener('mousedown', closeHandler);
  modal._closeHandler = closeHandler;
  
  // Stop propagation di content modal
  const content = modal.firstElementChild;
  if (content && !content._stopPropSet) {
    content.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    }, true);
    content._stopPropSet = true;
  }
  
  // ESC key close
  if (!window._modalEscHandlers) window._modalEscHandlers = {};
  if (window._modalEscHandlers[modalId]) {
    document.removeEventListener('keydown', window._modalEscHandlers[modalId]);
  }
  
  const escHandler = (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCallback();
    }
  };
  document.addEventListener('keydown', escHandler);
  window._modalEscHandlers[modalId] = escHandler;
}