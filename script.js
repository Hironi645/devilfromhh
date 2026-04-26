// ===== DEVIL REIGN — v11.0 =====
// Website by Hironi | Firebase Edition v11.0
// Upgraded: 8 Maintenance Templates, Media Popup (Owner Only), Tutorial Bug Fix v11.0

// ===== FIREBASE CONFIG =====
const FIREBASE_URL = 'https://from-9bd21-default-rtdb.asia-southeast1.firebasedatabase.app';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyngWDrUvB7pMwISgbeg2c-RYT-sZVmyoKjjYva2f9DF_eshS1cztyzo80FJm1Y-p6dVQ/exec';

// ===== STATE =====
let locationMode = 'manual';
let forceLocationMode = 'both'; // diset dari admin setting
let isLocating = false;
let currentTutorialStep = 0;
let tutorialShown = localStorage.getItem('devilReign_tutorialShown') === 'true';
let isTutorialActive = false;
let typingInterval = null;
let isTyping = false;
let currentSlide = 0;
let slideTimer = null;
let progressEl = null;
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN_MS = 60000; // 60 detik rate limit

// ===== LIVE DATA =====
let adminList = []; // Legacy flat list (backward compat)
let adminGroups = { grup1: [], grup2: [] }; // v12.0: grouped admins
let bannerImages = [];
let siteSettings = {};
let socialLinks = []; // v12.0: multi social links
let grupWALink = 'https://chat.whatsapp.com/HpKRS941FJ3KJQMHXSTeEK?mode=gi_'; // Default grup link

// v12.0: Selection state
let selectedGrup = null;   // 'grup1' | 'grup2'
let selectedAdmin = null;  // { nomor, nama, label, ... }

const adminThemes = {
  red:    { primary: '#C1121F', secondary: '#7B0010', glow: 'rgba(193,18,31,0.4)' },
  blue:   { primary: '#007AFF', secondary: '#0051D5', glow: 'rgba(0,122,255,0.4)' },
  purple: { primary: '#BF5AF2', secondary: '#8E3DB8', glow: 'rgba(191,90,242,0.4)' },
  green:  { primary: '#2ECC71', secondary: '#248A3D', glow: 'rgba(46,204,113,0.4)' },
  orange: { primary: '#FF9F0A', secondary: '#C77700', glow: 'rgba(255,159,10,0.4)' },
  pink:   { primary: '#FF2D55', secondary: '#C41E42', glow: 'rgba(255,45,85,0.4)' },
  cyan:   { primary: '#5AC8FA', secondary: '#2A9BC4', glow: 'rgba(90,200,250,0.4)' }
};

// ===== TUTORIAL STEPS =====
const tutorialStepsData = [
  { step: 1, targetId: 'namaGroup',   title: 'Nama Lengkap',       message: 'Ketik nama lengkap Anda di sini. Gunakan nama asli untuk verifikasi data.',                   placeholder: 'Contoh: Budi Santoso' },
  { step: 2, targetId: 'umurGroup',   title: 'Umur',               message: 'Masukkan umur Anda. Minimal 10 tahun untuk bergabung dengan komunitas.',                      placeholder: 'Contoh: 20' },
  { step: 3, targetId: 'usnGroup',    title: 'USN Hotel Hideaway', message: 'Masukkan username game Anda untuk identifikasi dalam komunitas.',                              placeholder: 'Contoh: Player123' },
  { step: 4, targetId: 'kotaGroup',   title: 'Asal Kota',          message: 'Pilih "Manual" untuk ketik sendiri, atau "Auto Detect" untuk deteksi GPS otomatis.',          placeholder: 'Contoh: Jakarta' },
  { step: 5, targetId: 'alasanGroup', title: 'Alasan Bergabung',   message: 'Ceritakan mengapa Anda ingin bergabung dengan DEVIL REIGN (min. 20 karakter).',               placeholder: 'Saya ingin bergabung karena...' }
];

// ===== DOM REFS =====
const toast              = document.getElementById('toast');
const processing         = document.getElementById('processing');
const successModal       = document.getElementById('successModal');
const form               = document.getElementById('memberForm');
const btnManual          = document.getElementById('btnManual');
const btnAuto            = document.getElementById('btnAuto');
const asalKotaInput      = document.getElementById('asalKota');
const locatingIndicator  = document.getElementById('locatingIndicator');
const fabBtn             = document.getElementById('fabBtn');
const statusTime         = document.getElementById('statusTime');
const tutorialOverlay    = document.getElementById('tutorialOverlay');
const tutorialHand       = document.getElementById('tutorialHand');
const tutorialTooltip    = document.getElementById('tutorialTooltip');
const stepNumber         = document.getElementById('stepNumber');
const tooltipTitle       = document.getElementById('tooltipTitle');
const tooltipMessage     = document.getElementById('tooltipMessage');
const adPopupModal       = document.getElementById('adPopupModal');
const announcementBanner = document.getElementById('announcementBanner');
const formCard           = document.getElementById('formCard');
const alasanTextarea     = document.getElementById('alasan');
const charCountEl        = document.getElementById('charCount');
const charMinNote        = document.getElementById('charMinNote');

// ===== FIREBASE HELPERS =====
async function fbGet(path) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initDarkMode();
  updateClock();
  setInterval(updateClock, 1000);
  setupScrollListener();
  setupInputAnimations();
  setupCharCounter();
  setupFormProgress();
  setupReadingProgress();
  setupBlurValidation();
  setupDraftAutosave();
  setupShareButton();

  await loadFromFirebase();
  startRealtimeSync();

  setTimeout(() => {
    restoreDraft();
    if (!tutorialShown) {
      showToast('Selamat Datang di v11.0! 👋', 'Klik "Lihat Tutorial" untuk panduan pengisian form', 4000);
    } else {
      showToast('Selamat Datang Kembali!', 'Silakan lengkapi form pendaftaran member', 3000);
    }
  }, 1200);
});

// ===== LOAD DATA FROM FIREBASE =====
async function loadFromFirebase() {
  try {
    const [adminsRaw, bannersRaw, settings, announcement, popup, maintenance, membersRaw, adContent, mediaPopup] = await Promise.all([
      fbGet('admins'),
      fbGet('banners'),
      fbGet('settings'),
      fbGet('announcement'),
      fbGet('popup'),
      fbGet('maintenance'),
      fbGet('members'),
      fbGet('adContent'),
      fbGet('mediaPopup')
    ]);

    // v12.0: Load grouped admins
    if (adminsRaw && typeof adminsRaw === 'object') {
      // Support new grouped structure: { grup1: {id: adminObj}, grup2: {id: adminObj} }
      if (adminsRaw.grup1 || adminsRaw.grup2) {
        adminGroups.grup1 = adminsRaw.grup1 ? Object.values(adminsRaw.grup1).filter(a => a && a.active !== false) : [];
        adminGroups.grup2 = adminsRaw.grup2 ? Object.values(adminsRaw.grup2).filter(a => a && a.active !== false) : [];
        // Backward compat flat list
        adminList = [...adminGroups.grup1, ...adminGroups.grup2];
      } else {
        // Legacy flat structure
        adminList = Object.values(adminsRaw).filter(a => a && a.active !== false);
        // Split half-half into groups for legacy compat
        const mid = Math.ceil(adminList.length / 2);
        adminGroups.grup1 = adminList.slice(0, mid);
        adminGroups.grup2 = adminList.slice(mid);
      }
    }
    if (bannersRaw && typeof bannersRaw === 'object') {
      bannerImages = Object.values(bannersRaw)
        .filter(b => b && b.active !== false)
        .map(b => ({ src: b.src, caption: b.caption || '' }));
    }
    // v12.0: Social links
    const socialLinksRaw = await fbGet('socialLinks');
    if (socialLinksRaw && typeof socialLinksRaw === 'object') {
      socialLinks = Object.values(socialLinksRaw).filter(s => s && s.active !== false)
        .sort((a,b) => (a.order||99) - (b.order||99));
      renderSocialLinks(socialLinks);
    }

    if (settings) { siteSettings = settings; applySettings(settings); applyTheme(settings); applyMetaTags(settings); if (settings.grupWALink) grupWALink = settings.grupWALink; }
    if (announcement) applyAnnouncement(announcement);
    if (maintenance && maintenance.active) applyMaintenanceMode(maintenance);

    // BUG FIX: Cek apakah popup sudah ditampilkan hari ini sebelum jadwalkan
    if (popup && popup.active) {
      const shownKey = 'dr_popup_' + (popup.updatedAt || popup.title || 'default');
      if (!sessionStorage.getItem(shownKey)) {
        setTimeout(() => applyDashboardPopup(popup), (popup.delay || 3) * 1000);
      }
    }

    // v11.0: Media popup (gambar/video/gif)
    if (mediaPopup && mediaPopup.active && mediaPopup.url) {
      const mpKey = 'dr_mediapopup_' + (mediaPopup.uploadedAt || mediaPopup.url.slice(-20));
      if (!sessionStorage.getItem(mpKey)) {
        setTimeout(() => applyMediaPopup(mediaPopup), (mediaPopup.delay || 2) * 1000);
      }
    }

    // Member count badge
    if (membersRaw && typeof membersRaw === 'object') {
      updateMemberCount(Object.keys(membersRaw).length);
    }

    // v12.0: Render grup cards after data loaded
    renderGrupCards();

    generateAutoSlideBanner();
    setFirebaseStatusIndex(true);

    // Ad popup: load dynamic content from Firebase if available
    const adEnabled = adContent ? adContent.active !== false : (siteSettings.adPopup !== false);
    if (adEnabled) {
      const lastShown = localStorage.getItem('devilReign_adPopupShown');
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Cek _forceShow flag dari dashboard (tombol "Reset Tes")
      const forceShow = adContent && adContent._forceShow &&
        (!lastShown || adContent._forceShow > new Date(lastShown).getTime());

      const shouldShow = forceShow ||
        !lastShown ||
        (Date.now() - new Date(lastShown).getTime() > oneDayMs);

      if (shouldShow) {
        if (adContent && adContent.title) {
          buildDynamicAdPopup(adContent);
        }
        const delay = (adContent?.delay || 8) * 1000;
        setTimeout(showAdPopup, delay);
      }
    }
  } catch(e) {
    setFirebaseStatusIndex(false);
    console.warn('[DEVIL REIGN] Firebase load error, fallback ke default:', e);
    adminList = [
      { nomor: "6285751316809", nama: "Lyonar Nna", label: "Admin 1", theme: "red",    initial: "LN", active: true },
      { nomor: "6285824168807", nama: "ÐR SanRa",   label: "Admin 2", theme: "orange", initial: "DS", active: true },
      { nomor: "6281318685216", nama: "Lucanne",     label: "Admin 3", theme: "pink",   initial: "LC", active: true },
      { nomor: "6289504498328", nama: "vhany",       label: "Admin 4", theme: "cyan",   initial: "VH", active: true },
      { nomor: "6288991037227", nama: "dika",        label: "Admin 5", theme: "purple", initial: "RH", active: true }
    ];
    // v12.0: Setup fallback groups
    adminGroups.grup1 = adminList.slice(0, 3);
    adminGroups.grup2 = adminList.slice(3);
    renderGrupCards();
    bannerImages = [
      { src: 'IMG-20260204-WA0052.jpg', caption: '' },
      { src: 'IMG-20260211-WA0065.jpg', caption: '' },
      { src: 'IMG-20260211-WA0017.jpg', caption: '' },
      { src: 'IMG-20260131-WA0024.jpg', caption: '' },
      { src: 'IMG-20260213-WA0005.jpg', caption: '' },
      { src: 'IMG-20260213-WA0006.jpg', caption: '' },
      { src: 'IMG-20260211-WA0079.jpg', caption: '' },
      { src: 'IMG-20260211-WA0076.jpg', caption: '' }
    ];
    generateAutoSlideBanner();
    const lastShown = localStorage.getItem('devilReign_adPopupShown');
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (!lastShown || (Date.now() - new Date(lastShown).getTime() > oneDayMs)) {
      setTimeout(showAdPopup, 8000);
    }
  }
}

// ===== MEMBER COUNT =====
function updateMemberCount(count) {
  const badge = document.getElementById('memberCountBadge');
  const text  = document.getElementById('memberCountText');
  if (badge && text) {
    text.textContent = `${count} Anggota`;
    badge.style.display = 'inline-flex';
  }
}

// ===== APPLY SETTINGS =====
function applySettings(s) {
  // v11.0: countdown
  if (s.countdownDate) {
    setupCountdown(s.countdownDate);
  }
  if (formCard) {
    if (s.formActive === false) {
      formCard.innerHTML = `
        <div style="padding:40px 24px;text-align:center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(193,18,31,0.6)" stroke-width="1.5" style="margin-bottom:16px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <h3 style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:8px">Pendaftaran Ditutup</h3>
          <p style="color:rgba(240,240,245,0.55);font-size:13px">Rekrutmen saat ini sedang ditutup sementara. Pantau terus media sosial kami untuk info pembukaan selanjutnya.</p>
        </div>
      `;
    }
  }
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle && s.name) headerTitle.textContent = s.name;
  const headerSub = document.querySelector('.header-subtitle');
  if (headerSub && s.tagline) headerSub.textContent = s.tagline;
  if (s.discord) {
    const dl = document.querySelector('.social-discord');
    if (dl) dl.href = s.discord;
  }
  if (s.instagram) {
    const ig = document.querySelector('.social-instagram .social-link-desc');
    if (ig) ig.textContent = s.instagram;
  }
  // Apply location mode from admin setting
  const lm = s.locationMode || (s.gps === false ? 'manual' : 'both');
  forceLocationMode = lm;
  if (lm === 'auto') {
    if (btnManual) btnManual.style.display = 'none';
    if (btnAuto) btnAuto.style.display = 'none'; // sembunyikan kedua tombol
    if (asalKotaInput) { asalKotaInput.readOnly = true; asalKotaInput.style.cursor = 'not-allowed'; asalKotaInput.style.opacity = '0.7'; }
    setTimeout(() => setLocationMode('auto'), 300);
  } else if (lm === 'manual') {
    if (btnAuto) btnAuto.style.display = 'none';
    if (btnManual) { btnManual.style.display = ''; }
    setLocationMode('manual');
  } else {
    if (btnManual) btnManual.style.display = '';
    if (btnAuto) btnAuto.style.display = '';
    if (asalKotaInput) { asalKotaInput.readOnly = false; asalKotaInput.style.cursor = ''; asalKotaInput.style.opacity = ''; }
  }
  // Update hint text
  const hint = document.querySelector('#kotaGroup .input-hint');
  if (hint) {
    if (lm === 'auto') hint.innerHTML = hint.innerHTML.replace(/Pilih.*GPS otomatis/, 'Lokasi terdeteksi otomatis via GPS — tidak dapat diubah');
    else if (lm === 'manual') hint.innerHTML = hint.innerHTML.replace(/Pilih.*GPS otomatis/, 'Masukkan nama kota asal kamu');
  }
}

// ===== APPLY THEME =====
function applyTheme(s) {
  if (!s || !s.theme) return;
  
  const theme = s.theme;
  const accent = theme.accentColor || '#C1121F';
  const secondary = theme.secondaryColor || '#8B5CF6';
  
  // Update CSS variables
  const root = document.documentElement;
  root.style.setProperty('--blood', accent);
  root.style.setProperty('--blood-bright', accent);
  root.style.setProperty('--purple', secondary);
  
  // Update blob colors
  const blobs = document.querySelectorAll('.blob');
  blobs.forEach((blob, i) => {
    const colors = [accent, secondary, accent, secondary];
    blob.style.background = `radial-gradient(circle, ${colors[i]} 0%, transparent 70%)`;
  });
  
  // Update header gradient
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.style.background = `linear-gradient(135deg, #FFFFFF 0%, ${accent}40 40%, ${accent} 70%, ${secondary} 100%)`;
    headerTitle.style.webkitBackgroundClip = 'text';
    headerTitle.style.webkitTextFillColor = 'transparent';
    headerTitle.style.backgroundClip = 'text';
  }
  
  // Update button gradient
  const buttons = document.querySelectorAll('.ios-button');
  buttons.forEach(btn => {
    btn.style.background = `linear-gradient(135deg, ${accent} 0%, ${secondary} 50%, ${accent} 100%)`;
    btn.style.backgroundSize = '200% 100%';
  });
  
  // Update progress bar
  const progressFill = document.querySelector('.form-progress-fill');
  if (progressFill) {
    progressFill.style.background = `linear-gradient(90deg, ${accent}, ${secondary})`;
  }
  
  // Update reading progress
  const readingProgress = document.querySelector('.reading-progress');
  if (readingProgress) {
    readingProgress.style.background = `linear-gradient(90deg, ${accent}, ${secondary})`;
  }
  
  // Update logo glow
  const logoGlow = document.querySelector('.header-glow');
  if (logoGlow) {
    logoGlow.style.background = `radial-gradient(circle, ${accent}50 0%, ${secondary}30 40%, transparent 70%)`;
  }
  
  // Update version badge
  const versionBadge = document.querySelector('.version-badge');
  if (versionBadge) {
    versionBadge.style.background = `linear-gradient(135deg, ${accent}40, ${secondary}20)`;
    versionBadge.style.borderColor = `${accent}60`;
  }
}

// ===== APPLY META TAGS (Open Graph) — v11.0 =====
function applyMetaTags(s) {
  if (!s) return;
  
  const metaTitle = s.metaTitle || 'DEVIL REIGN v11.0 | Form Pendaftaran Member';
  const metaDescription = s.metaDescription || 'Bergabunglah dengan DEVIL REIGN v11.0 - Komunitas eksklusif Hotel Hideaway. Daftar sekarang dan jadilah bagian dari kekuasaan!';
  const metaImage = s.metaImage || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&h=630&fit=crop';
  const metaUrl = s.metaUrl || 'https://devilreign.com';
  const siteName = s.metaSiteName || 'DEVIL REIGN';
  
  // Update document title
  const titleEl = document.getElementById('metaTitle');
  if (titleEl) titleEl.textContent = metaTitle;
  document.title = metaTitle;
  
  // Update meta name="title"
  const nameTitleEl = document.getElementById('metaNameTitle');
  if (nameTitleEl) nameTitleEl.setAttribute('content', metaTitle);
  
  // Update meta description
  const descEl = document.getElementById('metaDescription');
  if (descEl) descEl.setAttribute('content', metaDescription);

  // Update/create keywords meta tag
  let kwEl = document.querySelector('meta[name="keywords"]');
  if (!kwEl) { kwEl = document.createElement('meta'); kwEl.name = 'keywords'; document.head.appendChild(kwEl); }
  if (s.metaKeywords) kwEl.setAttribute('content', s.metaKeywords);

  // Update/create author meta tag
  let authEl = document.querySelector('meta[name="author"]');
  if (!authEl) { authEl = document.createElement('meta'); authEl.name = 'author'; document.head.appendChild(authEl); }
  if (s.metaAuthor) authEl.setAttribute('content', s.metaAuthor);

  // Update/create robots meta tag
  let robEl = document.querySelector('meta[name="robots"]');
  if (!robEl) { robEl = document.createElement('meta'); robEl.name = 'robots'; document.head.appendChild(robEl); }
  robEl.setAttribute('content', s.metaRobots || 'index, follow');

  // Update/create canonical link tag
  let canEl = document.querySelector('link[rel="canonical"]');
  if (!canEl) { canEl = document.createElement('link'); canEl.rel = 'canonical'; document.head.appendChild(canEl); }
  canEl.href = metaUrl;
  
  // Update Open Graph meta tags
  const ogUrl = document.getElementById('metaOgUrl');
  if (ogUrl) ogUrl.setAttribute('content', metaUrl);
  
  const ogTitle = document.getElementById('metaOgTitle');
  if (ogTitle) ogTitle.setAttribute('content', metaTitle);
  
  const ogDesc = document.getElementById('metaOgDescription');
  if (ogDesc) ogDesc.setAttribute('content', metaDescription);
  
  const ogImage = document.getElementById('metaOgImage');
  if (ogImage) ogImage.setAttribute('content', metaImage);
  
  const ogSiteName = document.getElementById('metaOgSiteName');
  if (ogSiteName) ogSiteName.setAttribute('content', siteName);
  
  // Update Twitter / X meta tags
  const twUrl = document.getElementById('metaTwitterUrl');
  if (twUrl) twUrl.setAttribute('content', metaUrl);
  
  const twTitle = document.getElementById('metaTwitterTitle');
  if (twTitle) twTitle.setAttribute('content', metaTitle);
  
  const twDesc = document.getElementById('metaTwitterDescription');
  if (twDesc) twDesc.setAttribute('content', metaDescription);
  
  const twImage = document.getElementById('metaTwitterImage');
  if (twImage) twImage.setAttribute('content', metaImage);
}

// ===== APPLY ANNOUNCEMENT =====
function applyAnnouncement(ann) {
  if (!announcementBanner || !ann || !ann.active || !ann.title) {
    if (announcementBanner) announcementBanner.style.display = 'none';
    return;
  }
  const colorMap = {
    blood:   { bg: 'rgba(193,18,31,0.18)',  border: 'rgba(193,18,31,0.35)',   color: '#E63946' },
    warn:    { bg: 'rgba(255,159,10,0.15)', border: 'rgba(255,159,10,0.3)',   color: '#FF9F0A' },
    success: { bg: 'rgba(46,204,113,0.12)', border: 'rgba(46,204,113,0.25)', color: '#2ECC71' },
    info:    { bg: 'rgba(90,200,250,0.12)', border: 'rgba(90,200,250,0.25)', color: '#5AC8FA' }
  };
  const c = colorMap[ann.color] || colorMap.blood;
  announcementBanner.style.display = 'flex';
  announcementBanner.style.background = c.bg;
  announcementBanner.style.borderColor = c.border;
  announcementBanner.querySelector('.ann-title').textContent = ann.title;
  announcementBanner.querySelector('.ann-title').style.color = c.color;
  announcementBanner.querySelector('.ann-body').textContent = ann.body || '';
}

// ===== REAL-TIME SYNC =====
function startRealtimeSync() {
  setInterval(async () => {
    try {
      const [adminsRaw, bannersRaw, settings, announcement, popup, maintenance, membersRaw] = await Promise.all([
        fbGet('admins'), fbGet('banners'), fbGet('settings'), fbGet('announcement'),
        fbGet('popup'), fbGet('maintenance'), fbGet('members')
      ]);
      if (adminsRaw) {
        const newList = Object.values(adminsRaw).filter(a => a && a.active !== false);
        if (JSON.stringify(newList) !== JSON.stringify(adminList)) {
          adminList = newList;
          }
      }
      if (bannersRaw) {
        const newBanners = Object.values(bannersRaw)
          .filter(b => b && b.active !== false)
          .map(b => ({ src: b.src, caption: b.caption || '' }));
        if (JSON.stringify(newBanners) !== JSON.stringify(bannerImages)) {
          bannerImages = newBanners;
          generateAutoSlideBanner();
        }
      }
      if (settings) applySettings(settings);
      if (announcement) applyAnnouncement(announcement);
      if (maintenance) {
        const existingOverlay = document.getElementById('maintenanceOverlay');
        if (maintenance.active && !existingOverlay) {
          applyMaintenanceMode(maintenance);
        } else if (!maintenance.active && existingOverlay) {
          existingOverlay.remove();
          document.body.style.overflow = '';
        }
      }
      if (popup && popup.active) {
        const shownKey = 'dr_popup_' + (popup.updatedAt || popup.title || 'default');
        if (!sessionStorage.getItem(shownKey)) {
          setTimeout(() => applyDashboardPopup(popup), (popup.delay || 0) * 1000);
        }
      }
      if (membersRaw && typeof membersRaw === 'object') {
        updateMemberCount(Object.keys(membersRaw).length);
      }
    } catch(e) { /* silent */ }
  }, 15000);
}

// ===== MAINTENANCE MODE =====
function applyMaintenanceMode(m) {
  if (!m || !m.active) {
    const existing = document.getElementById('maintenanceOverlay');
    if (existing) existing.remove();
    document.body.style.overflow = '';
    return;
  }
  let overlay = document.getElementById('maintenanceOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'maintenanceOverlay'; document.body.appendChild(overlay); }
  
  // Theme colors configuration
  const themeColors = {
    dark:  { bg:'linear-gradient(135deg,#07070A 0%,#0F0F14 100%)', accent:'#C1121F', text:'#F0F0F5' },
    blood: { bg:'linear-gradient(135deg,#0A0003 0%,#1A0008 100%)', accent:'#C1121F', text:'#F0F0F5' },
    blue:  { bg:'linear-gradient(135deg,#020815 0%,#041228 100%)', accent:'#3D8EFF', text:'#F0F0F5' },
    purple:{ bg:'linear-gradient(135deg,#0d001a 0%,#1a0033 100%)', accent:'#8B5CF6', text:'#F0F0F5' },
    green: { bg:'linear-gradient(135deg,#001a0d 0%,#00331a 100%)', accent:'#00CC7A', text:'#F0F0F5' },
    orange:{ bg:'linear-gradient(135deg,#150a00 0%,#2a1400 100%)', accent:'#F5A623', text:'#F0F0F5' },
    pink:  { bg:'linear-gradient(135deg,#1a000a 0%,#330014 100%)', accent:'#F43F7A', text:'#F0F0F5' },
    cyan:  { bg:'linear-gradient(135deg,#00151a 0%,#002a33 100%)', accent:'#06C5DF', text:'#F0F0F5' }
  };
  
  const tc = themeColors[m.theme || 'dark'] || themeColors.dark;
  const template = m.template || 'classic';
  const title = esc(m.title || 'Website Sedang Maintenance');
  const message = esc(m.message || 'Kami sedang melakukan pembaruan sistem. Harap tunggu sebentar.');
  const eta = m.eta ? esc(m.eta) : '';
  const contact = m.contact ? esc(m.contact) : '';
  
  // Template HTML generators
  const templates = {
    classic: `
      <div style="font-size:52px;margin-bottom:20px;animation:maintFloat 3s ease-in-out infinite">🔧</div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      <div style="width:100%;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-bottom:20px">
        <div style="height:100%;background:${tc.accent};border-radius:3px;animation:maintBarAnim 3s ease-in-out infinite"></div>
      </div>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;font-size:12px;color:rgba(240,240,245,0.6);margin-bottom:16px">⏱ Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:rgba(240,240,245,0.65)">${contact}</strong></div>` : ''}
    `,
    modern: `
      <div style="font-size:48px;margin-bottom:15px;animation:maintGearSpin 3s linear infinite">⚙️</div>
      <div style="display:flex;gap:6px;justify-content:center;margin-bottom:15px">
        <span style="width:10px;height:10px;background:${tc.accent};border-radius:50%;animation:maintDotBounce 0.6s ease infinite"></span>
        <span style="width:10px;height:10px;background:${tc.accent};border-radius:50%;animation:maintDotBounce 0.6s ease infinite 0.2s"></span>
        <span style="width:10px;height:10px;background:${tc.accent};border-radius:50%;animation:maintDotBounce 0.6s ease infinite 0.4s"></span>
      </div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;font-size:12px;color:rgba(240,240,245,0.6);margin-bottom:16px">⏱ Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:rgba(240,240,245,0.65)">${contact}</strong></div>` : ''}
    `,
    minimal: `
      <div style="width:60px;height:2px;background:${tc.text};margin:0 auto 25px"></div>
      <div style="width:24px;height:24px;border:3px solid ${tc.accent};border-radius:50%;margin:0 auto 25px;animation:maintCirclePulse 1.5s ease infinite"></div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;font-size:12px;color:rgba(240,240,245,0.6);margin-bottom:16px">⏱ Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:rgba(240,240,245,0.65)">${contact}</strong></div>` : ''}
    `,
    gaming: `
      <div style="font-size:14px;font-weight:800;color:${tc.accent};text-shadow:2px 0 #06C5DF,-2px 0 #F43F7A;animation:maintGlitch 0.3s ease infinite;margin-bottom:15px;text-transform:uppercase;letter-spacing:2px">${title}</div>
      <div style="width:60px;height:4px;background:linear-gradient(90deg,${tc.accent},#F43F7A);margin:0 auto 20px;border-radius:2px;animation:maintPulseWidth 1s ease infinite"></div>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;font-size:12px;color:rgba(240,240,245,0.6);margin-bottom:16px">⏱ Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:rgba(240,240,245,0.65)">${contact}</strong></div>` : ''}
    `,
    tech: `
      <div style="font-size:20px;font-weight:700;color:#00CC7A;margin-bottom:10px;font-family:'JetBrains Mono',monospace">&lt;/&gt;</div>
      <div style="font-size:10px;color:#00CC7A;opacity:0.6;letter-spacing:3px;margin-bottom:15px;font-family:'JetBrains Mono',monospace">10101010</div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(0,204,122,0.1);border:1px solid rgba(0,204,122,0.2);border-radius:20px;font-size:12px;color:#00CC7A;margin-bottom:16px;font-family:'JetBrains Mono',monospace">[ ESTIMASI: ${eta} ]</div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px;font-family:'JetBrains Mono',monospace'>&gt; Butuh bantuan? Hubungi: <strong style="color:#00CC7A">${contact}</strong></div>` : ''}
    `,
    cosmic: `
      <div style="font-size:14px;color:#FFD700;letter-spacing:6px;margin-bottom:15px;animation:maintTwinkle 1.5s ease infinite">✦ ✦ ✦</div>
      <div style="width:40px;height:40px;background:radial-gradient(circle at 30% 30%,#8B5CF6,#4a0080);border-radius:50%;margin:0 auto 20px;box-shadow:0 0 30px #8B5CF6;animation:maintPlanetFloat 4s ease-in-out infinite"></div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:20px;font-size:12px;color:#8B5CF6;margin-bottom:16px">🌙 Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:#8B5CF6">${contact}</strong></div>` : ''}
    `,
    neon: `
      <div style="width:60px;height:60px;border:3px solid #06C5DF;border-radius:50%;margin:0 auto 20px;box-shadow:0 0 20px #06C5DF,inset 0 0 20px rgba(6,197,223,0.2);animation:maintNeonPulse 1.5s ease infinite"></div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:900;color:#06C5DF;text-shadow:0 0 20px #06C5DF;letter-spacing:2px;line-height:1.2;margin-bottom:14px">${title}</h1>
      <div style="width:80px;height:2px;background:#06C5DF;box-shadow:0 0 10px #06C5DF;margin:0 auto 20px"></div>
      <p style="font-size:14px;color:rgba(6,197,223,0.7);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(6,197,223,0.08);border:1px solid rgba(6,197,223,0.3);border-radius:4px;font-size:12px;color:#06C5DF;margin-bottom:16px;font-family:'JetBrains Mono',monospace;text-shadow:0 0 8px #06C5DF">[ ETA: ${eta} ]</div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(6,197,223,0.5);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:#06C5DF;text-shadow:0 0 8px #06C5DF">${contact}</strong></div>` : ''}
    `,
    nature: `
      <div style="font-size:52px;margin-bottom:15px;animation:maintLeafSway 2s ease-in-out infinite">🌿</div>
      <h1 style="font-family:'Syne',sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;color:${tc.text};line-height:1.2;margin-bottom:14px">${title}</h1>
      <div style="width:80px;height:4px;background:linear-gradient(90deg,#2ecc71,#1abc9c);border-radius:6px;margin:0 auto 20px;animation:maintWavePulse 1.5s ease infinite"></div>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:24px">${message}</p>
      ${eta ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.25);border-radius:20px;font-size:12px;color:#2ecc71;margin-bottom:16px">🍃 Estimasi: <strong>${eta}</strong></div>` : ''}
      ${contact ? `<div style="font-size:12px;color:rgba(240,240,245,0.4);margin-top:8px">Butuh bantuan? Hubungi: <strong style="color:#2ecc71">${contact}</strong></div>` : ''}
    `
  };
  
  const templateHTML = templates[template] || templates.classic;
  
  overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:'DM Sans',sans-serif;`;
  overlay.innerHTML = `
    <style>
      @keyframes maintBarAnim{0%{width:20%}50%{width:85%}100%{width:35%}}
      @keyframes maintFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes maintGearSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes maintDotBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes maintCirclePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.5}}
      @keyframes maintGlitch{0%,100%{transform:translate(0)}25%{transform:translate(-1px,1px)}50%{transform:translate(1px,-1px)}75%{transform:translate(-1px,-1px)}}
      @keyframes maintPulseWidth{0%,100%{width:60px}50%{width:80px}}
      @keyframes maintTwinkle{0%,100%{opacity:1}50%{opacity:0.4}}
      @keyframes maintPlanetFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes maintNeonPulse{0%,100%{box-shadow:0 0 20px #06C5DF,inset 0 0 20px rgba(6,197,223,0.2)}50%{box-shadow:0 0 40px #06C5DF,inset 0 0 40px rgba(6,197,223,0.4)}}
      @keyframes maintLeafSway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
      @keyframes maintWavePulse{0%,100%{width:80px}50%{width:110px}}
    </style>
    <div style="text-align:center;padding:40px;max-width:480px;width:90%">
      ${templateHTML}
      <div style="margin-top:28px;font-size:10px;color:rgba(240,240,245,0.2);letter-spacing:2px">DEVIL REIGN v11.0 © ${new Date().getFullYear()}</div>
    </div>
  `;
  document.body.style.overflow = 'hidden';
}

// ===== DASHBOARD POPUP =====
function applyDashboardPopup(p) {
  if (!p || !p.active || !p.title) return;
  const shownKey = 'dr_popup_' + (p.updatedAt || '');
  if (sessionStorage.getItem(shownKey)) return;
  const COLORS = {
    info:    { bg:'rgba(90,200,250,0.12)',  border:'rgba(90,200,250,0.3)',   color:'#5AC8FA',  icon:'ℹ️' },
    success: { bg:'rgba(46,204,113,0.1)',   border:'rgba(46,204,113,0.25)', color:'#2ECC71',  icon:'✅' },
    warn:    { bg:'rgba(255,159,10,0.12)',  border:'rgba(255,159,10,0.3)',   color:'#FF9F0A',  icon:'⚠️' },
    error:   { bg:'rgba(255,45,85,0.12)',   border:'rgba(255,45,85,0.28)',  color:'#FF2D55',  icon:'🚨' },
    promo:   { bg:'rgba(191,90,242,0.12)',  border:'rgba(191,90,242,0.28)', color:'#BF5AF2',  icon:'🎉' }
  };
  const c = COLORS[p.type] || COLORS.info;
  const overlay = document.createElement('div');
  overlay.id = 'dashboardPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  const closePopup = () => { overlay.remove(); document.body.style.overflow = ''; };
  overlay.innerHTML = `
    <style>@keyframes popupIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
    <div style="background:rgba(15,15,20,0.98);border:1px solid ${c.border};border-radius:20px;padding:28px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 40px 80px rgba(0,0,0,0.7);position:relative;animation:popupIn .35s cubic-bezier(0.16,1,0.3,1)">
      <button id="dpClose" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(240,240,245,0.5);width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
      <div style="font-size:36px;margin-bottom:14px">${c.icon}</div>
      <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:${c.color};margin-bottom:10px;line-height:1.3">${esc(p.title)}</div>
      ${p.body ? `<p style="font-size:13px;color:rgba(240,240,245,0.65);line-height:1.65;margin-bottom:20px">${esc(p.body)}</p>` : '<div style="margin-bottom:20px"></div>'}
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="dpClose2" style="flex:1;padding:11px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(240,240,245,0.7);border-radius:10px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif">Tutup</button>
        ${p.btnUrl ? `<a href="${esc(p.btnUrl)}" target="_blank" id="dpAction" style="flex:1;padding:11px;background:${c.color};color:${p.type==='warn'?'#07070A':'white'};border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif">${esc(p.btnLabel||'OK')}</a>` : `<button id="dpAction" style="flex:1;padding:11px;background:${c.color};color:${p.type==='warn'?'#07070A':'white'};border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">${esc(p.btnLabel||'OK')}</button>`}
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
  document.body.appendChild(overlay);
  document.getElementById('dpClose').addEventListener('click', closePopup);
  document.getElementById('dpClose2').addEventListener('click', closePopup);
  const dpAction = document.getElementById('dpAction');
  if (dpAction && !p.btnUrl) dpAction.addEventListener('click', closePopup);
  document.body.style.overflow = 'hidden';
  sessionStorage.setItem(shownKey, '1');
  if (navigator.vibrate) navigator.vibrate(15);
}

function esc(s) { if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== AD POPUP =====
function showAdPopup() {
  if (adPopupModal) {
    adPopupModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (navigator.vibrate) navigator.vibrate(20);
  }
}
function closeAdPopup() {
  if (adPopupModal) {
    adPopupModal.classList.remove('show');
    document.body.style.overflow = '';
    localStorage.setItem('devilReign_adPopupShown', new Date().toISOString());
  }
}

// Build ad popup content dynamically from Firebase adContent
function buildDynamicAdPopup(ad) {
  if (!adPopupModal || !ad) return;

  // Firebase stores arrays as objects {"0":{...},"1":{...}} — convert back
  const packages = ad.packages
    ? (Array.isArray(ad.packages) ? ad.packages : Object.values(ad.packages))
    : [];

  const COLORS = { biasa:'#3D8EFF', populer:'#FFD700', legend:'#8B5CF6', donatur:'#00CC7A' };

  const ICONS = {
    biasa:   '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    populer: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    legend:  '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    donatur: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
  };

  const pkgsHtml = packages.map(p => {
    const style = p.style || 'biasa';
    const color = COLORS[style] || '#C1121F';
    const icon  = ICONS[style]  || ICONS.biasa;
    const feats = (p.features || [])
      .map(f => `<span class="package-feature">${esc(f)}</span>`).join('');
    const badgeHtml = p.badge
      ? (style === 'populer'
          ? `<div class="package-badge-popular">${esc(p.badge)}</div>`
          : `<div class="package-badge-sultan">${esc(p.badge)}</div>`)
      : '';
    return `
      <div class="package-card package-${esc(style)}">
        ${badgeHtml}
        <div class="package-header">
          <div class="package-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${icon}</svg>
          </div>
          <div class="package-info">
            <span class="package-name">${esc(p.name)}</span>
            <span class="package-price" style="color:${color}">${esc(p.price)}</span>
          </div>
        </div>
        <div class="package-features">${feats}</div>
      </div>`;
  }).join('');

  const btnLink   = ad.btnLink   || 'https://wa.me/6285119654305';
  const btnText   = ad.btnText   || 'Pesan Sekarang';
  const btnSec    = ad.btnSecondary || 'Nanti Saja';
  const badge     = ad.badge     || 'JASA WEBSITE';
  const title     = ad.title     || 'Pilih Paket Anda';
  const subtitle  = ad.subtitle  || 'by HIRONI';

  // Fully rebuild the inner content — avoids all querySelector / textContent / SVG bugs
  const WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  const contentEl = adPopupModal.querySelector('.ad-popup-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <button class="ad-popup-close" onclick="closeAdPopup()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
    <div class="ad-popup-header">
      <div class="ad-popup-badge">${esc(badge)}</div>
      <h3 class="ad-popup-title">${esc(title)}</h3>
      <p class="ad-popup-subtitle">${esc(subtitle)}</p>
    </div>
    <div class="ad-popup-body">
      <div class="pricing-packages">${pkgsHtml}</div>
    </div>
    <div class="ad-popup-footer">
      <a href="${esc(btnLink)}" target="_blank" class="ad-popup-btn">
        ${WA_SVG} ${esc(btnText)}
      </a>
      <button class="ad-popup-btn-secondary" onclick="closeAdPopup()">${esc(btnSec)}</button>
    </div>`;
}

// ===== ADMIN CARDS =====
// ===== v12.0: GRUP SELECTION RENDER =====
function renderGrupCards() {
  const container = document.getElementById('grupCards');
  if (!container) return;
  const grupNames = {
    grup1: { label: 'REIGN', desc: 'Tim Utama' },
    grup2: { label: 'ΡÈñÈ†RÄ†È', desc: 'Tim Pendukung' }
  };
  const availableGrups = Object.keys(adminGroups).filter(k => adminGroups[k].length > 0);
  if (!availableGrups.length) {
    container.innerHTML = '<p style="color:rgba(240,240,245,0.45);font-size:12px;text-align:center;padding:16px">Tidak ada grup tersedia</p>';
    return;
  }
  container.innerHTML = availableGrups.map(grupKey => {
    const info = grupNames[grupKey] || { label: grupKey, desc: '' };
    const count = adminGroups[grupKey].length;
    return `
    <div class="grup-card" data-grup="${grupKey}" onclick="selectGrup('${grupKey}')">
      <div class="grup-card-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="grup-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="grup-card-name">${info.label}</div>
      <div class="grup-card-count">${count} Admin aktif</div>
    </div>`;
  }).join('');
}

function selectGrup(grupKey) {
  if (navigator.vibrate) navigator.vibrate(10);
  selectedGrup = grupKey;
  selectedAdmin = null;
  document.querySelectorAll('.grup-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.grup === grupKey);
  });
  const grupErr = document.getElementById('grupError');
  if (grupErr) { grupErr.textContent = ''; grupErr.style.display = 'none'; }
  const adminGroup = document.getElementById('adminSelectionGroup');
  if (adminGroup) {
    adminGroup.style.display = 'block';
    renderAdminGrid(grupKey);
    setTimeout(() => adminGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
  const lbl = document.getElementById('selectedGrupLabel');
  const grupLabel = { grup1: 'Grup 1', grup2: 'Grup 2' };
  if (lbl) lbl.textContent = grupLabel[grupKey] || grupKey;
  updateFormProgress();
}

function renderAdminGrid(grupKey) {
  const container = document.getElementById('adminGrid');
  if (!container) return;
  const admins = adminGroups[grupKey] || [];
  if (!admins.length) {
    container.innerHTML = '<p style="color:rgba(240,240,245,0.45);font-size:12px;text-align:center;padding:16px">Tidak ada admin aktif di grup ini</p>';
    return;
  }
  container.innerHTML = admins.map((admin, i) => {
    const initial = admin.initial || (admin.nama ? admin.nama.substring(0,2).toUpperCase() : 'AD');
    const label = admin.label || `Admin ${i+1}`;
    const nomor = (admin.nomor || '').replace(/[^0-9]/g,'');
    return `
    <div class="admin-card-v2" data-nomor="${nomor}" onclick="selectAdminById('${nomor}')">
      <div class="admin-avatar-v2">${initial}</div>
      <div class="admin-info-v2">
        <div class="admin-name-v2">${admin.nama}</div>
        <div class="admin-label-v2">${label}</div>
      </div>
      <div class="admin-status-v2"></div>
    </div>`;
  }).join('');
}

function selectAdminById(nomor) {
  if (!selectedGrup) return;
  const admin = (adminGroups[selectedGrup] || []).find(a => (a.nomor||'').replace(/[^0-9]/g,'') === nomor);
  if (!admin) return;
  if (navigator.vibrate) navigator.vibrate(10);
  selectedAdmin = admin;
  document.querySelectorAll('.admin-card-v2').forEach(c => {
    c.classList.toggle('selected', c.dataset.nomor === nomor);
  });
  const adminErr = document.getElementById('adminError');
  if (adminErr) { adminErr.textContent = ''; adminErr.style.display = 'none'; }
  updateFormProgress();
}

function generateAdminCards() { renderGrupCards(); }

// ===== v12.0: SOCIAL LINKS RENDER =====
const SOCIAL_ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.21 8.21 0 0 0 4.79 1.52V6.77a4.85 4.85 0 0 1-1.02-.08z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
};
const SOCIAL_COLORS = {
  whatsapp: '#25D366', instagram: '#E1306C', discord: '#5865F2',
  youtube: '#FF0000', tiktok: '#010101', telegram: '#0088cc', twitter: '#1DA1F2'
};

function renderSocialLinks(links) {
  const container = document.getElementById('socialLinksContainer');
  if (!container || !links || !links.length) return;
  container.innerHTML = links.map(link => {
    const type = (link.type || 'whatsapp').toLowerCase();
    const icon = SOCIAL_ICONS[type] || SOCIAL_ICONS.whatsapp;
    const clr = SOCIAL_COLORS[type] || '#888';
    return `<a href="${link.url}" target="_blank" class="social-link social-${type}">
      <div class="social-link-icon" style="background:${clr}22;box-shadow:0 4px 14px ${clr}33">${icon}</div>
      <div class="social-link-info">
        <span class="social-link-name">${link.name}</span>
        <span class="social-link-desc">${link.desc || ''}</span>
      </div>
      <div class="social-link-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>
    </a>`;
  }).join('');
}

function generateAutoSlideBanner() {
  const bannerContainer = document.getElementById('movingBanner');
  if (!bannerContainer) return;
  if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  currentSlide = 0;
  bannerContainer.innerHTML = '';
  if (!bannerImages.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'slider-wrapper';
  const track = document.createElement('div');
  track.className = 'slider-track';
  track.id = 'sliderTrack';

  bannerImages.forEach((img, i) => {
    const slide = document.createElement('div');
    slide.className = 'slider-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `
      <img src="${img.src}" alt="Galeri ${i + 1}" loading="lazy">
      <div class="slide-overlay"></div>
    `;
    // Click to fullscreen
    slide.addEventListener('click', () => openGalleryFullscreen(img.src, i));
    track.appendChild(slide);
  });

  wrapper.appendChild(track);
  bannerContainer.appendChild(wrapper);

  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'slider-dots';
  dotsContainer.id = 'sliderDots';
  bannerImages.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.addEventListener('click', (e) => { e.stopPropagation(); goToSlideAuto(i, track); resetProgress(); });
    dotsContainer.appendChild(dot);
  });
  bannerContainer.appendChild(dotsContainer);

  const progress = document.createElement('div');
  progress.className = 'slider-progress';
  progress.id = 'sliderProgress';
  bannerContainer.appendChild(progress);
  progressEl = progress;

  // Touch swipe
  let touchStartX = 0;
  wrapper.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  wrapper.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) { goToSlideAuto(diff > 0 ? currentSlide + 1 : currentSlide - 1, track); resetProgress(); }
  }, { passive: true });

  startAutoPlay(track);
}

function goToSlideAuto(index, track) {
  const total = bannerImages.length;
  if (index < 0) currentSlide = total - 1;
  else if (index >= total) currentSlide = 0;
  else currentSlide = index;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.slider-slide').forEach((s, i) => s.classList.toggle('active', i === currentSlide));
  document.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function resetProgress() {
  if (progressEl) {
    progressEl.style.animation = 'none';
    progressEl.offsetHeight; // reflow
    progressEl.style.animation = 'slideProgress 5s linear infinite';
  }
}

function startAutoPlay(track) {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => { goToSlideAuto(currentSlide + 1, track); resetProgress(); }, 5000);
}

// ===== GALLERY FULLSCREEN =====
function openGalleryFullscreen(src, index) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;';
  overlay.innerHTML = `
    <div style="position:relative;max-width:100%;max-height:100%;display:flex;align-items:center;justify-content:center;">
      <img src="${src}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:12px;box-shadow:0 0 80px rgba(0,0,0,0.8);" alt="Galeri ${index+1}">
      <button style="position:fixed;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;width:40px;height:40px;border-radius:12px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);">✕</button>
    </div>`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ===== CHARACTER COUNTER =====
function setupCharCounter() {
  if (!alasanTextarea || !charCountEl) return;
  const MIN_CHARS = 20;
  alasanTextarea.addEventListener('input', () => {
    const len = alasanTextarea.value.length;
    charCountEl.textContent = len;
    charCountEl.style.color = len < MIN_CHARS ? 'rgba(255,159,10,0.9)' : len >= 450 ? '#FF2D55' : '#2ECC71';
    if (charMinNote) {
      charMinNote.style.display = len >= MIN_CHARS ? 'none' : '';
    }
    updateFormProgress();
  });
}

// ===== FORM PROGRESS BAR =====
function setupFormProgress() {
  const fields = ['nama', 'umur', 'nomorWA', 'usnHotel', 'asalKota', 'alasan'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateFormProgress);
  });

}

function updateFormProgress() {
  const checks = [
    document.getElementById('nama')?.value.trim().length >= 2,
    (() => { const v = parseInt(document.getElementById('umur')?.value); return !isNaN(v) && v >= 10 && v <= 80; })(),
    /^\d{4,13}$/.test(document.getElementById('nomorWA')?.value.trim()),
    document.getElementById('usnHotel')?.value.trim().length >= 2,
    document.getElementById('asalKota')?.value.trim().length >= 2,
    document.getElementById('alasan')?.value.trim().length >= 20,
    !!selectedGrup,
    !!selectedAdmin,
  ];
  const filled = checks.filter(Boolean).length;
  const total = checks.length;
  const pct = Math.round((filled / total) * 100);

  const fill = document.getElementById('formProgressFill');
  const pctEl = document.getElementById('formProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';

  // Update tutorial step checks in guide card
  const stepFields = ['nama', 'umur', 'usnHotel', 'asalKota', 'alasan'];
  stepFields.forEach((id, idx) => {
    const el = document.getElementById('scheck' + (idx + 1));
    if (el) {
      const done = checks[idx];
      el.textContent = done ? '✓' : '';
      el.style.color = '#2ECC71';
    }
  });
}

// ===== READING PROGRESS =====
function setupReadingProgress() {
  const bar = document.getElementById('readingProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ===== INLINE FIELD VALIDATION =====
function setFieldError(fieldId, errorId, msg) {
  const input = document.getElementById(fieldId);
  const errEl = document.getElementById(errorId);
  if (input) {
    if (msg) {
      input.classList.add('input-error');
      input.classList.remove('input-valid');
    } else {
      input.classList.remove('input-error');
      input.classList.add('input-valid');
    }
  }
  if (errEl) {
    errEl.textContent = msg || '';
    errEl.style.display = msg ? 'flex' : 'none';
  }
}

function clearAllErrors() {
  ['namaError','umurError','nomorWAError','usnError','kotaError','alasanError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
  ['nama','umur','nomorWA','usnHotel','asalKota','alasan'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('input-error', 'input-valid'); }
  });
}

// ===== TUTORIAL =====
function startInteractiveTutorial() {
  if (siteSettings.tutorial === false) return;
  isTutorialActive = true;
  currentTutorialStep = 0;
  tutorialOverlay.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => showTutorialStep(0), 500);
}

function showTutorialStep(stepIndex) {
  if (stepIndex >= tutorialStepsData.length) { endTutorial(); return; }
  currentTutorialStep = stepIndex;
  const step = tutorialStepsData[stepIndex];
  const targetElement = document.getElementById(step.targetId);
  if (!targetElement) { endTutorial(); return; }

  stopTypingSimulation();
  document.querySelectorAll('.tutorial-target').forEach(el => {
    el.classList.remove('highlighted');
    el.style.position = '';
    el.style.zIndex = '';
    // BUG FIX: Jangan clear nilai input yang sudah diisi user
    // Hanya clear jika nilai = placeholder dari simulasi
  });

  targetElement.classList.add('highlighted');
  if (window.getComputedStyle(targetElement).position === 'static') targetElement.style.position = 'relative';
  targetElement.style.zIndex = '9999';
  targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    const rect = targetElement.getBoundingClientRect();
    const tooltipW = 280, tooltipH = 160, margin = 20;
    tutorialHand.style.left = `${rect.left + rect.width / 2 - 40}px`;
    tutorialHand.style.top  = `${rect.top + rect.height / 2 - 40}px`;
    tutorialHand.classList.add('tapping');
    setTimeout(() => tutorialHand.classList.remove('tapping'), 400);

    let tooltipX = rect.left + rect.width / 2 - tooltipW / 2;
    let tooltipY = rect.bottom + margin;
    if (tooltipX + tooltipW > window.innerWidth - margin) tooltipX = window.innerWidth - tooltipW - margin;
    if (tooltipX < margin) tooltipX = margin;
    if (tooltipY + tooltipH > window.innerHeight - margin) tooltipY = rect.top - tooltipH - margin;

    tutorialTooltip.style.left = `${tooltipX}px`;
    tutorialTooltip.style.top  = `${tooltipY}px`;
    stepNumber.textContent     = step.step;
    tooltipTitle.textContent   = step.title;
    tooltipMessage.textContent = step.message;
    document.querySelectorAll('.step-dots .dot').forEach((dot, i) => dot.classList.toggle('active', i === stepIndex));
    tutorialTooltip.classList.add('show');
    updateTutorialGuideCard(stepIndex);

    // BUG FIX: Hanya simulasikan typing jika input masih kosong
    if (step.placeholder) {
      const inputEl = document.querySelector(`#${step.targetId} .ios-input, #${step.targetId} .ios-textarea`);
      if (inputEl && !inputEl.value.trim()) {
        simulateTyping(step.targetId, step.placeholder);
      }
    }
  }, 500);
}

function simulateTyping(targetId, text) {
  const input = document.querySelector(`#${targetId} .ios-input, #${targetId} .ios-textarea`);
  if (!input || !text) return;
  // BUG FIX v11.0: Jangan simulasi jika input sudah ada isi dari user
  if (input.value.trim()) return;
  if (typingInterval) { clearTimeout(typingInterval); typingInterval = null; }
  isTyping = false;

  // Gunakan placeholder animation, bukan mengubah value input
  const originalPlaceholder = input.placeholder;
  input.classList.add('typing-active');
  let charIndex = 0;
  isTyping = true;

  function typeNext() {
    if (!isTyping || charIndex >= text.length) {
      clearTimeout(typingInterval); typingInterval = null; isTyping = false;
      input.classList.remove('typing-active');
      // Kembalikan placeholder asli setelah 1.5 detik
      setTimeout(() => {
        if (!input.value.trim()) input.placeholder = originalPlaceholder;
      }, 1500);
      return;
    }
    // Tampilkan animasi di placeholder, bukan di value — tidak mengganggu user input
    input.placeholder = text.slice(0, ++charIndex) + '|';
    typingInterval = setTimeout(typeNext, Math.random() * 80 + 40);
  }
  setTimeout(typeNext, 400);
}

function stopTypingSimulation() {
  isTyping = false;
  if (typingInterval) { clearTimeout(typingInterval); typingInterval = null; }
  // BUG FIX v11.0: Bersihkan placeholder yang mengandung karakter '|' dari simulasi typing
  document.querySelectorAll('.typing-active').forEach(el => {
    el.classList.remove('typing-active');
    if (el.placeholder && el.placeholder.endsWith('|')) {
      el.placeholder = el.placeholder.slice(0, -1);
    }
  });
}

function nextTutorialStep() {
  stopTypingSimulation();
  const currentStep = tutorialStepsData[currentTutorialStep];
  if (currentStep) {
    const el = document.getElementById(currentStep.targetId);
    if (el) {
      el.classList.remove('highlighted');
      el.style.zIndex = '';
      el.style.position = '';
      // BUG FIX: Tidak clear nilai input user
      const inp = el.querySelector('.ios-input,.ios-textarea');
      // Jika input masih berisi teks simulasi (bukan input user), biarkan
    }
  }
  tutorialTooltip.classList.remove('show');
  setTimeout(() => showTutorialStep(currentTutorialStep + 1), 300);
}

function skipTutorial() {
  stopTypingSimulation();
  localStorage.setItem('devilReign_tutorialShown', 'true');
  tutorialShown = true;
  endTutorial();
}

function endTutorial() {
  isTutorialActive = false;
  stopTypingSimulation();
  document.querySelectorAll('.tutorial-target').forEach(el => {
    el.classList.remove('highlighted');
    el.style.zIndex = '';
    el.style.position = '';
    // BUG FIX v11.0: Restore placeholder yang mungkin diubah saat simulasi typing
    const inp = el.querySelector('.ios-input, .ios-textarea');
    if (inp && inp.placeholder && inp.placeholder.endsWith('|')) {
      inp.placeholder = inp.placeholder.slice(0, -1);
    }
  });
  tutorialTooltip.classList.remove('show');
  tutorialOverlay.classList.remove('active');
  localStorage.setItem('devilReign_tutorialShown', 'true');
  tutorialShown = true;
  showToast('Tutorial Selesai! 🎉', 'Silakan isi form dengan data Anda', 3000);
}

function updateTutorialGuideCard(activeStep) {
  document.querySelectorAll('.tutorial-step').forEach((s, i) => s.classList.toggle('active', i === activeStep));
}

function showTutorialAgain() {
  localStorage.removeItem('devilReign_tutorialShown');
  tutorialShown = false;
  startInteractiveTutorial();
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  if (statusTime) statusTime.textContent = `${h}:${m}`;
}

// ===== TOAST =====
let toastTimeout = null;
function showToast(title, message, duration = 3000) {
  const toastTitle   = toast.querySelector('.toast-title');
  const toastMessage = toast.querySelector('.toast-message');
  if (toastTitle)   toastTitle.textContent   = title;
  if (toastMessage) toastMessage.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  if (duration > 0) toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== MODAL =====
function showModal() {
  successModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  launchConfetti();
}
function closeModal() {
  successModal.classList.remove('show');
  document.body.style.overflow = '';
}

// ===== CONFETTI ANIMATION =====
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const modal = canvas.parentElement;
  canvas.width  = modal.offsetWidth;
  canvas.height = modal.offsetHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#C1121F','#E63946','#FF9F0A','#2ECC71','#5AC8FA','#BF5AF2','#FF2D55','#FFD700'];
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 50,
    r: 3 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    life: 1
  }));
  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.angle += p.spin; p.vy += 0.08;
      p.life -= 0.008;
      if (p.y > canvas.height + 20 || p.life <= 0) {
        p.y = -10; p.x = Math.random() * canvas.width;
        p.vy = 2 + Math.random() * 4; p.life = 1;
      }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 0.6);
      ctx.restore();
    });
    frame++;
    if (frame < 200) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

// ===== PROCESSING =====
function showProcessing() {
  processing.style.display = 'flex';
  processing.offsetHeight;
  processing.classList.add('show');
}
function hideProcessing() {
  processing.classList.remove('show');
  setTimeout(() => { processing.style.display = 'none'; }, 300);
}

// ===== LOCATION =====
function setLocationMode(mode) {
  locationMode = mode;
  if (mode === 'manual') {
    if (btnManual) btnManual.classList.add('active');
    if (btnAuto) btnAuto.classList.remove('active');
    asalKotaInput.placeholder = 'Masukkan asal kota';
    asalKotaInput.disabled = false;
    asalKotaInput.readOnly = false;
    asalKotaInput.value = '';
    locatingIndicator.style.display = 'none';
  } else {
    if (btnManual) btnManual.classList.remove('active');
    if (btnAuto) btnAuto.classList.add('active');
    // Jangan re-trigger GPS kalau sudah dapat lokasi atau sedang loading
    if (!isLocating && !(asalKotaInput.value && asalKotaInput.readOnly)) {
      getCurrentLocation();
    }
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) { showToast('Error', 'Browser tidak mendukung geolokasi'); setLocationMode('manual'); return; }
  if (isLocating) return; // guard: jangan spam kalau sedang proses
  if (asalKotaInput.value && asalKotaInput.readOnly) return; // sudah dapat lokasi, jangan ulang
  isLocating = true;
  asalKotaInput.disabled = true;
  asalKotaInput.placeholder = 'Mendeteksi lokasi...';
  asalKotaInput.value = '';
  locatingIndicator.style.display = 'flex';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.district || data.address.state || data.address.county || 'Lokasi tidak diketahui';
        asalKotaInput.value = city;
        isLocating = false;
        locatingIndicator.style.display = 'none';
        // Kalau admin set auto, input tetap locked setelah detect
        if (forceLocationMode === 'auto') {
          asalKotaInput.disabled = false; // perlu false agar value tersubmit
          asalKotaInput.readOnly = true;
          asalKotaInput.style.cursor = 'not-allowed';
          asalKotaInput.style.opacity = '0.7';
        } else {
          asalKotaInput.disabled = false;
          asalKotaInput.readOnly = false;
          asalKotaInput.style.cursor = '';
          asalKotaInput.style.opacity = '';
        }
        showToast('Lokasi Ditemukan! 📍', `Kota: ${city}`, 2500);
        updateFormProgress();
      } catch { handleLocationError('Gagal mendapatkan nama kota'); }
    },
    (error) => {
      const msgs = { 1: 'Izin lokasi ditolak', 2: 'Lokasi tidak tersedia', 3: 'Timeout mendapatkan lokasi' };
      handleLocationError(msgs[error.code] || 'Gagal mendapatkan lokasi');
    },
    { timeout: 15000, enableHighAccuracy: true }
  );
}

function handleLocationError(message) {
  isLocating = false;
  locatingIndicator.style.display = 'none';
  showToast('Error', message, 3000);
  if (forceLocationMode === 'auto') {
    // Mode paksa auto: retry GPS, jangan biarkan manual
    asalKotaInput.disabled = false;
    asalKotaInput.readOnly = true;
    asalKotaInput.placeholder = 'GPS gagal — coba izinkan akses lokasi';
    asalKotaInput.style.cursor = 'not-allowed';
    asalKotaInput.style.opacity = '0.7';
  } else {
    asalKotaInput.disabled = false;
    asalKotaInput.readOnly = false;
    asalKotaInput.placeholder = 'Masukkan asal kota';
    asalKotaInput.style.cursor = '';
    asalKotaInput.style.opacity = '';
    setLocationMode('manual');
  }
}

// ===== ADMIN CARDS SETUP =====
function setupAdminCards() {
  document.querySelectorAll('.admin-card').forEach(card => {
    card.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(10);
      document.querySelectorAll('.admin-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      setFieldError('admin', 'adminError', ''); // clear admin error
      updateFormProgress();
    });
  });
}

// ===== SCROLL =====
function setupScrollListener() {
  window.addEventListener('scroll', () => {
    if (fabBtn) fabBtn.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ===== INPUT ANIMATIONS =====
function setupInputAnimations() {
  document.querySelectorAll('.ios-input, .ios-textarea, .ios-select').forEach(input => {
    input.addEventListener('focus', () => {
      input.closest('.input-wrapper')?.classList.add('focused');
      if (navigator.vibrate) navigator.vibrate(10);
    });
    input.addEventListener('blur', () => {
      input.closest('.input-wrapper')?.classList.remove('focused');
    });
    input.addEventListener('input', updateFormProgress);
  });
}

// ===== SELECTED ADMIN =====
function getSelectedAdmin()     { return selectedAdmin ? (selectedAdmin.nomor || 'grup') : 'grup'; }
function getSelectedAdminName() { return selectedAdmin ? selectedAdmin.nama : 'Grup WhatsApp'; }

// ===== WHATSAPP MESSAGE =====
function generateWhatsAppMessage(formData) {
  const date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const communityName = siteSettings.name || 'DEVIL REIGN';
  const grupInfo = formData.grupName ? `\n🗂️ *Grup:* ${formData.grupName}` : '';
  return `*${communityName} — FORM MEMBER v12.0*\n━━━━━━━━━━━━━━━━━━\n\n📅 *Tanggal:* ${date}${grupInfo}\n\n👤 *Nama:* ${formData.nama}\n🎂 *Umur:* ${formData.umur} tahun\n🎮 *USN Hotel Hideaway:* ${formData.usnHotel}\n📍 *Asal Kota:* ${formData.asalKota}\n📱 *No. WhatsApp:* +${formData.nomorWA}\n\n💬 *Alasan Bergabung:*\n${formData.alasan}\n\n━━━━━━━━━━━━━━━━━━\n*STATUS:* ⏳ MENUNGGU PERSETUJUAN ADMIN\n━━━━━━━━━━━━━━━━━━\n\n۝ ${siteSettings.tagline || 'Satu Reign, Satu Kekuasaan'} ۝`;
}

// ===== SAVE TO FIREBASE =====
async function saveMemberToFirebase(formData) {
  try {
    const member = {
      nama:      formData.nama,
      umur:      formData.umur,
      nomorWA:   formData.nomorWA,
      usnHotel:  formData.usnHotel,
      asalKota:  formData.asalKota,
      alasan:    formData.alasan,
      admin:     formData.admin,
      adminName: formData.adminName,
      grupKey:   formData.grupKey || 'grup1',
      grupName:  formData.grupName || 'Grup Admin 1',
      status:    'pending',
      tanggal:   new Date().toLocaleString('id-ID'),
      timestamp: new Date().toISOString()
    };
    await fetch(`${FIREBASE_URL}/members.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
  } catch(e) { console.warn('[DEVIL REIGN] Firebase save error:', e); }
}

// ===== GOOGLE SHEETS =====
async function sendToGoogleSheets(formData) {
  if (siteSettings.sheets === false) return true;
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: formData.nama, umur: formData.umur, usnHotel: formData.usnHotel,
        asalKota: formData.asalKota, alasan: formData.alasan,
        admin: formData.adminName, adminNomor: formData.admin,
        tanggal: new Date().toLocaleString('id-ID'), timestamp: new Date().toISOString()
      })
    });
  } catch { /* silent */ }
  return true;
}

// ===== RATE LIMIT UI =====
function showRateLimit(remainingMs) {
  const warn = document.getElementById('rateLimitWarn');
  const text = document.getElementById('rateLimitText');
  if (!warn || !text) return;
  const secs = Math.ceil(remainingMs / 1000);
  warn.style.display = 'flex';
  text.textContent = `Tunggu ${secs} detik sebelum submit lagi`;
  // Countdown
  const interval = setInterval(() => {
    const remaining = (lastSubmitTime + SUBMIT_COOLDOWN_MS) - Date.now();
    if (remaining <= 0) {
      clearInterval(interval);
      warn.style.display = 'none';
    } else {
      text.textContent = `Tunggu ${Math.ceil(remaining / 1000)} detik sebelum submit lagi`;
    }
  }, 1000);
}

// ===== FORM SUBMIT =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  if (siteSettings.formActive === false) {
    showToast('Ditutup ⚠️', 'Pendaftaran sedang ditutup sementara', 3000);
    return;
  }

  // Rate limit check
  const now = Date.now();
  if (lastSubmitTime > 0 && now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
    showRateLimit(SUBMIT_COOLDOWN_MS - (now - lastSubmitTime));
    showToast('Tunggu Dulu ⏱', 'Jangan submit terlalu sering', 3000);
    return;
  }

  const formData = {
    nama:      document.getElementById('nama').value.trim(),
    umur:      document.getElementById('umur').value.trim(),
    nomorWA:   (document.getElementById('waDialCode')?.value || '62') + document.getElementById('nomorWA').value.trim().replace(/^0+/, ''),
    usnHotel:  document.getElementById('usnHotel').value.trim(),
    asalKota:  document.getElementById('asalKota').value.trim(),
    alasan:    document.getElementById('alasan').value.trim(),
    admin:     selectedAdmin ? (selectedAdmin.nomor || 'grup') : 'grup',
    adminName: selectedAdmin ? selectedAdmin.nama : 'Grup WhatsApp',
    grupName:  selectedGrup ? (selectedGrup === 'grup1' ? 'Grup Admin 1' : 'Grup Admin 2') : 'Grup',
    grupKey:   selectedGrup || 'grup1'
  };

  // v12.0: Validasi grup & admin wajib dipilih
  let hasError = false;

  if (!selectedGrup) {
    const grupErr = document.getElementById('grupError');
    if (grupErr) { grupErr.textContent = 'Wajib pilih grup SQ terlebih dahulu'; grupErr.style.display = 'flex'; }
    document.getElementById('grupAdminSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Pilih Grup ⚠️', 'Pilih admin sq tujuan pengiriman', 3000);
    if (navigator.vibrate) navigator.vibrate([50,30,50]);
    return;
  }

  if (!selectedAdmin) {
    const adminErr = document.getElementById('adminError');
    if (adminErr) { adminErr.textContent = 'Wajib pilih salah satu admin'; adminErr.style.display = 'flex'; }
    document.getElementById('adminSelectionGroup')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Pilih Admin ⚠️', 'Pilih admin tujuan pengiriman', 3000);
    if (navigator.vibrate) navigator.vibrate([50,30,50]);
    return;
  }

  // Inline validation dengan pesan yang jelas

  if (!formData.nama || formData.nama.length < 2) {
    setFieldError('nama', 'namaError', 'Nama lengkap wajib diisi (min. 2 karakter)');
    hasError = true;
  }

  const umurNum = parseInt(formData.umur);
  if (!formData.umur) {
    setFieldError('umur', 'umurError', 'Umur wajib diisi');
    hasError = true;
  } else if (isNaN(umurNum) || umurNum < 10 || umurNum > 80) {
    setFieldError('umur', 'umurError', 'Umur harus angka antara 10 – 80 tahun');
    hasError = true;
  }

  if (!/^\d{8,15}$/.test(formData.nomorWA)) {
    setFieldError('nomorWA', 'nomorWAError', 'Nomor WA tidak valid. Isi nomor tanpa angka 0 di depan.');
    hasError = true;
  }

  if (!formData.usnHotel || formData.usnHotel.length < 2) {
    setFieldError('usnHotel', 'usnError', 'USN Hotel Hideaway wajib diisi');
    hasError = true;
  }

  if (!formData.asalKota) {
    setFieldError('asalKota', 'kotaError', 'Asal kota wajib diisi');
    hasError = true;
  }

  if (!formData.alasan || formData.alasan.length < 20) {
    setFieldError('alasan', 'alasanError', `Alasan terlalu singkat (${formData.alasan.length}/20 karakter min.)`);
    hasError = true;
  }

  if (hasError) {
    showToast('Form Belum Lengkap ⚠️', 'Periksa kembali isian yang ditandai merah', 3000);
    // Scroll ke error pertama & shake animation
    const firstError = document.querySelector('.field-error[style*="flex"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Shake the parent form group
      const parentGroup = firstError.closest('.form-group');
      if (parentGroup) {
        parentGroup.style.animation = 'none';
        parentGroup.offsetHeight; // reflow
        parentGroup.style.animation = 'shake 0.4s ease';
        setTimeout(() => parentGroup.style.animation = '', 400);
      }
    }
    if (navigator.vibrate) navigator.vibrate([50,30,50]);
    return;
  }

  lastSubmitTime = Date.now();
  // v8.0: Disable submit btn to prevent double submit
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.disabled = true;
  showProcessing();

  await Promise.all([
    saveMemberToFirebase(formData),
    sendToGoogleSheets(formData),
    new Promise(r => setTimeout(r, 1800))
  ]);

  hideProcessing();
  // v8.0: Re-enable submit button
  const submitBtnEl = document.getElementById('submitBtn');
  if (submitBtnEl) submitBtnEl.disabled = false;

  // Show member info in modal
  const infoEl = document.getElementById('modalMemberInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="modal-info-row"><span>👤</span><span>${formData.nama}</span></div>
      <div class="modal-info-row"><span>🎮</span><span>${formData.usnHotel}</span></div>
      <div class="modal-info-row"><span>📍</span><span>${formData.asalKota}</span></div>
      <div class="modal-info-row"><span>📨</span><span>Dikirim ke: ${formData.adminName} (${formData.grupName})</span></div>
    `;
  }

  showModal();

  // v12.0: Open specific admin WA number
  const modalBtn = document.getElementById('modalContinueBtn');
  if (modalBtn) {
    const handler = () => {
      closeModal();
      const message = encodeURIComponent(generateWhatsAppMessage(formData));
      // Send to specific admin WA
      const targetNomor = formData.admin && formData.admin !== 'grup' ? formData.admin : null;
      const waUrl = targetNomor
        ? `https://wa.me/${targetNomor}?text=${message}`
        : `${grupWALink}`;
      window.open(waUrl, '_blank');
      setTimeout(() => showToast('Berhasil! ✅', `Data terkirim ke ${formData.adminName}!`, 2500), 500);
      // Reset form setelah dikirim
      setTimeout(() => {
        form.reset();
        clearAllErrors();
        clearDraft();
        setLocationMode('manual');
        updateFormProgress();
        if (charCountEl) charCountEl.textContent = '0';
        if (charCountEl) charCountEl.style.color = '';
        if (charMinNote) charMinNote.style.display = '';
      }, 2000);
      modalBtn.removeEventListener('click', handler);
    };
    modalBtn.onclick = handler;
  }
});

// ===== iOS ZOOM PREVENTION =====
document.addEventListener('gesturestart', e => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, false);


// ===== V9.0 NEW FEATURES =====

// --- Dark Mode ---
function initDarkMode() {
  const saved = localStorage.getItem('dr_theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
  }
  updateDarkModeIcon(saved === 'light');
}

function toggleDarkMode() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('dr_theme', isLight ? 'light' : 'dark');
  updateDarkModeIcon(isLight);
  showToast(isLight ? '☀️ Light Mode' : '🌙 Dark Mode', 'Tema berhasil diganti', 1800);
}

function updateDarkModeIcon(isLight) {
  const icon = document.getElementById('darkModeIcon');
  if (!icon) return;
  if (isLight) {
    // currently light → show moon icon to switch to dark
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none"/>';
  } else {
    // currently dark → show sun icon to switch to light
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('fill', 'none');
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  }
}

// --- Firebase Status Indicator (index page) ---
function setFirebaseStatusIndex(ok) {
  const dot = document.getElementById('fbStatusDot');
  if (!dot) return;
  if (ok) {
    dot.classList.add('connected');
    dot.title = 'Firebase Terhubung';
  } else {
    dot.classList.remove('connected');
    dot.title = 'Firebase Terputus';
  }
}

// --- Draft Save/Restore ---
const DRAFT_KEY = 'dr_formDraft_v9';
let draftTimer = null;

function setupDraftAutosave() {
  const fields = ['nama', 'umur', 'nomorWA', 'usnHotel', 'asalKota', 'alasan'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 1500);
    });
  });
}

function saveDraft() {
  const draft = {
    nama:      document.getElementById('nama')?.value || '',
    umur:      document.getElementById('umur')?.value || '',
    nomorWA:   document.getElementById('nomorWA')?.value || '',
    waDialCode: document.getElementById('waDialCode')?.value || '62',
    usnHotel:  document.getElementById('usnHotel')?.value || '',
    asalKota:  document.getElementById('asalKota')?.value || '',
    alasan:    document.getElementById('alasan')?.value || '',
    savedAt:   Date.now()
  };
  const hasSomething = draft.nama || draft.alasan;
  if (!hasSomething) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    showDraftState('saved');
  } catch(e) {}
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (Date.now() - (draft.savedAt||0) > 24*60*60*1000) { clearDraft(); return; }
    let restored = false;
    if (draft.nama)     { const el = document.getElementById('nama');     if(el&&!el.value) { el.value=draft.nama;     restored=true; } }
    if (draft.umur)     { const el = document.getElementById('umur');     if(el&&!el.value) { el.value=draft.umur;     restored=true; } }
    if (draft.nomorWA)   { const el = document.getElementById('nomorWA');   if(el&&!el.value) { el.value=draft.nomorWA;  restored=true; } }
    if (draft.waDialCode){ const el = document.getElementById('waDialCode'); if(el) { el.value=draft.waDialCode; const c = WA_COUNTRIES.find(x=>x.dial===draft.waDialCode); if(c){ document.getElementById('waFlagDisplay').textContent=c.flag; document.getElementById('waDialDisplay').textContent='+'+c.dial; } } }
    if (draft.usnHotel) { const el = document.getElementById('usnHotel'); if(el&&!el.value) { el.value=draft.usnHotel; restored=true; } }
    if (draft.asalKota) { const el = document.getElementById('asalKota'); if(el&&!el.value) { el.value=draft.asalKota; restored=true; } }
    if (draft.alasan)   { const el = document.getElementById('alasan');   if(el&&!el.value) { el.value=draft.alasan;
      if (charCountEl) { charCountEl.textContent = draft.alasan.length; charCountEl.style.color = draft.alasan.length>=20?'#2ECC71':'rgba(255,159,10,0.9)'; }
      if (charMinNote) charMinNote.style.display = draft.alasan.length>=20?'none':'';
      restored=true; } }
    if (restored) {
      updateFormProgress();
      showDraftState('restored');
    }
  } catch(e) {}
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch(e) {}
  const el = document.getElementById('draftIndicator');
  if (el) el.classList.remove('show');
}

function showDraftState(state) {
  const el = document.getElementById('draftIndicator');
  if (!el) return;
  el.classList.add('show');
  el.classList.toggle('saved', state==='saved');
  const t = el.querySelector('.draft-text');
  if (t) t.textContent = state==='saved' ? '✓ Draft tersimpan' : '↩ Draft dipulihkan';
}

// --- Countdown ---
let _countdownInterval = null;

function setupCountdown(targetDate) {
  if (_countdownInterval) clearInterval(_countdownInterval);
  const el = document.getElementById('headerCountdown');
  if (!el || !targetDate) return;
  function tick() {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) { clearInterval(_countdownInterval); el.style.display='none'; return; }
    const d = Math.floor(diff/(1000*60*60*24));
    const h = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
    const m = Math.floor((diff%(1000*60*60))/(1000*60));
    const s = Math.floor((diff%(1000*60))/1000);
    document.getElementById('cdDays').textContent  = String(d).padStart(2,'0');
    document.getElementById('cdHours').textContent = String(h).padStart(2,'0');
    document.getElementById('cdMins').textContent  = String(m).padStart(2,'0');
    document.getElementById('cdSecs').textContent  = String(s).padStart(2,'0');
    el.style.display = 'block';
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

// --- Share Button ---
function setupShareButton() {
  const btn = document.getElementById('modalShareBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const title = `${siteSettings.name||'DEVIL REIGN'} — Pendaftaran Member`;
    const text  = `${siteSettings.tagline||'Satu Reign, Satu Kekuasaan'}. Daftar sekarang!`;
    const url   = window.location.href.split('?')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        showToast('Berhasil! 📤', 'Link berhasil dibagikan', 2000);
      } catch(e) {
        if (e.name !== 'AbortError') _copyToClipboard(url);
      }
    } else {
      _copyToClipboard(url);
    }
  });
}

function _copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Link Disalin! 📋', 'Tempel dan bagikan ke teman-teman', 2500))
      .catch(() => showToast('Error', 'Gagal menyalin link', 2000));
  } else {
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast('Link Disalin! 📋', 'Tempel dan bagikan ke teman-teman', 2500);
  }
}

// --- Blur Validation (v11.0) ---
function setupBlurValidation() {
  document.getElementById('nama')?.addEventListener('blur', function() {
    const v = this.value.trim();
    setFieldError('nama','namaError', !v||v.length<2 ? 'Nama lengkap wajib diisi (min. 2 karakter)' : '');
  });
  document.getElementById('umur')?.addEventListener('blur', function() {
    const v = this.value.trim(), n = parseInt(v);
    if (!v) setFieldError('umur','umurError','Umur wajib diisi');
    else if (isNaN(n)||n<10||n>80) setFieldError('umur','umurError','Umur harus angka antara 10 – 80 tahun');
    else setFieldError('umur','umurError','');
  });
  document.getElementById('nomorWA')?.addEventListener('blur', function() {
    const v = this.value.trim();
    setFieldError('nomorWA','nomorWAError', !/^\d{4,13}$/.test(v) ? 'Isi nomor tanpa angka 0 di depan (4–13 digit)' : '');
  });
  document.getElementById('nomorWA')?.addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '');
  });
  document.getElementById('usnHotel')?.addEventListener('blur', function() {
    const v = this.value.trim();
    setFieldError('usnHotel','usnError', !v||v.length<2 ? 'USN Hotel Hideaway wajib diisi' : '');
  });
  document.getElementById('asalKota')?.addEventListener('blur', function() {
    setFieldError('asalKota','kotaError', !this.value.trim() ? 'Asal kota wajib diisi' : '');
  });
  document.getElementById('alasan')?.addEventListener('blur', function() {
    const v = this.value.trim();
    setFieldError('alasan','alasanError', v.length<20 ? `Alasan terlalu singkat (${v.length}/20 karakter min.)` : '');
  });
}

// ===== WA COUNTRY CODE PICKER =====
const WA_COUNTRIES = [
  // Asia Tenggara
  { flag:'🇮🇩', name:'Indonesia',           dial:'62'  },
  { flag:'🇲🇾', name:'Malaysia',             dial:'60'  },
  { flag:'🇸🇬', name:'Singapura',            dial:'65'  },
  { flag:'🇵🇭', name:'Filipina',             dial:'63'  },
  { flag:'🇹🇭', name:'Thailand',             dial:'66'  },
  { flag:'🇻🇳', name:'Vietnam',              dial:'84'  },
  { flag:'🇧🇳', name:'Brunei',               dial:'673' },
  { flag:'🇲🇲', name:'Myanmar',              dial:'95'  },
  { flag:'🇰🇭', name:'Kamboja',              dial:'855' },
  { flag:'🇱🇦', name:'Laos',                 dial:'856' },
  { flag:'🇹🇱', name:'Timor Leste',          dial:'670' },
  // Asia Selatan
  { flag:'🇮🇳', name:'India',                dial:'91'  },
  { flag:'🇵🇰', name:'Pakistan',             dial:'92'  },
  { flag:'🇧🇩', name:'Bangladesh',           dial:'880' },
  { flag:'🇱🇰', name:'Sri Lanka',            dial:'94'  },
  { flag:'🇳🇵', name:'Nepal',                dial:'977' },
  // Asia Timur
  { flag:'🇨🇳', name:'China',                dial:'86'  },
  { flag:'🇯🇵', name:'Jepang',               dial:'81'  },
  { flag:'🇰🇷', name:'Korea Selatan',        dial:'82'  },
  { flag:'🇹🇼', name:'Taiwan',               dial:'886' },
  { flag:'🇭🇰', name:'Hong Kong',            dial:'852' },
  { flag:'🇲🇴', name:'Macau',                dial:'853' },
  // Asia Tengah & Barat
  { flag:'🇸🇦', name:'Arab Saudi',           dial:'966' },
  { flag:'🇦🇪', name:'Uni Emirat Arab',      dial:'971' },
  { flag:'🇶🇦', name:'Qatar',                dial:'974' },
  { flag:'🇰🇼', name:'Kuwait',               dial:'965' },
  { flag:'🇧🇭', name:'Bahrain',              dial:'973' },
  { flag:'🇴🇲', name:'Oman',                 dial:'968' },
  { flag:'🇾🇪', name:'Yaman',                dial:'967' },
  { flag:'🇮🇷', name:'Iran',                 dial:'98'  },
  { flag:'🇮🇶', name:'Irak',                 dial:'964' },
  { flag:'🇹🇷', name:'Turki',                dial:'90'  },
  { flag:'🇮🇱', name:'Israel',               dial:'972' },
  { flag:'🇯🇴', name:'Yordania',             dial:'962' },
  { flag:'🇱🇧', name:'Lebanon',              dial:'961' },
  { flag:'🇦🇿', name:'Azerbaijan',           dial:'994' },
  { flag:'🇰🇿', name:'Kazakhstan',           dial:'7'   },
  { flag:'🇺🇿', name:'Uzbekistan',           dial:'998' },
  { flag:'🇦🇫', name:'Afghanistan',          dial:'93'  },
  // Eropa
  { flag:'🇬🇧', name:'Inggris',              dial:'44'  },
  { flag:'🇩🇪', name:'Jerman',               dial:'49'  },
  { flag:'🇫🇷', name:'Prancis',              dial:'33'  },
  { flag:'🇮🇹', name:'Italia',               dial:'39'  },
  { flag:'🇪🇸', name:'Spanyol',              dial:'34'  },
  { flag:'🇳🇱', name:'Belanda',              dial:'31'  },
  { flag:'🇧🇪', name:'Belgia',               dial:'32'  },
  { flag:'🇵🇹', name:'Portugal',             dial:'351' },
  { flag:'🇨🇭', name:'Swiss',                dial:'41'  },
  { flag:'🇦🇹', name:'Austria',              dial:'43'  },
  { flag:'🇸🇪', name:'Swedia',               dial:'46'  },
  { flag:'🇳🇴', name:'Norwegia',             dial:'47'  },
  { flag:'🇩🇰', name:'Denmark',              dial:'45'  },
  { flag:'🇫🇮', name:'Finlandia',            dial:'358' },
  { flag:'🇷🇺', name:'Rusia',                dial:'7'   },
  { flag:'🇵🇱', name:'Polandia',             dial:'48'  },
  { flag:'🇺🇦', name:'Ukraina',              dial:'380' },
  { flag:'🇷🇴', name:'Romania',              dial:'40'  },
  { flag:'🇨🇿', name:'Ceko',                 dial:'420' },
  { flag:'🇬🇷', name:'Yunani',               dial:'30'  },
  { flag:'🇭🇺', name:'Hungaria',             dial:'36'  },
  // Amerika
  { flag:'🇺🇸', name:'Amerika Serikat',      dial:'1'   },
  { flag:'🇨🇦', name:'Kanada',               dial:'1'   },
  { flag:'🇲🇽', name:'Meksiko',              dial:'52'  },
  { flag:'🇧🇷', name:'Brasil',               dial:'55'  },
  { flag:'🇦🇷', name:'Argentina',            dial:'54'  },
  { flag:'🇨🇱', name:'Chile',                dial:'56'  },
  { flag:'🇨🇴', name:'Kolombia',             dial:'57'  },
  { flag:'🇵🇪', name:'Peru',                 dial:'51'  },
  { flag:'🇻🇪', name:'Venezuela',            dial:'58'  },
  // Afrika
  { flag:'🇿🇦', name:'Afrika Selatan',       dial:'27'  },
  { flag:'🇳🇬', name:'Nigeria',              dial:'234' },
  { flag:'🇰🇪', name:'Kenya',                dial:'254' },
  { flag:'🇪🇬', name:'Mesir',                dial:'20'  },
  { flag:'🇬🇭', name:'Ghana',                dial:'233' },
  { flag:'🇹🇿', name:'Tanzania',             dial:'255' },
  { flag:'🇪🇹', name:'Ethiopia',             dial:'251' },
  { flag:'🇸🇳', name:'Senegal',              dial:'221' },
  // Oseania
  { flag:'🇦🇺', name:'Australia',            dial:'61'  },
  { flag:'🇳🇿', name:'Selandia Baru',        dial:'64'  },
  { flag:'🇫🇯', name:'Fiji',                 dial:'679' },
  { flag:'🇵🇬', name:'Papua Nugini',         dial:'675' },
];

let _waDropdownOpen = false;

function buildCountryList(filter = '') {
  const list = document.getElementById('waCountryList');
  if (!list) return;
  const q = filter.toLowerCase();
  const filtered = WA_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q) || c.dial.includes(q)
  );
  const currentDial = document.getElementById('waDialCode')?.value || '62';
  list.innerHTML = filtered.map(c => `
    <div class="wa-country-item${c.dial === currentDial ? ' selected' : ''}"
         onclick="selectCountry('${c.dial}','${c.flag}','${c.name}')">
      <span class="wa-item-flag">${c.flag}</span>
      <span class="wa-item-name">${c.name}</span>
      <span class="wa-item-dial">+${c.dial}</span>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;font-size:12px;color:rgba(255,255,255,0.3)">Tidak ditemukan</div>';
}

function toggleCountryDropdown() {
  const dd = document.getElementById('waDropdown');
  const btn = document.getElementById('waCountryBtn');
  if (!dd || !btn) return;
  _waDropdownOpen = !_waDropdownOpen;
  dd.classList.toggle('open', _waDropdownOpen);
  btn.classList.toggle('open', _waDropdownOpen);
  if (_waDropdownOpen) {
    buildCountryList();
    setTimeout(() => document.getElementById('waCountrySearch')?.focus(), 50);
  }
}

function filterCountries(q) {
  buildCountryList(q);
}

function selectCountry(dial, flag, name) {
  document.getElementById('waDialCode').value = dial;
  document.getElementById('waFlagDisplay').textContent = flag;
  document.getElementById('waDialDisplay').textContent = '+' + dial;
  const dd = document.getElementById('waDropdown');
  const btn = document.getElementById('waCountryBtn');
  if (dd) dd.classList.remove('open');
  if (btn) btn.classList.remove('open');
  _waDropdownOpen = false;
  document.getElementById('nomorWA')?.focus();
}

// Tutup dropdown saat klik di luar
document.addEventListener('click', (e) => {
  if (_waDropdownOpen && !e.target.closest('#waCountryBtn') && !e.target.closest('#waDropdown')) {
    document.getElementById('waDropdown')?.classList.remove('open');
    document.getElementById('waCountryBtn')?.classList.remove('open');
    _waDropdownOpen = false;
  }
});

window.toggleCountryDropdown = toggleCountryDropdown;
window.filterCountries       = filterCountries;
window.selectCountry         = selectCountry;

// ===== MEDIA POPUP v11.0 =====
function applyMediaPopup(data) {
  if (!data || !data.url) return;

  // Buat overlay
  const overlay = document.createElement('div');
  overlay.id = 'mediaPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;animation:mpFadeIn .3s ease';

  const sizeMap = { sm: '400px', md: '600px', lg: '800px', full: '100%' };
  const maxW = sizeMap[data.size || 'md'] || '600px';

  // Deteksi tipe media
  const isAudio = data.mediaType === 'audio' || /\.(mp3|wav|ogg|aac|flac|m4a)(\?.*)?$/i.test(data.url);
  const isVideo = data.mediaType === 'video' || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(data.url);
  const isGif = data.url.toLowerCase().includes('.gif') || data.mediaType === 'gif';

  // Opsi audio untuk video (unmuted jika diizinkan)
  const mutedAttr = data.muted !== false ? 'muted' : '';
  const autoplayAttr = data.autoplay !== false ? 'autoplay' : '';
  const loopAttr = data.loop !== false ? 'loop' : '';

  let mediaHtml = '';

  if (isAudio) {
    // Audio player dengan custom UI
    mediaHtml = `
      <div style="padding:30px 20px;text-align:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)">
        <div style="font-size:48px;margin-bottom:16px">🎵</div>
        <div style="font-size:14px;font-weight:600;color:#EAEAF5;margin-bottom:8px">${data.title || 'Audio Player'}</div>
        ${data.caption ? `<div style="font-size:12px;color:rgba(234,234,245,0.6);margin-bottom:20px">${data.caption}</div>` : ''}
        <audio id="mediaPopupAudio" src="${data.url}" ${autoplayAttr} ${loopAttr} controls controlsList="nodownload" style="width:100%;max-width:400px;height:40px;border-radius:20px"></audio>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button onclick="document.getElementById('mediaPopupAudio').play()" style="padding:8px 16px;background:rgba(193,18,31,0.8);border:none;border-radius:8px;color:white;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play
          </button>
          <button onclick="document.getElementById('mediaPopupAudio').pause()" style="padding:8px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#EAEAF5;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause
          </button>
        </div>
      </div>
    `;
  } else if (isVideo) {
    // Video dengan kontrol suara opsional
    const showControls = data.controls !== false ? 'controls' : '';
    mediaHtml = `<video src="${data.url}" ${autoplayAttr} ${loopAttr} ${mutedAttr} playsinline ${showControls} style="width:100%;max-height:70vh;object-fit:contain;display:block;background:#000"></video>`;
  } else {
    // Gambar/GIF
    mediaHtml = `<img src="${data.url}" alt="${data.title || 'Media Popup'}" style="width:100%;max-height:70vh;object-fit:contain;display:block">`;
  }

  overlay.innerHTML = `
    <style>@keyframes mpFadeIn{from{opacity:0}to{opacity:1}}@keyframes mpSlideUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}</style>
    <div style="background:#0B0B16;border:1px solid rgba(255,255,255,0.1);border-radius:18px;overflow:hidden;width:100%;max-width:${maxW};box-shadow:0 40px 80px rgba(0,0,0,0.7);animation:mpSlideUp .35s cubic-bezier(0.16,1,0.3,1)">
      ${!isAudio && (data.title || data.closable !== false) ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.07)">
        <div style="font-size:13px;font-weight:700;color:#EAEAF5">${data.title || ''}</div>
        ${data.closable !== false ? `<button onclick="document.getElementById('mediaPopupOverlay').remove()" style="width:28px;height:28px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#aaa;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>` : ''}
      </div>` : ''}
      ${isAudio ? mediaHtml : `<div style="background:#000;line-height:0">${mediaHtml}</div>`}
      ${!isAudio && data.caption ? `<div style="padding:12px 16px;font-size:11.5px;color:rgba(234,234,245,0.6);line-height:1.6">${data.caption}</div>` : ''}
    </div>
  `;

  // Tutup saat klik backdrop
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && data.closable !== false) {
      // Hentikan audio sebelum menutup
      const audio = document.getElementById('mediaPopupAudio');
      if (audio) audio.pause();
      overlay.remove();
    }
  });

  // Tombol close untuk audio
  if (isAudio && data.closable !== false) {
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;width:32px;height:32px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10';
    closeBtn.onclick = () => {
      const audio = document.getElementById('mediaPopupAudio');
      if (audio) audio.pause();
      overlay.remove();
    };
    overlay.appendChild(closeBtn);
  }

  document.body.appendChild(overlay);

  // Tandai sudah ditampilkan di session ini
  const mpKey = 'dr_mediapopup_' + (data.uploadedAt || data.url.slice(-20));
  sessionStorage.setItem(mpKey, '1');
}

// ===== EXPORTS V9.0 =====
window.toggleDarkMode  = toggleDarkMode;
window.clearDraft      = clearDraft;

// ===== EXPORTS =====
window.showTutorialAgain        = showTutorialAgain;
window.showAdPopup              = showAdPopup;
window.closeAdPopup             = closeAdPopup;
window.buildDynamicAdPopup      = buildDynamicAdPopup;
window.startInteractiveTutorial = startInteractiveTutorial;
window.nextTutorialStep         = nextTutorialStep;
window.skipTutorial             = skipTutorial;
window.scrollToTop              = scrollToTop;
window.closeModal               = closeModal;
window.setLocationMode          = setLocationMode;
window.applyMaintenanceMode     = applyMaintenanceMode;
window.applyDashboardPopup      = applyDashboardPopup;
window.applyMediaPopup          = applyMediaPopup;
window.selectGrup           = selectGrup;
window.selectAdminById      = selectAdminById;
window.renderGrupCards      = renderGrupCards;
window.renderSocialLinks    = renderSocialLinks;

// Console branding
console.log('%c DEVIL REIGN v11.0 ', 'background:linear-gradient(135deg,#C1121F,#7B0010);color:white;font-size:24px;font-weight:bold;padding:10px 20px;border-radius:10px;');
console.log('%c v11.0 — SEO Enhanced: Full meta tag sync, image validation, SEO score, reset button, live preview ', 'color:#C1121F;font-size:14px;');
console.log('%c Crafted by Hironi × Upgraded by Claude v11.0 ', 'color:#666;font-size:12px;');
