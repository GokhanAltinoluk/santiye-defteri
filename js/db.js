'use strict';

const DB_KEY = 'santiyeDefteri_v1';
const DB_VER = 1;

function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function defaultData() {
  return { version: DB_VER, activeSiteId: null, sites: [], personnel: [], transactions: [], timesheet: [], payments: [], workItems: [], workItemEntries: [] };
}

let _db = null;

function db() {
  if (!_db) {
    try {
      const raw = localStorage.getItem(DB_KEY);
      _db = raw ? JSON.parse(raw) : defaultData();
      // Backwards compatibility: add new fields if missing
      if (!_db.workItems) _db.workItems = [];
      if (!_db.workItemEntries) _db.workItemEntries = [];
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
    db().sites           = db().sites.filter(s => s.id !== id);
    db().personnel       = db().personnel.filter(p => p.siteId !== id);
    db().transactions    = db().transactions.filter(t => t.siteId !== id);
    db().timesheet       = db().timesheet.filter(t => t.siteId !== id);
    db().payments        = db().payments.filter(p => p.siteId !== id);
    db().workItems       = db().workItems.filter(w => w.siteId !== id);
    db().workItemEntries = db().workItemEntries.filter(e => e.siteId !== id);
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

const BIRIMLER = ['m²', 'm³', 'm', 'kg', 'ton', 'adet', 'ls (götürü)', 'set', 'takım', 'diğer'];

// ─── İş Kalemleri Kataloğu ────────────────────────────────────────────────────

const KATALOG = [
  // ══ KABA İŞLER ══
  {
    id: 'hafriyat',
    baslik: 'Hafriyat ve Zemin İşleri',
    workType: 'kaba',
    kalemler: [
      { ad: 'Hafriyat (makine ile)',          birim: 'm³'  },
      { ad: 'Hafriyat (elle)',                 birim: 'm³'  },
      { ad: 'Temel kazısı',                    birim: 'm³'  },
      { ad: 'Temel altı dolgu (kum/çakıl)',    birim: 'm³'  },
      { ad: 'Moloz taşıma ve nakli',           birim: 'm³'  },
      { ad: 'Saha tesviyesi',                  birim: 'm²'  },
      { ad: 'Zemin sıkıştırma',               birim: 'm²'  },
      { ad: 'Drenaj borusu döşeme',            birim: 'm'   },
      { ad: 'Kazık çakma',                     birim: 'adet'},
    ]
  },
  {
    id: 'temel',
    baslik: 'Temel Yapım',
    workType: 'kaba',
    kalemler: [
      { ad: 'Grobeton (temel altı)',           birim: 'm³'  },
      { ad: 'Temel kalıbı',                    birim: 'm²'  },
      { ad: 'Temel demir donatısı',            birim: 'ton' },
      { ad: 'Temel betonu dökümü',             birim: 'm³'  },
      { ad: 'Radye temel betonu',              birim: 'm³'  },
      { ad: 'Sürekli temel betonu',            birim: 'm³'  },
      { ad: 'Temel su yalıtımı',               birim: 'm²'  },
      { ad: 'Temel drenajı (Fransız drenajı)', birim: 'm'   },
      { ad: 'Zemin iyileştirme',               birim: 'm²'  },
    ]
  },
  {
    id: 'kalip',
    baslik: 'Kalıp İşleri',
    workType: 'kaba',
    kalemler: [
      { ad: 'Kolon kalıbı',                   birim: 'm²'  },
      { ad: 'Kiriş kalıbı',                    birim: 'm²'  },
      { ad: 'Döşeme kalıbı',                   birim: 'm²'  },
      { ad: 'Perde/Duvar kalıbı',              birim: 'm²'  },
      { ad: 'Merdiven kalıbı',                 birim: 'm²'  },
      { ad: 'Tünel kalıp sistemi',             birim: 'm²'  },
      { ad: 'Metal kalıp kiralama',            birim: 'm²'  },
    ]
  },
  {
    id: 'demir',
    baslik: 'Demir/Çelik Donatı',
    workType: 'kaba',
    kalemler: [
      { ad: 'Nervürlü demir donatı (kolon)',   birim: 'ton' },
      { ad: 'Nervürlü demir donatı (kiriş)',   birim: 'ton' },
      { ad: 'Nervürlü demir donatı (döşeme)',  birim: 'ton' },
      { ad: 'Nervürlü demir donatı (perde)',   birim: 'ton' },
      { ad: 'Hasır çelik (döşeme)',            birim: 'ton' },
      { ad: 'Çelik konstrüksiyon',             birim: 'ton' },
      { ad: 'Demir bükme ve bağlama işçiliği', birim: 'ton' },
    ]
  },
  {
    id: 'beton',
    baslik: 'Beton Dökümü',
    workType: 'kaba',
    kalemler: [
      { ad: 'Kolon betonu (hazır beton)',       birim: 'm³' },
      { ad: 'Kiriş betonu (hazır beton)',       birim: 'm³' },
      { ad: 'Döşeme betonu (hazır beton)',      birim: 'm³' },
      { ad: 'Perde beton dökümü',               birim: 'm³' },
      { ad: 'Merdiven betonu',                  birim: 'm³' },
      { ad: 'Beton pompalama',                  birim: 'm³' },
      { ad: 'Beton vibrasyon işçiliği',         birim: 'm³' },
      { ad: 'Şap betonu (iç zemin)',            birim: 'm²' },
    ]
  },
  {
    id: 'duvar',
    baslik: 'Duvar Örme',
    workType: 'kaba',
    kalemler: [
      { ad: 'Tuğla duvar (19 cm)',              birim: 'm²' },
      { ad: 'Tuğla duvar (13,5 cm)',            birim: 'm²' },
      { ad: 'Tuğla bölme duvar (8,5 cm)',       birim: 'm²' },
      { ad: 'Gazbeton/AAC duvar (20 cm)',        birim: 'm²' },
      { ad: 'Gazbeton/AAC duvar (10 cm)',        birim: 'm²' },
      { ad: 'Briket/Bims blok duvar',           birim: 'm²' },
      { ad: 'Brüt beton blok duvar',            birim: 'm²' },
      { ad: 'Yığma taş duvar',                  birim: 'm²' },
    ]
  },
  {
    id: 'cati',
    baslik: 'Çatı Yapımı',
    workType: 'kaba',
    kalemler: [
      { ad: 'Çatı makası (ahşap)',             birim: 'm²' },
      { ad: 'Çatı makası (çelik)',             birim: 'm²' },
      { ad: 'Kiremit çatı örtüsü',             birim: 'm²' },
      { ad: 'Metal trapez sac örtüsü',         birim: 'm²' },
      { ad: 'Bitümlü ondülin örtü',            birim: 'm²' },
      { ad: 'Çatı ısı yalıtımı',              birim: 'm²' },
      { ad: 'Çatı su yalıtımı (bitüm membran)',birim: 'm²' },
      { ad: 'Çatı drenaj oluğu (oluk/iniş borusu)', birim: 'm' },
      { ad: 'Teras çatı – tesviye betonu',     birim: 'm²' },
      { ad: 'Teras çatı – yalıtım ve kaplama', birim: 'm²' },
    ]
  },
  {
    id: 'yalitim-kaba',
    baslik: 'Su ve Isı Yalıtımı (Kaba)',
    workType: 'kaba',
    kalemler: [
      { ad: 'Temel su yalıtımı (membran)',     birim: 'm²' },
      { ad: 'Bodrum duvar su yalıtımı',        birim: 'm²' },
      { ad: 'Islak zemin su yalıtımı',         birim: 'm²' },
      { ad: 'Çatı su yalıtımı (poliüretan)',   birim: 'm²' },
      { ad: 'Isı yalıtımı (XPS levha)',        birim: 'm²' },
      { ad: 'Isı yalıtımı (EPS levha)',        birim: 'm²' },
      { ad: 'Perlit/vermikülit ısı yalıtımı',  birim: 'm²' },
    ]
  },
  {
    id: 'iskele',
    baslik: 'İskele ve Kaldırma Ekipmanı',
    workType: 'kaba',
    kalemler: [
      { ad: 'Metal bina iskelesi kurulum+söküm', birim: 'm²' },
      { ad: 'Çevre güvenlik ağı',              birim: 'm²' },
      { ad: 'İnşaat asansörü (yük)',           birim: 'adet'},
      { ad: 'Kule vinç kiralama',              birim: 'ay'  },
      { ad: 'Mobil vinç (günlük)',             birim: 'gün' },
      { ad: 'Beton mikseri kiralama',          birim: 'ay'  },
    ]
  },
  {
    id: 'kaba-tesisat',
    baslik: 'Kaba Tesisat Altyapısı',
    workType: 'kaba',
    kalemler: [
      { ad: 'Elektrik kanalı (pvc boru) döşeme',birim: 'm'  },
      { ad: 'Pis su borusu (kaba)',             birim: 'm'  },
      { ad: 'Temiz su borusu (kaba)',           birim: 'm'  },
      { ad: 'Doğalgaz borusu (kaba hat)',       birim: 'm'  },
      { ad: 'Kolon geçiş delikleri',            birim: 'adet'},
      { ad: 'Parapete/lento yerleştirme',       birim: 'adet'},
      { ad: 'Yangın merdiveni yapımı',          birim: 'adet'},
      { ad: 'Asansör kuyusu yapımı',            birim: 'adet'},
    ]
  },

  // ══ İNCE İŞLER ══
  {
    id: 'siva',
    baslik: 'Sıva ve Şap',
    workType: 'ince',
    kalemler: [
      { ad: 'İç sıva (çimento/kireç)',         birim: 'm²' },
      { ad: 'İç sıva (alçı)',                  birim: 'm²' },
      { ad: 'Dış sıva (kaba)',                 birim: 'm²' },
      { ad: 'Dış sıva (ince – perdahlı)',      birim: 'm²' },
      { ad: 'Tavan sıvası',                    birim: 'm²' },
      { ad: 'Şap (iç zemin)',                  birim: 'm²' },
      { ad: 'Şap (ısıtmalı zemin üstü)',       birim: 'm²' },
      { ad: 'Dış derz dolgusu',                birim: 'm'  },
    ]
  },
  {
    id: 'boya',
    baslik: 'Boya ve Badana',
    workType: 'ince',
    kalemler: [
      { ad: 'İç duvar boyası (plastik)',        birim: 'm²' },
      { ad: 'İç tavan boyası',                  birim: 'm²' },
      { ad: 'Dış cephe boyası',                 birim: 'm²' },
      { ad: 'Yağlı boya (kapı/pencere kasası)', birim: 'm²' },
      { ad: 'Astar/Penetrasyon',                birim: 'm²' },
      { ad: 'Badana (iç)',                      birim: 'm²' },
      { ad: 'Dekoratif sıva/boya',              birim: 'm²' },
      { ad: 'Metal boya (demir korkuluk vb.)',  birim: 'm²' },
      { ad: 'Vernik (ahşap yüzey)',             birim: 'm²' },
    ]
  },
  {
    id: 'seramik',
    baslik: 'Seramik, Fayans ve Zemin Kaplaması',
    workType: 'ince',
    kalemler: [
      { ad: 'Duvar seramiği / fayans',          birim: 'm²' },
      { ad: 'Zemin seramiği (iç)',              birim: 'm²' },
      { ad: 'Zemin seramiği (dış/balkon)',      birim: 'm²' },
      { ad: 'Porselen granit döşeme',           birim: 'm²' },
      { ad: 'Parke (ahşap, masif)',             birim: 'm²' },
      { ad: 'Laminat parke döşeme',             birim: 'm²' },
      { ad: 'Esnek zemin kaplaması (vinil/PVC)',birim: 'm²' },
      { ad: 'Mermer/Traverten zemin',           birim: 'm²' },
      { ad: 'Halı döşeme',                      birim: 'm²' },
      { ad: 'Seramik derz dolgusu',             birim: 'm²' },
    ]
  },
  {
    id: 'mermer',
    baslik: 'Mermer, Granit ve Doğal Taş',
    workType: 'ince',
    kalemler: [
      { ad: 'Mermer merdiven basamağı',         birim: 'm'  },
      { ad: 'Mermer eşik',                      birim: 'adet'},
      { ad: 'Mermer denizlik (pencere)',         birim: 'adet'},
      { ad: 'Granit tezgah (mutfak)',           birim: 'm'  },
      { ad: 'Mermer kaplama (iç duvar)',        birim: 'm²' },
      { ad: 'Doğal taş cephe kaplaması',        birim: 'm²' },
      { ad: 'Mermer zemin cilalama',            birim: 'm²' },
    ]
  },
  {
    id: 'kapi-pencere',
    baslik: 'Kapı ve Pencere',
    workType: 'ince',
    kalemler: [
      { ad: 'PVC pencere (ısıcam)',             birim: 'm²' },
      { ad: 'Alüminyum pencere (ısı köprüsüz)', birim: 'm²' },
      { ad: 'Ahşap pencere',                    birim: 'm²' },
      { ad: 'İç kapı (ahşap, takımı)',          birim: 'adet'},
      { ad: 'Çelik kapı (apartman girişi)',     birim: 'adet'},
      { ad: 'Yangın kapısı',                    birim: 'adet'},
      { ad: 'Garaj kapısı (otomatik)',          birim: 'adet'},
      { ad: 'Balkon kapısı (sürme/kanatlı)',    birim: 'adet'},
      { ad: 'Pencere panjur/kepenk',            birim: 'm²' },
      { ad: 'Cam balkon sistemi',               birim: 'm²' },
    ]
  },
  {
    id: 'alcipan',
    baslik: 'Alçıpan ve Asma Tavan',
    workType: 'ince',
    kalemler: [
      { ad: 'Alçıpan bölme duvar (tek kat)',    birim: 'm²' },
      { ad: 'Alçıpan bölme duvar (çift kat)',   birim: 'm²' },
      { ad: 'Alçıpan asma tavan (düz)',         birim: 'm²' },
      { ad: 'Alçıpan asma tavan (kademeli)',    birim: 'm²' },
      { ad: 'Metal profil asma tavan',          birim: 'm²' },
      { ad: 'Gergi tavan',                      birim: 'm²' },
      { ad: 'Alçı kartonpiyer',                 birim: 'm'  },
      { ad: 'Alçı rozet/tavan göbeği',          birim: 'adet'},
    ]
  },
  {
    id: 'elektrik',
    baslik: 'Elektrik Tesisatı',
    workType: 'ince',
    kalemler: [
      { ad: 'Elektrik kablolama (kuvvet hattı)',birim: 'm'  },
      { ad: 'Priz (topraklı, çerçeveli)',       birim: 'adet'},
      { ad: 'Anahtar (tek, çift, komütatör)',   birim: 'adet'},
      { ad: 'Sigorta kutusu/Dağıtım panosu',   birim: 'adet'},
      { ad: 'Aydınlatma armatürü montajı',      birim: 'adet'},
      { ad: 'Spot aydınlatma',                  birim: 'adet'},
      { ad: 'TV/Uydu bağlantı prizi',           birim: 'adet'},
      { ad: 'İnternet/Data prizi',              birim: 'adet'},
      { ad: 'Zil/İnterkom sistemi',             birim: 'adet'},
      { ad: 'Yangın alarm sistemi',             birim: 'ls' },
    ]
  },
  {
    id: 'sihhi',
    baslik: 'Sıhhi Tesisat',
    workType: 'ince',
    kalemler: [
      { ad: 'Temiz su borusu (ince)',           birim: 'm'  },
      { ad: 'Pis su/Atık su borusu (ince)',     birim: 'm'  },
      { ad: 'Su sayacı ve bağlantısı',          birim: 'adet'},
      { ad: 'Klozet (asma/yerden) montajı',     birim: 'adet'},
      { ad: 'Lavabo montajı',                   birim: 'adet'},
      { ad: 'Banyo teknesi/Küvet montajı',      birim: 'adet'},
      { ad: 'Duş teknesi montajı',              birim: 'adet'},
      { ad: 'Duşakabin montajı',                birim: 'adet'},
      { ad: 'Musluk ve batarya montajı',        birim: 'adet'},
      { ad: 'Mutfak eviyesi montajı',           birim: 'adet'},
      { ad: 'Çamaşır makinesi/Bulaşık çıkışı', birim: 'adet'},
    ]
  },
  {
    id: 'isitma',
    baslik: 'Isıtma, Soğutma ve Doğalgaz',
    workType: 'ince',
    kalemler: [
      { ad: 'Doğalgaz borusu (daire içi)',      birim: 'm'  },
      { ad: 'Doğalgaz sayacı bağlantısı',       birim: 'adet'},
      { ad: 'Kombi montajı',                    birim: 'adet'},
      { ad: 'Kalorifer radyatörü montajı',      birim: 'adet'},
      { ad: 'Yerden ısıtma borusu döşeme',      birim: 'm²' },
      { ad: 'Klima (split) montajı',            birim: 'adet'},
      { ad: 'VRF/Merkezi klima sistemi',        birim: 'ls' },
      { ad: 'Havalandırma/Fan-coil sistemi',    birim: 'adet'},
      { ad: 'Şofben/Su ısıtıcı montajı',        birim: 'adet'},
    ]
  },
  {
    id: 'mutfak-banyo',
    baslik: 'Mutfak ve Banyo Donanımı',
    workType: 'ince',
    kalemler: [
      { ad: 'Mutfak dolabı (alt)',              birim: 'm'  },
      { ad: 'Mutfak dolabı (üst)',              birim: 'm'  },
      { ad: 'Mutfak tezgah üstü (granit)',      birim: 'm'  },
      { ad: 'Davlumbaz montajı',                birim: 'adet'},
      { ad: 'Ankastre fırın montajı',           birim: 'adet'},
      { ad: 'Ankastre ocak montajı',            birim: 'adet'},
      { ad: 'Banyo dolabı/Lavabo ünitesi',      birim: 'adet'},
      { ad: 'Banyo aynası',                     birim: 'adet'},
      { ad: 'Aksesuarlar (havluluk, sabunluk)', birim: 'set'},
    ]
  },
  {
    id: 'cephe',
    baslik: 'Dış Cephe ve Mantolama',
    workType: 'ince',
    kalemler: [
      { ad: 'Isı yalıtım sistemi – mantolama (EPS)', birim: 'm²' },
      { ad: 'Isı yalıtım sistemi – mantolama (XPS)', birim: 'm²' },
      { ad: 'Dekoratif dış cephe sıvası',       birim: 'm²' },
      { ad: 'Dış cephe boyası (silikon bazlı)', birim: 'm²' },
      { ad: 'Taş/Klinker tuğla cephe kaplaması',birim: 'm²' },
      { ad: 'Alüminyum kompozit cephe paneli',  birim: 'm²' },
      { ad: 'Dış derz ve profil işleri',        birim: 'm'  },
    ]
  },
  {
    id: 'merdiven-korkuluk',
    baslik: 'Merdiven ve Korkuluk',
    workType: 'ince',
    kalemler: [
      { ad: 'Mermer merdiven basamağı kaplaması',birim: 'm²'},
      { ad: 'Granit merdiven kaplaması',         birim: 'm²'},
      { ad: 'Çelik/Paslanmaz korkuluk',         birim: 'm'  },
      { ad: 'Ahşap merdiven korkuluğu',         birim: 'm'  },
      { ad: 'Cam korkuluk sistemi',             birim: 'm'  },
      { ad: 'Küpeşte (küpeşte profili)',        birim: 'm'  },
    ]
  },
  {
    id: 'peyzaj',
    baslik: 'Peyzaj ve Çevre Düzenleme',
    workType: 'ince',
    kalemler: [
      { ad: 'Bordür taşı döşeme',               birim: 'm'  },
      { ad: 'Parke taşı döşeme (dış)',          birim: 'm²' },
      { ad: 'Beton yaya yolu',                  birim: 'm²' },
      { ad: 'Bahçe duvarı / Çevre duvarı',      birim: 'm²' },
      { ad: 'Çim ekim/Çim serme',               birim: 'm²' },
      { ad: 'Ağaç/Fidan dikimi',                birim: 'adet'},
      { ad: 'Bahçe sulama sistemi',             birim: 'ls' },
      { ad: 'Çevre aydınlatması',               birim: 'adet'},
      { ad: 'Otopark kaplaması/çizgileri',      birim: 'm²' },
    ]
  },

  // ══ GENEL ══
  {
    id: 'nakliye',
    baslik: 'Nakliye ve Temizlik',
    workType: 'genel',
    kalemler: [
      { ad: 'Malzeme nakliyesi',                birim: 'sefer'},
      { ad: 'Moloz/hafriyat nakliyesi',         birim: 'm³'  },
      { ad: 'Konteyner/moloz bırakma',          birim: 'adet'},
      { ad: 'Şantiye günlük temizliği',         birim: 'gün' },
      { ad: 'Teslim temizliği (son kat)',        birim: 'm²'  },
    ]
  },
  {
    id: 'makine',
    baslik: 'Makine ve Ekipman Giderleri',
    workType: 'genel',
    kalemler: [
      { ad: 'Yakıt (dizel/benzin)',              birim: 'litre'},
      { ad: 'Ekskavatör kiralama',               birim: 'gün'  },
      { ad: 'Greyder/Silindir kiralama',         birim: 'gün'  },
      { ad: 'Kompresör kiralama',                birim: 'gün'  },
      { ad: 'Jeneratör kiralama',                birim: 'ay'   },
      { ad: 'Alet takımı / El aletleri',         birim: 'ls'   },
    ]
  },
  {
    id: 'genel-gider',
    baslik: 'Genel Giderler',
    workType: 'genel',
    kalemler: [
      { ad: 'Şantiye kurulum masrafları',        birim: 'ls'   },
      { ad: 'Şantiye elektrik tüketimi',         birim: 'ay'   },
      { ad: 'Şantiye su tüketimi',               birim: 'ay'   },
      { ad: 'Sigorta (inşaat all-risk)',         birim: 'ay'   },
      { ad: 'Yapı denetim ücreti',               birim: 'ay'   },
      { ad: 'Vergi ve harçlar',                  birim: 'ls'   },
      { ad: 'Proje/Mühendislik hizmetleri',      birim: 'ls'   },
      { ad: 'Şantiye güvenlik / bekçi',          birim: 'ay'   },
      { ad: 'İşçi yemek ve ulaşım',             birim: 'ay'   },
      { ad: 'Kişisel koruyucu ekipman (KKE)',    birim: 'set'  },
    ]
  },
];

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TR_DAYS   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

// ─── İş Kalemleri ─────────────────────────────────────────────────────────────

const WorkItems = {
  all(siteId) { return db().workItems.filter(w => w.siteId === (siteId ?? db().activeSiteId)); },
  get(id) { return db().workItems.find(w => w.id === id); },
  add(data) {
    const w = { id: uuid(), siteId: db().activeSiteId, createdAt: new Date().toISOString(), ...data };
    db().workItems.push(w);
    dbSave(); return w;
  },
  update(id, data) {
    const i = db().workItems.findIndex(w => w.id === id);
    if (i >= 0) { Object.assign(db().workItems[i], data); dbSave(); }
  },
  delete(id) {
    db().workItems       = db().workItems.filter(w => w.id !== id);
    db().workItemEntries = db().workItemEntries.filter(e => e.workItemId !== id);
    dbSave();
  }
};

const WorkItemEntries = {
  all(siteId) { return db().workItemEntries.filter(e => e.siteId === (siteId ?? db().activeSiteId)); },
  forItem(workItemId, siteId) {
    return db().workItemEntries
      .filter(e => e.workItemId === workItemId && e.siteId === (siteId ?? db().activeSiteId))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  get(id) { return db().workItemEntries.find(e => e.id === id); },
  add(data) {
    const e = { id: uuid(), siteId: db().activeSiteId, createdAt: new Date().toISOString(), ...data };
    db().workItemEntries.push(e);
    dbSave(); return e;
  },
  delete(id) {
    db().workItemEntries = db().workItemEntries.filter(e => e.id !== id);
    dbSave();
  }
};

// Kaleme ait gerçekleşen miktar ve maliyet
function calcWorkItemProgress(workItemId, siteId) {
  const item    = WorkItems.get(workItemId);
  if (!item) return { gercekMiktar: 0, gercekMaliyet: 0, pct: 0 };
  const entries = WorkItemEntries.forItem(workItemId, siteId);
  const gercekMiktar  = entries.reduce((s, e) => s + (Number(e.qty) || 0), 0);
  const unitPrice     = Number(item.unitPrice) || 0;
  const targetQty     = Number(item.targetQty) || 0;
  const gercekMaliyet = gercekMiktar * unitPrice;
  const hedefMaliyet  = targetQty * unitPrice;
  const pct           = targetQty > 0 ? Math.min(100, Math.round((gercekMiktar / targetQty) * 100)) : null;
  return { gercekMiktar, gercekMaliyet, hedefMaliyet, pct, targetQty, unitPrice };
}
