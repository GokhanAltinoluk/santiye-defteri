'use strict';

const PersonnelMgr = {
  _editId: null,

  render() {
    const site = Sites.active();
    const el   = document.getElementById('personnel-list');

    if (!site) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏗️</div><div class="empty-title">Önce şantiye seçin</div></div>';
      return;
    }

    const list = Personnel.all();

    if (!list.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👷</div>
          <div class="empty-title">Personel eklenmedi</div>
          <div class="empty-desc">Şantiyenizde çalışan işçileri ekleyin.</div>
        </div>`;
      return;
    }

    el.innerHTML = '<div class="personnel-list">' + list.map(p => {
      const { hakedis, odenen, kalan } = calcHakedis(p.id);
      const rateText = p.wageType === 'gunluk'
        ? `${formatCurrency(p.dailyRate)}/gün`
        : `${formatCurrency(p.hourlyRate)}/saat`;

      return `
        <div class="personnel-card">
          <div class="personnel-avatar">${escHtml(getInitials(p.name))}</div>
          <div class="personnel-info">
            <div class="personnel-name">${escHtml(p.name)}${!p.active ? ' <span class="badge badge-gray">Pasif</span>' : ''}</div>
            <div class="personnel-role">${escHtml(p.role || 'İşçi')}</div>
            <div class="personnel-rate">${rateText}${p.phone ? ` · 📞 ${escHtml(p.phone)}` : ''}</div>
            <div class="hakedis-actions">
              <button class="btn btn-ghost btn-sm" onclick="PersonnelMgr.showModal('${p.id}')">✏️ Düzenle</button>
              <button class="btn btn-outline btn-sm" onclick="PersonnelMgr.showPaymentModal('${p.id}')">💰 Ödeme</button>
              <button class="btn btn-ghost btn-sm" onclick="PersonnelMgr.showPaymentHistory('${p.id}')">📋 Geçmiş</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PersonnelMgr.delete('${p.id}')">🗑️</button>
            </div>
          </div>
          <div class="personnel-hakedis">
            <div>
              <div class="hakedis-label">Hakediş</div>
              <div style="font-size:.85rem;font-weight:600">${formatCurrency(hakedis)}</div>
            </div>
            <div style="margin-top:4px">
              <div class="hakedis-label">Ödenen</div>
              <div style="font-size:.85rem;font-weight:600;color:var(--success)">${formatCurrency(odenen)}</div>
            </div>
            <div style="margin-top:4px">
              <div class="hakedis-label">Kalan</div>
              <div class="hakedis-kalan ${kalan > 0 ? 'positive' : 'zero'}">${formatCurrency(kalan)}</div>
            </div>
          </div>
        </div>`;
    }).join('') + '</div>';
  },

  showModal(id = null) {
    this._editId = id;
    const modal = document.getElementById('modal-personnel');
    const form  = document.getElementById('form-personnel');
    form.reset();
    document.getElementById('modal-personnel-title').textContent = id ? 'Personel Düzenle' : 'Personel Ekle';

    if (id) {
      const p = Personnel.get(id);
      if (!p) return;
      form['p-name'].value       = p.name       || '';
      form['p-role'].value       = p.role       || '';
      form['p-phone'].value      = p.phone      || '';
      form['p-wagetype'].value   = p.wageType   || 'gunluk';
      form['p-dailyrate'].value  = p.dailyRate  || '';
      form['p-hourlyrate'].value = p.hourlyRate || '';
      form['p-active'].checked   = p.active !== false;
      this._toggleRateFields(p.wageType || 'gunluk');
    } else {
      form['p-wagetype'].value = 'gunluk';
      form['p-active'].checked = true;
      this._toggleRateFields('gunluk');
    }
    modal.showModal();
  },

  _toggleRateFields(wageType) {
    document.getElementById('daily-rate-wrap').style.display  = wageType === 'gunluk'  ? '' : 'none';
    document.getElementById('hourly-rate-wrap').style.display = wageType === 'saatlik' ? '' : 'none';
  },

  onWageTypeChange() {
    this._toggleRateFields(document.getElementById('p-wagetype').value);
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['p-name'].value.trim();
    if (!name) { showToast('İsim zorunludur', 'danger'); return; }

    const wageType = form['p-wagetype'].value;
    const data = {
      name,
      role:       form['p-role'].value.trim(),
      phone:      form['p-phone'].value.trim(),
      wageType,
      dailyRate:  wageType === 'gunluk'  ? parseFloat(form['p-dailyrate'].value)  || 0 : 0,
      hourlyRate: wageType === 'saatlik' ? parseFloat(form['p-hourlyrate'].value) || 0 : 0,
      active:     form['p-active'].checked
    };

    if (this._editId) {
      Personnel.update(this._editId, data);
      showToast('Personel güncellendi', 'success');
    } else {
      Personnel.add(data);
      showToast('Personel eklendi', 'success');
    }

    document.getElementById('modal-personnel').close();
    this.render();
  },

  showPaymentModal(personnelId) {
    const p = Personnel.get(personnelId);
    if (!p) return;
    const { kalan } = calcHakedis(personnelId);

    const modal = document.getElementById('modal-payment');
    const form  = document.getElementById('form-payment');
    form.reset();
    form['pay-personnel-id'].value = personnelId;
    document.getElementById('modal-payment-title').textContent = `Ödeme — ${p.name}`;
    document.getElementById('pay-remaining').textContent = `Kalan borç: ${formatCurrency(kalan)}`;
    form['pay-date'].value   = todayStr();
    form['pay-amount'].value = kalan > 0 ? kalan.toFixed(2) : '';
    modal.showModal();
  },

  savePayment(e) {
    e.preventDefault();
    const form        = e.target;
    const personnelId = form['pay-personnel-id'].value;
    const amount      = parseFloat(form['pay-amount'].value);
    if (!amount || amount <= 0) { showToast('Geçerli bir tutar girin', 'danger'); return; }

    Payments.add({
      personnelId,
      amount,
      date:  form['pay-date'].value || todayStr(),
      notes: form['pay-notes'].value.trim()
    });

    document.getElementById('modal-payment').close();
    this.render();
    showToast('Ödeme kaydedildi', 'success');
  },

  showPaymentHistory(personnelId) {
    const p    = Personnel.get(personnelId);
    const pays = Payments.forPersonnel(personnelId).sort((a, b) => b.date.localeCompare(a.date));
    const modal = document.getElementById('modal-pay-history');
    document.getElementById('pay-history-title').textContent = `Ödeme Geçmişi — ${p?.name || ''}`;

    const el = document.getElementById('pay-history-list');
    if (!pays.length) {
      el.innerHTML = '<p class="text-secondary text-sm" style="text-align:center;padding:1rem">Ödeme kaydı yok</p>';
    } else {
      el.innerHTML = pays.map(pay => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:600">${formatCurrency(pay.amount)}</div>
            <div class="text-xs text-secondary">${formatDate(pay.date)}${pay.notes ? ' · ' + escHtml(pay.notes) : ''}</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="PersonnelMgr.deletePayment('${pay.id}')" title="Sil">🗑️</button>
        </div>
      `).join('');
    }
    modal.showModal();
  },

  async deletePayment(id) {
    const ok = await confirmDialog('Bu ödeme kaydını silmek istiyor musunuz?', 'Sil', 'btn-danger');
    if (!ok) return;
    Payments.delete(id);
    document.getElementById('modal-pay-history').close();
    this.render();
    showToast('Ödeme silindi', 'danger');
  },

  async delete(id) {
    const p  = Personnel.get(id);
    const ok = await confirmDialog(
      `"${p?.name}" personelini ve tüm puantaj/ödeme kayıtlarını silmek istiyor musunuz?`,
      'Evet, Sil', 'btn-danger'
    );
    if (!ok) return;
    Personnel.delete(id);
    this.render();
    showToast('Personel silindi', 'danger');
  }
};
