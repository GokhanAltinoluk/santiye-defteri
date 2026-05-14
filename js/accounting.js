'use strict';

const AccountingMgr = {
  _editId: null,
  _filters: { type: '', workType: '', dateFrom: '', dateTo: '' },

  render() {
    const site = Sites.active();
    if (!site) { this._noSite(); return; }

    const txs     = this._filtered();
    const gelir   = txs.filter(t => t.type === 'gelir').reduce((s, t) => s + (t.amount || 0), 0);
    const gider   = txs.filter(t => t.type === 'gider').reduce((s, t) => s + (t.amount || 0), 0);
    const bakiye  = gelir - gider;

    document.getElementById('acc-gelir').textContent  = formatCurrency(gelir);
    document.getElementById('acc-gider').textContent  = formatCurrency(gider);
    document.getElementById('acc-bakiye').textContent = formatCurrency(bakiye);
    document.getElementById('acc-bakiye').style.color = bakiye >= 0 ? 'var(--success)' : 'var(--danger)';

    this._renderList(txs);
  },

  _noSite() {
    document.getElementById('tx-list').innerHTML =
      '<div class="empty-state"><div class="empty-icon">🏗️</div><div class="empty-title">Önce şantiye seçin</div></div>';
  },

  _filtered() {
    let txs = Transactions.all();
    const f = this._filters;
    if (f.type)     txs = txs.filter(t => t.type === f.type);
    if (f.workType) txs = txs.filter(t => t.workType === f.workType);
    if (f.dateFrom) txs = txs.filter(t => t.date >= f.dateFrom);
    if (f.dateTo)   txs = txs.filter(t => t.date <= f.dateTo);
    return txs;
  },

  applyFilters() {
    this._filters = {
      type:     document.getElementById('filter-type').value,
      workType: document.getElementById('filter-worktype').value,
      dateFrom: document.getElementById('filter-date-from').value,
      dateTo:   document.getElementById('filter-date-to').value
    };
    this.render();
  },

  clearFilters() {
    this._filters = { type: '', workType: '', dateFrom: '', dateTo: '' };
    document.getElementById('filter-type').value      = '';
    document.getElementById('filter-worktype').value  = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value   = '';
    this.render();
  },

  _renderList(txs) {
    const el = document.getElementById('tx-list');
    if (!txs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">Kayıt bulunamadı</div><div class="empty-desc">Filtre uygulandıysa temizleyin veya yeni kayıt ekleyin.</div></div>';
      return;
    }

    const workTypeLabel = { kaba: 'Kaba İş', ince: 'İnce İş', genel: 'Genel' };
    const workTypeBadge = { kaba: 'badge-kaba', ince: 'badge-ince', genel: 'badge-genel' };

    el.innerHTML = '<div class="tx-list">' + txs.map(t => `
      <div class="tx-item ${t.type}" onclick="AccountingMgr.showModal('${t.id}')">
        <div class="tx-info">
          <div class="tx-desc">${escHtml(t.description || t.category || '')}</div>
          <div class="tx-meta">
            <span>${formatDate(t.date)}</span>
            ${t.workType ? `<span class="badge ${workTypeBadge[t.workType] || 'badge-gray'}">${workTypeLabel[t.workType] || t.workType}</span>` : ''}
            ${t.category ? `<span>${escHtml(t.category)}</span>` : ''}
            ${t.paymentMethod ? `<span>· ${escHtml(t.paymentMethod)}</span>` : ''}
          </div>
        </div>
        <div>
          <div class="tx-amount ${t.type}">${t.type === 'gelir' ? '+' : '-'}${formatCurrency(t.amount)}</div>
          <div style="text-align:right;margin-top:4px">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();AccountingMgr.delete('${t.id}')" title="Sil">🗑️</button>
          </div>
        </div>
      </div>
    `).join('') + '</div>';
  },

  showModal(id = null) {
    this._editId = id;
    const modal = document.getElementById('modal-tx');
    const form  = document.getElementById('form-tx');
    form.reset();

    document.getElementById('modal-tx-title').textContent = id ? 'Kaydı Düzenle' : 'Yeni Kayıt';

    if (id) {
      const t = Transactions.get(id);
      if (!t) return;
      form['tx-type'].value        = t.type     || 'gider';
      form['tx-worktype'].value    = t.workType && t.workType !== 'gelir' ? t.workType : 'kaba';
      form['tx-date'].value        = t.date     || '';
      form['tx-amount'].value      = t.amount   || '';
      form['tx-description'].value = t.description || '';
      form['tx-notes'].value       = t.notes    || '';
      form['tx-payment'].value     = t.paymentMethod || '';
      this._updateCategoryOptions(t.workType || '', t.type || 'gider', t.category);
    } else {
      form['tx-type'].value        = 'gider';
      form['tx-worktype'].value    = 'kaba';
      form['tx-date'].value        = todayStr();
      this._updateCategoryOptions('kaba', 'gider', '');
    }
    // Sync workType visibility
    document.getElementById('tx-worktype-wrap').style.display =
      form['tx-type'].value === 'gider' ? '' : 'none';

    modal.showModal();
  },

  _updateCategoryOptions(workType, type, selected = '') {
    const catSel = document.getElementById('tx-category');
    let cats = [];

    if (type === 'gelir') {
      cats = CATEGORIES.gelir;
    } else if (workType && CATEGORIES[workType]) {
      cats = CATEGORIES[workType];
    } else {
      cats = [...CATEGORIES.kaba, ...CATEGORIES.ince, ...CATEGORIES.genel];
    }

    catSel.innerHTML = '<option value="">Kategori seçin (isteğe bağlı)</option>' +
      cats.map(c => `<option value="${escHtml(c)}" ${c === selected ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
  },

  onTypeChange() {
    const type     = document.getElementById('tx-type').value;
    const workType = document.getElementById('tx-worktype').value;
    const wtWrap   = document.getElementById('tx-worktype-wrap');
    wtWrap.style.display = type === 'gider' ? '' : 'none';
    this._updateCategoryOptions(type === 'gelir' ? '' : workType, type, '');
  },

  onWorkTypeChange() {
    const type     = document.getElementById('tx-type').value;
    const workType = document.getElementById('tx-worktype').value;
    this._updateCategoryOptions(workType, type, '');
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const amount = parseFloat(form['tx-amount'].value);
    if (!amount || amount <= 0) { showToast('Geçerli bir tutar girin', 'danger'); return; }

    const type = form['tx-type'].value;
    const data = {
      type,
      workType:      type === 'gelir' ? 'gelir' : (form['tx-worktype'].value || 'genel'),
      date:          form['tx-date'].value || todayStr(),
      amount,
      category:      form['tx-category'].value,
      description:   form['tx-description'].value.trim(),
      paymentMethod: form['tx-payment'].value,
      notes:         form['tx-notes'].value.trim()
    };

    if (this._editId) {
      Transactions.update(this._editId, data);
      showToast('Kayıt güncellendi', 'success');
    } else {
      Transactions.add(data);
      showToast('Kayıt eklendi', 'success');
    }

    document.getElementById('modal-tx').close();
    this.render();
    if (_currentSection === 'panel') PanelMgr.render();
  },

  async delete(id) {
    const t  = Transactions.get(id);
    const ok = await confirmDialog(
      `Bu kaydı silmek istiyor musunuz?\n${formatDate(t?.date)} — ${formatCurrency(t?.amount)}`,
      'Sil', 'btn-danger'
    );
    if (!ok) return;
    Transactions.delete(id);
    this.render();
    if (_currentSection === 'panel') PanelMgr.render();
    showToast('Kayıt silindi', 'danger');
  }
};
