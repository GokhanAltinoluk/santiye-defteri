'use strict';

const WorkItemsMgr = {
  _editId:       null,
  _filterWT:     '',
  _detailItemId: null,

  render() {
    const site = Sites.active();
    const el   = document.getElementById('workitems-list');

    if (!site) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏗️</div><div class="empty-title">Önce şantiye seçin</div></div>';
      this._renderSummary([], []);
      return;
    }

    let items = WorkItems.all();
    if (this._filterWT) items = items.filter(w => w.workType === this._filterWT);
    items.sort((a, b) => {
      const o = { kaba: 0, ince: 1, genel: 2 };
      return (o[a.workType] ?? 3) - (o[b.workType] ?? 3) || (a.name || '').localeCompare(b.name || '', 'tr');
    });

    this._renderSummary(WorkItems.all(), WorkItemEntries.all());

    if (!items.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📐</div>
          <div class="empty-title">İş kalemi eklenmedi</div>
          <div class="empty-desc">Metraj/keşif listesi oluşturmak için "+" butonuna tıklayın.</div>
        </div>`;
      return;
    }

    const wtLabel = { kaba: 'Kaba İş', ince: 'İnce İş', genel: 'Genel' };
    const wtBadge = { kaba: 'badge-kaba', ince: 'badge-ince', genel: 'badge-genel' };

    el.innerHTML = items.map(w => {
      const { gercekMiktar, gercekMaliyet, hedefMaliyet, pct, targetQty, unitPrice } = calcWorkItemProgress(w.id);
      const pctDisp  = pct !== null ? pct : null;
      const barColor = pctDisp === null ? '#9ca3af' : pctDisp >= 100 ? 'var(--success)' : pctDisp >= 50 ? 'var(--primary)' : 'var(--danger)';
      const barWidth = pctDisp !== null ? Math.min(100, pctDisp) : 0;

      return `
        <div class="wi-card card">
          <div class="wi-card-top">
            <div class="wi-card-info">
              <div class="wi-name">${escHtml(w.name)}</div>
              <div class="wi-meta">
                <span class="badge ${wtBadge[w.workType] || 'badge-gray'}">${wtLabel[w.workType] || w.workType}</span>
                <span class="text-xs text-secondary">${escHtml(w.unit)}</span>
                ${w.notes ? `<span class="text-xs text-secondary">· ${escHtml(w.notes)}</span>` : ''}
              </div>
            </div>
            <div class="wi-card-actions">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="WorkItemsMgr.showModal('${w.id}')" title="Düzenle">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="WorkItemsMgr.delete('${w.id}')" title="Sil">🗑️</button>
            </div>
          </div>

          <div class="wi-progress-row">
            <div class="wi-progress-bar-wrap">
              <div class="wi-progress-bar" style="width:${barWidth}%;background:${barColor}"></div>
            </div>
            <span class="wi-pct">${pctDisp !== null ? pctDisp + '%' : '—'}</span>
          </div>

          <div class="wi-stats">
            <div class="wi-stat">
              <div class="wi-stat-label">Hedef Miktar</div>
              <div class="wi-stat-val">${targetQty > 0 ? targetQty + ' ' + escHtml(w.unit) : '—'}</div>
            </div>
            <div class="wi-stat">
              <div class="wi-stat-label">Gerçekleşen</div>
              <div class="wi-stat-val" style="color:${gercekMiktar>0?'var(--info)':'var(--text-3)'}">${gercekMiktar > 0 ? gercekMiktar + ' ' + escHtml(w.unit) : '—'}</div>
            </div>
            <div class="wi-stat">
              <div class="wi-stat-label">Birim Fiyat</div>
              <div class="wi-stat-val">${unitPrice > 0 ? formatCurrency(unitPrice) : '—'}</div>
            </div>
            <div class="wi-stat">
              <div class="wi-stat-label">Hedef Maliyet</div>
              <div class="wi-stat-val">${hedefMaliyet > 0 ? formatCurrency(hedefMaliyet) : '—'}</div>
            </div>
            <div class="wi-stat">
              <div class="wi-stat-label">Gerçek Maliyet</div>
              <div class="wi-stat-val" style="color:var(--success)">${gercekMaliyet > 0 ? formatCurrency(gercekMaliyet) : '—'}</div>
            </div>
            <div class="wi-stat">
              <div class="wi-stat-label">Kalan Miktar</div>
              <div class="wi-stat-val" style="color:var(--danger)">${targetQty > 0 ? Math.max(0, targetQty - gercekMiktar) + ' ' + escHtml(w.unit) : '—'}</div>
            </div>
          </div>

          <div class="wi-actions">
            <button class="btn btn-primary btn-sm" onclick="WorkItemsMgr.showEntryModal('${w.id}')">+ Giriş Ekle</button>
            <button class="btn btn-ghost btn-sm" onclick="WorkItemsMgr.showDetail('${w.id}')">📋 Geçmiş (${WorkItemEntries.forItem(w.id).length})</button>
          </div>
        </div>`;
    }).join('');
  },

  _renderSummary(allItems, allEntries) {
    let hedefToplam = 0, gercekToplam = 0, count = allItems.length;
    for (const w of allItems) {
      const { hedefMaliyet, gercekMaliyet } = calcWorkItemProgress(w.id);
      hedefToplam += hedefMaliyet;
      gercekToplam += gercekMaliyet;
    }
    document.getElementById('wi-hedef-toplam').textContent  = formatCurrency(hedefToplam);
    document.getElementById('wi-gercek-toplam').textContent = formatCurrency(gercekToplam);
    document.getElementById('wi-kalan-toplam').textContent  = formatCurrency(Math.max(0, hedefToplam - gercekToplam));
    document.getElementById('wi-kalem-count').textContent   = count + ' kalem';
  },

  setFilter(wt) {
    this._filterWT = wt;
    document.querySelectorAll('.wi-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.wt === wt);
    });
    this.render();
  },

  // ── İş Kalemi Modal ──────────────────────────────────────────────────────────

  showModal(id = null) {
    this._editId = id;
    const modal  = document.getElementById('modal-wi');
    const form   = document.getElementById('form-wi');
    form.reset();
    document.getElementById('modal-wi-title').textContent = id ? 'Kalemi Düzenle' : 'Yeni İş Kalemi';

    if (id) {
      const w = WorkItems.get(id);
      if (!w) return;
      form['wi-name'].value      = w.name      || '';
      form['wi-worktype'].value  = w.workType  || 'kaba';
      form['wi-unit'].value      = w.unit      || 'm²';
      form['wi-unit-custom'].value = '';
      form['wi-unit-price'].value = w.unitPrice || '';
      form['wi-target-qty'].value = w.targetQty || '';
      form['wi-notes'].value     = w.notes     || '';
      this._toggleCustomUnit(w.unit || 'm²');
    } else {
      form['wi-worktype'].value = 'kaba';
      form['wi-unit'].value    = 'm²';
      document.getElementById('wi-unit-custom-wrap').style.display = 'none';
    }
    modal.showModal();
  },

  _toggleCustomUnit(val) {
    document.getElementById('wi-unit-custom-wrap').style.display = val === 'diğer' ? '' : 'none';
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['wi-name'].value.trim();
    if (!name) { showToast('Kalem adı zorunludur', 'danger'); return; }

    let unit = form['wi-unit'].value;
    if (unit === 'diğer') unit = form['wi-unit-custom'].value.trim() || 'diğer';

    const data = {
      name,
      workType:  form['wi-worktype'].value,
      unit,
      unitPrice: parseFloat(form['wi-unit-price'].value) || 0,
      targetQty: parseFloat(form['wi-target-qty'].value) || 0,
      notes:     form['wi-notes'].value.trim()
    };

    if (this._editId) {
      WorkItems.update(this._editId, data);
      showToast('Kalem güncellendi', 'success');
    } else {
      WorkItems.add(data);
      showToast('Kalem eklendi', 'success');
    }

    document.getElementById('modal-wi').close();
    this.render();
  },

  async delete(id) {
    const w    = WorkItems.get(id);
    const cnt  = WorkItemEntries.forItem(id).length;
    const ok   = await confirmDialog(
      `"${w?.name}" kalemini${cnt ? ` ve ${cnt} giriş kaydını` : ''} silmek istiyor musunuz?`,
      'Sil', 'btn-danger'
    );
    if (!ok) return;
    WorkItems.delete(id);
    this.render();
    showToast('Kalem silindi', 'danger');
  },

  // ── Giriş Modal ───────────────────────────────────────────────────────────────

  showEntryModal(workItemId) {
    const w = WorkItems.get(workItemId);
    if (!w) return;
    const { gercekMiktar, targetQty } = calcWorkItemProgress(workItemId);
    const remaining = targetQty > 0 ? Math.max(0, targetQty - gercekMiktar) : null;

    const modal = document.getElementById('modal-wi-entry');
    const form  = document.getElementById('form-wi-entry');
    form.reset();
    form['wie-item-id'].value = workItemId;
    form['wie-date'].value    = todayStr();

    document.getElementById('modal-wi-entry-title').textContent = `Giriş Ekle — ${w.name}`;
    document.getElementById('wie-unit-label').textContent = w.unit;
    document.getElementById('wie-remaining').textContent =
      remaining !== null ? `Kalan hedef: ${remaining} ${w.unit}` : 'Hedef miktar tanımlanmadı';

    modal.showModal();
  },

  saveEntry(e) {
    e.preventDefault();
    const form       = e.target;
    const workItemId = form['wie-item-id'].value;
    const qty        = parseFloat(form['wie-qty'].value);
    if (!qty || qty <= 0) { showToast('Miktar girin', 'danger'); return; }

    WorkItemEntries.add({
      workItemId,
      date:  form['wie-date'].value || todayStr(),
      qty,
      notes: form['wie-notes'].value.trim()
    });

    document.getElementById('modal-wi-entry').close();
    this.render();
    showToast('Giriş kaydedildi', 'success');
  },

  // ── Detay Modal ───────────────────────────────────────────────────────────────

  showDetail(workItemId) {
    const w       = WorkItems.get(workItemId);
    if (!w) return;
    this._detailItemId = workItemId;
    const entries = WorkItemEntries.forItem(workItemId);
    const modal   = document.getElementById('modal-wi-detail');

    document.getElementById('wi-detail-title').textContent = w.name;
    this._renderDetailList(w, entries);
    modal.showModal();
  },

  _renderDetailList(w, entries) {
    const el = document.getElementById('wi-detail-list');
    if (!entries.length) {
      el.innerHTML = '<p class="text-secondary text-sm" style="text-align:center;padding:1rem">Henüz giriş yok</p>';
      return;
    }
    const total = entries.reduce((s, e) => s + (Number(e.qty) || 0), 0);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:.82rem;font-weight:600;padding:.4rem 0;border-bottom:2px solid var(--border);margin-bottom:.25rem">
        <span>Tarih / Not</span><span>Miktar</span>
      </div>
      ${entries.map(entry => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:.875rem;font-weight:600">${formatDate(entry.date)}</div>
            ${entry.notes ? `<div class="text-xs text-secondary">${escHtml(entry.notes)}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-weight:700;color:var(--info)">${entry.qty} ${escHtml(w.unit)}</span>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="WorkItemsMgr.deleteEntry('${entry.id}')" title="Sil">🗑️</button>
          </div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:flex-end;font-size:.9rem;font-weight:700;padding:.5rem 0;color:var(--info)">
        Toplam: ${total} ${escHtml(w.unit)}
      </div>`;
  },

  async deleteEntry(id) {
    const ok = await confirmDialog('Bu girişi silmek istiyor musunuz?', 'Sil', 'btn-danger');
    if (!ok) return;
    WorkItemEntries.delete(id);
    showToast('Giriş silindi', 'danger');
    if (this._detailItemId) {
      const w = WorkItems.get(this._detailItemId);
      if (w) this._renderDetailList(w, WorkItemEntries.forItem(this._detailItemId));
    }
    this.render();
  },

  // ── Katalog Modal ─────────────────────────────────────────────────────────────

  _katalogFilter: '',

  showKatalogModal() {
    document.getElementById('katalog-search').value = '';
    this._katalogFilter = '';
    document.querySelectorAll('.katalog-pill').forEach(p => p.classList.toggle('active', p.dataset.wt === ''));
    this.renderKatalog();
    document.getElementById('modal-katalog').showModal();
  },

  _setKatalogFilter(wt) {
    this._katalogFilter = wt;
    document.querySelectorAll('.katalog-pill').forEach(p => p.classList.toggle('active', p.dataset.wt === wt));
    this.renderKatalog();
  },

  renderKatalog() {
    const q   = (document.getElementById('katalog-search').value || '').toLowerCase().trim();
    const wt  = this._katalogFilter;
    const el  = document.getElementById('katalog-list');
    const wtLabel = { kaba: 'Kaba İş', ince: 'İnce İş', genel: 'Genel' };

    let html = '';
    let anyVisible = false;

    for (const cat of KATALOG) {
      if (wt && cat.workType !== wt) continue;
      const filtered = cat.kalemler.filter(k => !q || k.ad.toLowerCase().includes(q));
      if (!filtered.length) continue;
      anyVisible = true;

      html += `<div class="katalog-group">
        <div class="katalog-group-header">
          <span class="katalog-group-badge katalog-badge-${cat.workType}">${wtLabel[cat.workType] || cat.workType}</span>
          ${escHtml(cat.baslik)}
        </div>
        ${filtered.map(k => {
          const cbId = `kat-${cat.id}-${k.ad.replace(/\s+/g, '-')}`;
          return `<label class="katalog-item" for="${escHtml(cbId)}">
            <input type="checkbox" id="${escHtml(cbId)}" class="katalog-cb"
              data-name="${escHtml(k.ad)}" data-unit="${escHtml(k.birim)}" data-wt="${escHtml(cat.workType)}"
              onchange="WorkItemsMgr._updateKatalogCount()">
            <span class="katalog-item-name">${escHtml(k.ad)}</span>
            <span class="katalog-item-unit">${escHtml(k.birim)}</span>
          </label>`;
        }).join('')}
      </div>`;
    }

    el.innerHTML = anyVisible ? html : '<p class="katalog-empty">Eşleşen kalem bulunamadı.</p>';
    this._updateKatalogCount();
  },

  _updateKatalogCount() {
    const n = document.querySelectorAll('.katalog-cb:checked').length;
    document.getElementById('katalog-selected-count').textContent = n ? `${n} kalem seçildi` : '0 kalem seçildi';
  },

  addFromKatalog() {
    const checked = document.querySelectorAll('.katalog-cb:checked');
    if (!checked.length) { showToast('En az bir kalem seçin', 'danger'); return; }

    const existingNames = new Set(WorkItems.all().map(w => w.name.toLowerCase()));
    let added = 0, skipped = 0;

    checked.forEach(cb => {
      const name = cb.dataset.name;
      if (existingNames.has(name.toLowerCase())) { skipped++; return; }
      WorkItems.add({ name, workType: cb.dataset.wt, unit: cb.dataset.unit, unitPrice: 0, targetQty: 0, notes: '' });
      added++;
    });

    document.getElementById('modal-katalog').close();
    this.render();

    if (added && skipped) showToast(`${added} kalem eklendi, ${skipped} zaten mevcut atlandı`, 'success');
    else if (added)       showToast(`${added} kalem eklendi`, 'success');
    else                  showToast('Seçilen kalemler zaten mevcut', 'danger');
  }
};
