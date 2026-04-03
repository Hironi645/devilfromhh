// ===== DEVIL REIGN — v9.0 =====
// Website by Hironi | Firebase Edition v9.0
// Upgraded: Bug fixes + Fitur baru (char counter, progress bar, confetti, inline validation, rate limiting, member count)

// ===== FIREBASE CONFIG =====
const FIREBASE_URL = 'https://from-9bd21-default-rtdb.asia-southeast1.firebasedatabase.app';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyngWDrUvB7pMwISgbeg2c-RYT-sZVmyoKjjYva2f9DF_eshS1cztyzo80FJm1Y-p6dVQ/exec';

// ===== STATE =====
let locationMode = 'manual';
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
let adminList = [];
let bannerImages = [];
let siteSettings = {};

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
      showToast('Selamat Datang di v9.0! 👋', 'Klik "Lihat Tutorial" untuk panduan pengisian form', 4000);
    } else {
      showToast('Selamat Datang Kembali!', 'Silakan lengkapi form pendaftaran member', 3000);
    }
  }, 1200);
});

// ===== LOAD DATA FROM FIREBASE =====
async function loadFromFirebase() {
  try {
    const [adminsRaw, bannersRaw, settings, announcement, popup, maintenance, membersRaw] = await Promise.all([
      fbGet('admins'),
      fbGet('banners'),
      fbGet('settings'),
      fbGet('announcement'),
      fbGet('popup'),
      fbGet('maintenance'),
      fbGet('members')
    ]);

    if (adminsRaw && typeof adminsRaw === 'object') {
      adminList = Object.values(adminsRaw).filter(a => a && a.active !== false);
    }
    if (bannersRaw && typeof bannersRaw === 'object') {
      bannerImages = Object.values(bannersRaw)
        .filter(b => b && b.active !== false)
        .map(b => ({ src: b.src, caption: b.caption || '' }));
    }
    if (settings) { siteSettings = settings; applySettings(settings); applyTheme(settings); applyMetaTags(settings); }
    if (announcement) applyAnnouncement(announcement);
    if (maintenance && maintenance.active) applyMaintenanceMode(maintenance);

    // BUG FIX: Cek apakah popup sudah ditampilkan hari ini sebelum jadwalkan
    if (popup && popup.active) {
      const shownKey = 'dr_popup_' + (popup.updatedAt || popup.title || 'default');
      if (!sessionStorage.getItem(shownKey)) {
        setTimeout(() => applyDashboardPopup(popup), (popup.delay || 3) * 1000);
      }
    }

    // Member count badge
    if (membersRaw && typeof membersRaw === 'object') {
      updateMemberCount(Object.keys(membersRaw).length);
    }

    generateAdminCards();
    generateAutoSlideBanner();
    setFirebaseStatusIndex(true);

    // Load promo data and show ad popup
    await loadPromoData();
    const adPopupEnabled = promoData?.active !== false && siteSettings.adPopup !== false;
    if (adPopupEnabled) {
      const lastShown = localStorage.getItem('devilReign_adPopupShown');
      const oneDayMs = 24 * 60 * 60 * 1000;
      const shouldShow = !lastShown || (Date.now() - new Date(lastShown).getTime() > oneDayMs);
      if (shouldShow) {
        const delay = (promoData?.delay || 8) * 1000;
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
    generateAdminCards();
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
  // v9.0: countdown
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
  if (s.gps === false && btnAuto) btnAuto.style.display = 'none';
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

// ===== APPLY META TAGS (Open Graph) =====
function applyMetaTags(s) {
  if (!s) return;

  const metaTitle = s.metaTitle || s.name || 'DEVIL REIGN';
  const metaDescription = s.metaDescription || s.tagline || 'Bergabunglah dengan komunitas eksklusif kami';
  const metaKeywords = s.metaKeywords || 'DEVIL REIGN, Hotel Hideaway, Komunitas, Gaming, Member';
  const metaImage = s.metaImage || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&h=630&fit=crop';
  const metaUrl = s.metaUrl || s.settingUrl || 'https://devilreign.com';
  const siteName = s.metaSiteName || s.name || 'DEVIL REIGN';
  const author = s.metaAuthor || 'Hironi';
  const type = s.metaType || 'website';
  const twitterCard = s.metaTwitterCard || 'summary_large_image';
  const robots = s.metaRobots || 'index,follow';

  // Update document title
  const titleEl = document.getElementById('metaTitle');
  if (titleEl) titleEl.textContent = metaTitle;
  document.title = metaTitle;

  // Update meta name="title"
  const nameTitleEl = document.getElementById('metaNameTitle');
  if (nameTitleEl) nameTitleEl.content = metaTitle;

  // Update meta description
  const descEl = document.getElementById('metaDescription');
  if (descEl) descEl.content = metaDescription;

  // Update meta keywords
  const keywordsEl = document.querySelector('meta[name="keywords"]');
  if (keywordsEl) keywordsEl.content = metaKeywords;

  // Update meta author
  const authorEl = document.querySelector('meta[name="author"]');
  if (authorEl) authorEl.content = author;

  // Update meta robots
  const robotsEl = document.querySelector('meta[name="robots"]');
  if (!robotsEl) {
    const newRobots = document.createElement('meta');
    newRobots.name = 'robots';
    newRobots.content = robots;
    document.head.appendChild(newRobots);
  } else {
    robotsEl.content = robots;
  }

  // Update Open Graph meta tags
  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType) ogType.content = type;

  const ogUrl = document.getElementById('metaOgUrl');
  if (ogUrl) ogUrl.content = metaUrl;

  const ogTitle = document.getElementById('metaOgTitle');
  if (ogTitle) ogTitle.content = metaTitle;

  const ogDesc = document.getElementById('metaOgDescription');
  if (ogDesc) ogDesc.content = metaDescription;

  const ogImage = document.getElementById('metaOgImage');
  if (ogImage) ogImage.content = metaImage;

  const ogSiteName = document.getElementById('metaOgSiteName');
  if (ogSiteName) ogSiteName.content = siteName;

  // Update Twitter meta tags
  const twCard = document.querySelector('meta[name="twitter:card"]');
  if (twCard) twCard.content = twitterCard;

  const twUrl = document.getElementById('metaTwitterUrl');
  if (twUrl) twUrl.content = metaUrl;

  const twTitle = document.getElementById('metaTwitterTitle');
  if (twTitle) twTitle.content = metaTitle;

  const twDesc = document.getElementById('metaTwitterDescription');
  if (twDesc) twDesc.content = metaDescription;

  const twImage = document.getById('metaTwitterImage');
  if (twImage) twImage.content = metaImage;
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
          generateAdminCards();
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
    </style>
    <div style="text-align:center;padding:40px;max-width:480px;width:90%">
      ${templateHTML}
      <div style="margin-top:28px;font-size:10px;color:rgba(240,240,245,0.2);letter-spacing:2px">DEVIL REIGN v9.0 © ${new Date().getFullYear()}</div>
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
// ===== PROMO DATA =====
let promoData = null;

async function loadPromoData() {
  try {
    const snapshot = await db.ref('promo').once('value');
    promoData = snapshot.val();
    if (!promoData) {
      // Default promo data
      promoData = {
        title: 'Pilih Paket Anda',
        subtitle: 'by HIRONI',
        badge: 'JASA WEBSITE',
        waLink: 'https://wa.me/6285119654305',
        active: true,
        delay: 8,
        packages: [
          { name: 'Biasa', price: 'Rp 350.000', icon: 'box', features: ['Landing Page', '3 Section', 'Mobile Friendly'], popular: false },
          { name: 'Pro', price: 'Rp 850.000', icon: 'star', features: ['Multi Page', '5-7 Halaman', 'Form Contact', 'Animasi'], popular: true },
          { name: 'Legend', price: 'Rp 950.000', icon: 'trophy', features: ['Full Website', '10+ Halaman', 'Dashboard Admin', 'Database'], popular: false },
          { name: 'Donatur', price: 'Rp 1.000.000', icon: 'diamond', features: ['Premium Full', 'Unlimited Fitur', 'Priority Support', 'Buat Sultan!'], popular: false }
        ]
      };
    }
    renderPromoPopup();
  } catch (e) {
    console.error('Error loading promo data:', e);
  }
}

function getPromoIconSvg(icon) {
  const icons = {
    'box': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    'star': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'trophy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>',
    'diamond': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    'gift': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    'crown': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>',
    'fire': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    'rocket': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>'
  };
  return icons[icon] || icons['box'];
}

function renderPromoPopup() {
  if (!promoData) return;

  // Update header
  const badgeEl = document.getElementById('adPopupBadge');
  const titleEl = document.getElementById('adPopupTitle');
  const subtitleEl = document.getElementById('adPopupSubtitle');
  const waLinkEl = document.getElementById('adPopupWaLink');
  const packagesEl = document.getElementById('adPopupPackages');

  if (badgeEl) badgeEl.textContent = promoData.badge || 'JASA WEBSITE';
  if (titleEl) titleEl.textContent = promoData.title || 'Pilih Paket Anda';
  if (subtitleEl) subtitleEl.textContent = promoData.subtitle || 'by HIRONI';
  if (waLinkEl) waLinkEl.href = promoData.waLink || 'https://wa.me/6285119654305';

  // Render packages
  if (packagesEl && promoData.packages) {
    packagesEl.innerHTML = promoData.packages.map((pkg, idx) => {
      const popularClass = pkg.popular ? 'package-populer' : '';
      const badgeHtml = pkg.popular ? '<div class="package-badge-popular">POPULER</div>' : '';
      const featuresHtml = (pkg.features || []).map(f => `<span class="package-feature">${f}</span>`).join('');

      return `
        <div class="package-card ${popularClass}">
          ${badgeHtml}
          <div class="package-header">
            <div class="package-icon">${getPromoIconSvg(pkg.icon)}</div>
            <div class="package-info">
              <span class="package-name">${pkg.name}</span>
              <span class="package-price">${pkg.price}</span>
            </div>
          </div>
          <div class="package-features">${featuresHtml}</div>
        </div>
      `;
    }).join('');
  }
}

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

// ===== ADMIN CARDS =====
function generateAdminCards() {
  const adminGrid = document.getElementById('adminGrid');
  if (!adminGrid) return;

  // BUG FIX: Simpan admin yang sudah dipilih sebelum di-render ulang
  const prevSelectedNomor = getSelectedAdmin();

  adminGrid.innerHTML = '';
  if (!adminList.length) {
    adminGrid.innerHTML = '<p style="color:rgba(240,240,245,0.4);font-size:13px;text-align:center;padding:20px">Admin tidak tersedia saat ini.</p>';
    return;
  }
  adminList.forEach((admin) => {
    const theme = adminThemes[admin.theme] || adminThemes.red;
    const card = document.createElement('label');
    card.className = `admin-card admin-theme-${admin.theme}`;
    card.style.setProperty('--admin-primary', theme.primary);
    card.style.setProperty('--admin-secondary', theme.secondary);
    card.style.setProperty('--admin-glow', theme.glow);
    const isChecked = prevSelectedNomor === admin.nomor ? 'checked' : '';
    card.innerHTML = `
      <input type="radio" name="admin" value="${admin.nomor}" data-admin-name="${admin.nama}" class="admin-radio" ${isChecked} required>
      <div class="admin-content">
        <div class="admin-avatar">
          <span class="admin-initial">${admin.initial || admin.nama.slice(0,2).toUpperCase()}</span>
        </div>
        <div class="admin-info">
          <span class="admin-name">${admin.nama}</span>
          <span class="admin-phone">${admin.label}</span>
        </div>
        <div class="admin-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    `;
    if (isChecked) card.classList.add('selected');
    adminGrid.appendChild(card);
  });
  setupAdminCards();
}

// ===== AUTO SLIDESHOW BANNER =====
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
  const fields = ['nama', 'umur', 'usnHotel', 'asalKota', 'alasan'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateFormProgress);
  });
  // Admin selection
  document.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'admin') updateFormProgress();
  });
}

function updateFormProgress() {
  const checks = [
    document.getElementById('nama')?.value.trim().length >= 2,
    (() => { const v = parseInt(document.getElementById('umur')?.value); return !isNaN(v) && v >= 10 && v <= 80; })(),
    document.getElementById('usnHotel')?.value.trim().length >= 2,
    document.getElementById('asalKota')?.value.trim().length >= 2,
    document.getElementById('alasan')?.value.trim().length >= 20,
    !!getSelectedAdmin()
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
  ['namaError','umurError','usnError','kotaError','alasanError','adminError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
  ['nama','umur','usnHotel','asalKota','alasan'].forEach(id => {
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
  if (typingInterval) { clearTimeout(typingInterval); typingInterval = null; }
  isTyping = false;
  let original = input.value; // Simpan nilai asli
  input.value = '';
  input.classList.add('typing-active');
  let charIndex = 0;
  isTyping = true;
  let simValue = '';
  function typeNext() {
    if (!isTyping || charIndex >= text.length) {
      clearTimeout(typingInterval); typingInterval = null; isTyping = false;
      input.classList.remove('typing-active');
      setTimeout(() => {
        // BUG FIX: Kembalikan nilai asli setelah simulasi selesai
        if (input.value === simValue) input.value = original;
      }, 1500);
      return;
    }
    simValue += text[charIndex++];
    input.value = simValue;
    typingInterval = setTimeout(typeNext, Math.random() * 80 + 40);
  }
  setTimeout(typeNext, 400);
}

function stopTypingSimulation() {
  isTyping = false;
  if (typingInterval) { clearTimeout(typingInterval); typingInterval = null; }
  document.querySelectorAll('.typing-active').forEach(el => el.classList.remove('typing-active'));
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
    // BUG FIX: TIDAK hapus nilai input user saat tutorial selesai
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
    btnManual.classList.add('active');
    btnAuto.classList.remove('active');
    asalKotaInput.placeholder = 'Masukkan asal kota';
    asalKotaInput.disabled = false;
    asalKotaInput.value = '';
    locatingIndicator.style.display = 'none';
  } else {
    btnManual.classList.remove('active');
    btnAuto.classList.add('active');
    getCurrentLocation();
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) { showToast('Error', 'Browser tidak mendukung geolokasi'); setLocationMode('manual'); return; }
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
        asalKotaInput.disabled = false;
        locatingIndicator.style.display = 'none'; // BUG FIX: pastikan disembunyikan
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
  asalKotaInput.disabled = false;
  asalKotaInput.placeholder = 'Masukkan asal kota';
  locatingIndicator.style.display = 'none'; // BUG FIX: pastikan selalu disembunyikan
  showToast('Error', message, 3000);
  setLocationMode('manual');
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
function getSelectedAdmin()     { const r = document.querySelector('input[name="admin"]:checked'); return r ? r.value : null; }
function getSelectedAdminName() { const r = document.querySelector('input[name="admin"]:checked'); return r ? r.getAttribute('data-admin-name') : null; }

// ===== WHATSAPP MESSAGE =====
function generateWhatsAppMessage(formData) {
  const date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const communityName = siteSettings.name || 'DEVIL REIGN';
  return `*${communityName} — FORM MEMBER v8.0*\n━━━━━━━━━━━━━━━\n\n📅 *Tanggal:* ${date}\n\n👤 *Nama:* ${formData.nama}\n🎂 *Umur:* ${formData.umur} tahun\n🎮 *USN Hotel Hideaway:* ${formData.usnHotel}\n📍 *Asal Kota:* ${formData.asalKota}\n💬 *Alasan Bergabung:*\n${formData.alasan}\n\n━━━━━━━━━━━━━━━\n*STATUS:* ⏳ MENUNGGU PERSETUJUAN ADMIN\n━━━━━━━━━━━━━━━\n\n۝ ${siteSettings.tagline || 'Satu Reign, Satu Kekuasaan'} ۝`;
}

// ===== SAVE TO FIREBASE =====
async function saveMemberToFirebase(formData) {
  try {
    const member = {
      nama:      formData.nama,
      umur:      formData.umur,
      usnHotel:  formData.usnHotel,
      asalKota:  formData.asalKota,
      alasan:    formData.alasan,
      admin:     formData.admin,
      adminName: formData.adminName,
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
    usnHotel:  document.getElementById('usnHotel').value.trim(),
    asalKota:  document.getElementById('asalKota').value.trim(),
    alasan:    document.getElementById('alasan').value.trim(),
    admin:     getSelectedAdmin(),
    adminName: getSelectedAdminName()
  };

  // Inline validation dengan pesan yang jelas
  let hasError = false;

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

  if (!formData.admin) {
    const adminErr = document.getElementById('adminError');
    if (adminErr) { adminErr.textContent = 'Pilih salah satu admin terlebih dahulu'; adminErr.style.display = 'flex'; }
    document.querySelector('.admin-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      <div class="modal-info-row"><span>👑</span><span>Admin: ${formData.adminName}</span></div>
    `;
  }

  showModal();

  // BUG FIX: Set onclick setiap kali (menggantikan onclick sebelumnya, bukan stacking)
  const modalBtn = document.getElementById('modalContinueBtn');
  if (modalBtn) {
    const handler = () => {
      closeModal();
      const message = encodeURIComponent(generateWhatsAppMessage(formData));
      window.open(`https://wa.me/${formData.admin}?text=${message}`, '_blank');
      setTimeout(() => showToast('Berhasil! ✅', 'Data telah dikirim ke WhatsApp admin', 2500), 500);
      // Reset form setelah dikirim
      setTimeout(() => {
        form.reset();
        clearAllErrors();
        clearDraft();
        setLocationMode('manual');
        updateFormProgress();
        document.querySelectorAll('.admin-card').forEach(c => c.classList.remove('selected'));
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
  const fields = ['nama', 'umur', 'usnHotel', 'asalKota', 'alasan'];
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

// --- Blur Validation (v9.0) ---
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

// ===== EXPORTS V9.0 =====
window.toggleDarkMode  = toggleDarkMode;
window.clearDraft      = clearDraft;

// ===== EXPORTS =====
window.showTutorialAgain        = showTutorialAgain;
window.showAdPopup              = showAdPopup;
window.closeAdPopup             = closeAdPopup;
window.startInteractiveTutorial = startInteractiveTutorial;
window.nextTutorialStep         = nextTutorialStep;
window.skipTutorial             = skipTutorial;
window.scrollToTop              = scrollToTop;
window.closeModal               = closeModal;
window.setLocationMode          = setLocationMode;
window.applyMaintenanceMode     = applyMaintenanceMode;
window.applyDashboardPopup      = applyDashboardPopup;

// Console branding
console.log('%c DEVIL REIGN v8.0 ', 'background:linear-gradient(135deg,#C1121F,#7B0010);color:white;font-size:24px;font-weight:bold;padding:10px 20px;border-radius:10px;');
console.log('%c Firebase Edition v8.0 — v9.0 — Dark Mode, Draft, Countdown, Share, Blur Validation, Pagination, Edit Member, Bug Fixes ', 'color:#C1121F;font-size:14px;');
console.log('%c Crafted by Hironi × Upgraded by Claude v8.0 ', 'color:#666;font-size:12px;');
console.log('%c Changes: char counter, form progress, confetti, inline validation, rate limiting, member count, gallery fullscreen, fixed spinner, fixed ad popup, fixed tutorial input clear, fixed locating indicator ', 'color:#2ECC71;font-size:10px;');
