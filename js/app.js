'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatCurrency(n) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d} ${TR_MONTHS[parseInt(m) - 1]} ${y}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStr(year, month) {
  return `${TR_MONTHS[month - 1]} ${year}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
}

function getInitials(name) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast${type ? ' t-' + type : ''}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

function confirmDialog(msg, btnLabel = 'Sil', btnClass = 'btn-danger') {
  return new Promise(resolve => {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-message').textContent = msg;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = btnLabel;
    okBtn.className = 'btn ' + btnClass;
    const cancel = document.getElementById('confirm-cancel');

    const cleanup = (result) => {
      modal.close();
      okBtn.onclick = null;
      cancel.onclick = null;
      resolve(result);
    };
    okBtn.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
    modal.showModal();
    modal.addEventListener('cancel', () => resolve(false), { once: true });
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

let _currentSection = 'panel';

function navigate(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  document.querySelectorAll('.top-nav a, .nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.section === id);
  });

  _currentSection = id;

  switch (id) {
    case 'panel':      PanelMgr.render(); break;
    case 'gelir-gider': AccountingMgr.render(); break;
    case 'personel':   PersonnelMgr.render(); break;
    case 'puantaj':    TimesheetMgr.render(); break;
    case 'raporlar':   ReportsMgr.render(); break;
    case 'santiyeler': SitesMgr.render(); break;
    case 'yedek':      BackupMgr.render(); break;
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

function renderHeader() {
  const sel = document.getElementById('site-selector');
  const sites = Sites.all();
  const activeId = db().activeSiteId;

  if (!sites.length) {
    sel.innerHTML = '<option value="">Şantiye yok</option>';
    sel.disabled = true;
  } else {
    sel.disabled = false;
    sel.innerHTML = sites.map(s =>
      `<option value="${escHtml(s.id)}" ${s.id === activeId ? 'selected' : ''}>${escHtml(s.name)}</option>`
    ).join('');
  }
}

// ─── Initialization ────────────────────────────────────────────────────────────

function initApp() {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Header site selector
  document.getElementById('site-selector').addEventListener('change', e => {
    Sites.setActive(e.target.value);
    renderHeader();
    navigate(_currentSection);
  });

  // Navigation (top + bottom)
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.section);
    });
  });

  // More menu toggle
  const moreBtn  = document.getElementById('nav-more-btn');
  const moreMenu = document.getElementById('more-menu');
  if (moreBtn) {
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      moreMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => moreMenu.classList.add('hidden'));
    moreMenu.querySelectorAll('[data-section]').forEach(a => {
      a.addEventListener('click', () => moreMenu.classList.add('hidden'));
    });
  }

  // New site shortcut from header
  document.getElementById('btn-new-site').addEventListener('click', () => {
    SitesMgr.showModal();
  });

  // Close dialogs on backdrop click
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });

  renderHeader();

  // Warn if no site
  if (!Sites.all().length) {
    navigate('santiyeler');
    setTimeout(() => SitesMgr.showModal(), 300);
  } else {
    navigate('panel');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
