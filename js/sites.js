'use strict';

const SitesMgr = {
  _editId: null,

  render() {
    const sites  = Sites.all();
    const active = db().activeSiteId;
    const el     = document.getElementById('sites-list');

    if (!sites.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏗️</div>
          <div class="empty-title">Henüz şantiye eklenmedi</div>
          <div class="empty-desc">Yukarıdaki butona tıklayarak ilk şantiyenizi ekleyin.</div>
        </div>`;
      return;
    }

    el.innerHTML = sites.map(s => {
      const isActive = s.id === active;
      return `
        <div class="card site-card${isActive ? ' active-site' : ''}">
          <div class="site-card-top">
            <div style="flex:1;min-width:0">
              <div class="site-name">${escHtml(s.name)}${isActive ? ' <span class="badge badge-success">Aktif</span>' : ''}</div>
              ${s.address ? `<div class="site-addr">📍 ${escHtml(s.address)}</div>` : ''}
              ${s.startDate ? `<div class="site-meta">Başlangıç: ${formatDate(s.startDate)}</div>` : ''}
              ${s.notes ? `<div class="site-meta">${escHtml(s.notes)}</div>` : ''}
            </div>
            <div class="site-card-actions">
              ${!isActive ? `<button class="btn btn-primary btn-sm" onclick="SitesMgr.setActive('${s.id}')">Seç</button>` : ''}
              <button class="btn btn-ghost btn-icon btn-sm" onclick="SitesMgr.showModal('${s.id}')" title="Düzenle">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="SitesMgr.delete('${s.id}')" title="Sil">🗑️</button>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  showModal(id = null) {
    this._editId = id;
    const modal = document.getElementById('modal-site');
    document.getElementById('modal-site-title').textContent = id ? 'Şantiye Düzenle' : 'Yeni Şantiye';
    const form = document.getElementById('form-site');
    form.reset();

    if (id) {
      const s = Sites.get(id);
      if (!s) return;
      form['site-name'].value      = s.name      || '';
      form['site-address'].value   = s.address   || '';
      form['site-start'].value     = s.startDate || '';
      form['site-notes'].value     = s.notes     || '';
    } else {
      form['site-start'].value = todayStr();
    }
    modal.showModal();
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['site-name'].value.trim();
    if (!name) { showToast('Şantiye adı zorunludur', 'danger'); return; }

    const data = {
      name,
      address:   form['site-address'].value.trim(),
      startDate: form['site-start'].value,
      notes:     form['site-notes'].value.trim()
    };

    if (this._editId) {
      Sites.update(this._editId, data);
      showToast('Şantiye güncellendi', 'success');
    } else {
      Sites.add(data);
      showToast('Şantiye eklendi', 'success');
    }

    document.getElementById('modal-site').close();
    renderHeader();
    this.render();
    if (_currentSection === 'panel') PanelMgr.render();
  },

  setActive(id) {
    Sites.setActive(id);
    renderHeader();
    this.render();
    navigate('panel');
    showToast('Aktif şantiye değiştirildi', 'success');
  },

  async delete(id) {
    const s = Sites.get(id);
    const ok = await confirmDialog(
      `"${s?.name}" şantiyesini ve tüm kayıtlarını silmek istiyor musunuz? Bu işlem geri alınamaz.`,
      'Evet, Sil', 'btn-danger'
    );
    if (!ok) return;
    Sites.delete(id);
    renderHeader();
    this.render();
    if (_currentSection === 'panel') PanelMgr.render();
    showToast('Şantiye silindi', 'danger');
  }
};
