'use strict';

const DB_KEY = 'santiyeDefteri_v1';
const DB_VER = 1;

function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function defaultData() {
  return { version: DB_VER, activeSiteId: null, sites: [], personnel: [], transactions: [], timesheet: [], payments: [] };
}

let _db = null;

function db() {
  if (!_db) {
    try {
      const raw = localStorage.getItem(DB_KEY);
      _db = raw ? JSON.parse(raw) : defaultData();
    } catch { _db = defaultData(); }
  }
  return _db;
}

function dbSave() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(_db));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Depolama alanı doldu! Lütfen JSON yedek alıp eski kayıtları silin.');
    }
    return false;
  }
}

// ─── Sites ────────────────────────────────────────────────────────────────────

const Sites = {
  all() { return db().sites; },
  get(id) { return db().sites.find(s => s.id === id); },
  active() { return db().sites.find(s => s.id === db().activeSiteId) || null; },
  setActive(id) { db().activeSiteId = id; dbSave(); },
  add(data) {
    const site = { id: uuid(), createdAt: new Date().toISOString(), ...data };
    db().sites.push(site);
    if (!db().activeSiteId) db().activeSiteId = site.id;
    dbSave();
    return site;
  },
  update(id, data) {
    const i = db().sites.findIndex(s => s.id === id);
    if (i >= 0) { Object.assign(db().sites[i], data); dbSave(); }
  },
  delete(id) {
    db().sites       = db().sites.filter(s => s.id !== id);
    db().personnel   = db().personnel.filter(p => p.siteId !== id);
    db().transactions= db().transactions.filter(t => t.siteId !== id);
    db().timesheet   = db().timesheet.filter(t => t.siteId !== id);
    db().payments    = db().payments.filter(p => p.siteId !== id);
    if (db().activeSiteId === id) db().activeSiteId = db().sites[0]?.id || null;
    dbSave();
  }
};

// ─── Personnel ────────────────────────────────────────────────────────────────

const Personnel = {
  all(siteId) { return db().personnel.filter(p => p.siteId === (siteId ?? db().activeSiteId)); },
  get(id) { return db().personnel.find(p => p.id === id); },
  add(data) {
    const p = { id: uuid(), siteId: db().activeSiteId, active: true, createdAt: new Date().toISOString(), ...data };
    db().personnel.push(p);
    dbSave();
    return p;
  },
  update(id, data) {
    const i = db().personnel.findIndex(p => p.id === id);
    if (i >= 0) { Object.assign(db().personnel[i], data); dbSave(); }
  },
  delete(id) {
    db().personnel = db().personnel.filter(p => p.id !== id);
    db().timesheet = db().timesheet.filter(t => t.personnelId !== id);
    db().payments  = db().payments.filter(p => p.personnelId !== id);
    dbSave();
  }
};

// ─── Transactions (Gelir/Gider) ───────────────────────────────────────────────

const Transactions = {
  all(siteId) {
    return db().transactions
      .filter(t => t.siteId === (siteId ?? db().activeSiteId))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  get(id) { return db().transactions.find(t => t.id === id); },
  add(data) {
    const t = { id: uuid(), siteId: db().activeSiteId, createdAt: new Date().toISOString(), ...data };
    db().transactions.push(t);
    dbSave();
    return t;
  },
  update(id, data) {
    const i = db().transactions.findIndex(t => t.id === id);
    if (i >= 0) { Object.assign(db().transactions[i], data); dbSave(); }
  },
  delete(id) {
    db().transactions = db().transactions.filter(t => t.id !== id);
    dbSave();
  }
};

// ─── Timesheet ────────────────────────────────────────────────────────────────

const Timesheet = {
  all(siteId) { return db().timesheet.filter(t => t.siteId === (siteId ?? db().activeSiteId)); },
  forPersonnel(personnelId, siteId) {
    return db().timesheet.filter(t => t.personnelId === personnelId && t.siteId === (siteId ?? db().activeSiteId));
  },
  forMonth(year, month, siteId) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return db().timesheet.filter(t => t.siteId === (siteId ?? db().activeSiteId) && t.date.startsWith(prefix));
  },
  getByPersonnelDate(personnelId, date) {
    return db().timesheet.find(t => t.personnelId === personnelId && t.date === date && t.siteId === db().activeSiteId);
  },
  upsert(data) {
    const existing = this.getByPersonnelDate(data.personnelId, data.date);
    if (existing) {
      Object.assign(existing, data);
      dbSave();
      return existing;
    }
    const t = { id: uuid(), siteId: db().activeSiteId, createdAt: new Date().toISOString(), ...data };
    db().timesheet.push(t);
    dbSave();
    return t;
  },
  delete(id) {
    db().timesheet = db().timesheet.filter(t => t.id !== id);
    dbSave();
  },
  deleteByPersonnelDate(personnelId, date) {
    db().timesheet = db().timesheet.filter(t => !(t.personnelId === personnelId && t.date === date && t.siteId === db().activeSiteId));
    dbSave();
  }
};

// ─── Payments ─────────────────────────────────────────────────────────────────

const Payments = {
  all(siteId) { return db().payments.filter(p => p.siteId === (siteId ?? db().activeSiteId)); },
  forPersonnel(personnelId, siteId) {
    return db().payments.filter(p => p.personnelId === personnelId && p.siteId === (siteId ?? db().activeSiteId));
  },
  get(id) { return db().payments.find(p => p.id === id); },
  add(data) {
    const p = { id: uuid(), siteId: db().activeSiteId, createdAt: new Date().toISOString(), ...data };
    db().payments.push(p);
    dbSave();
    return p;
  },
  delete(id) {
    db().payments = db().payments.filter(p => p.id !== id);
    dbSave();
  }
};

// ─── Hakediş Hesabı ───────────────────────────────────────────────────────────

function calcHakedis(personnelId, siteId) {
  const person = Personnel.get(personnelId);
  if (!person) return { hakedis: 0, odenen: 0, kalan: 0 };

  const entries = Timesheet.forPersonnel(personnelId, siteId);
  let hakedis = 0;

  for (const e of entries) {
    if (person.wageType === 'gunluk') {
      const rate = Number(person.dailyRate) || 0;
      hakedis += (Number(e.dayValue) || 0) * rate;
      hakedis += (Number(e.overtimeHours) || 0) * (rate / 8) * 1.5;
    } else {
      const rate = Number(person.hourlyRate) || 0;
      hakedis += (Number(e.hours) || 0) * rate;
      hakedis += (Number(e.overtimeHours) || 0) * rate * 1.5;
    }
  }

  const odenen = Payments.forPersonnel(personnelId, siteId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { hakedis: Math.round(hakedis * 100) / 100, odenen: Math.round(odenen * 100) / 100, kalan: Math.round((hakedis - odenen) * 100) / 100 };
}

// ─── Yedek ───────────────────────────────────────────────────────────────────

function resetDB() { _db = null; }

function exportDB() { return JSON.stringify(db(), null, 2); }

function importDB(json) {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data.sites) || !Array.isArray(data.personnel)) throw new Error('Geçersiz format');
    _db = data;
    dbSave();
    return true;
  } catch (e) {
    alert('Yedek yüklenemedi: ' + e.message);
    return false;
  }
}

// ─── Kategoriler ──────────────────────────────────────────────────────────────

const CATEGORIES = {
  gelir: ['Hakediş ödemesi', 'Avans', 'Daire/Dükkan satışı', 'İşveren ödemesi', 'Banka kredisi', 'Diğer'],
  kaba:  ['Hafriyat', 'Kalıp', 'Demir/Çelik', 'Beton döküm', 'Duvar örme', 'İskele', 'Kaba tesisat', 'Çatı', 'Su yalıtım', 'Diğer'],
  ince:  ['Sıva', 'Şap', 'Boya/Badana', 'Seramik/Fayans', 'Alçıpan', 'Asma tavan', 'Kapı/Pencere', 'Doğalgaz', 'Elektrik', 'Sıhhi tesisat', 'Mutfak/Banyo', 'Mermer/Granit', 'Peyzaj', 'Isıtma/Soğutma', 'Diğer'],
  genel: ['Nakliye', 'Yakıt', 'Makine kirası', 'Malzeme genel', 'İşçilik genel', 'Vergi/Harç', 'Sigorta', 'Ofis/Kırtasiye', 'Yemek/İçecek', 'Diğer']
};

const ODEME_YONTEMLERI = ['Nakit', 'Havale/EFT', 'Çek', 'Senet', 'Kredi kartı', 'Diğer'];

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TR_DAYS   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
