'use strict';

const PanelMgr = {
  render() {
    const site = Sites.active();

    if (!site) {
      document.getElementById('panel-cards').innerHTML = '';
      document.getElementById('panel-recent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏗️</div>
          <div class="empty-title">Hoş Geldiniz!</div>
          <div class="empty-desc">Başlamak için bir şantiye ekleyin.</div>
          <div style="margin-top:1rem"><button class="btn btn-primary" onclick="navigate('santiyeler');SitesMgr.showModal()">+ Şantiye Ekle</button></div>
        </div>`;
      const h = document.getElementById('panel-hakedis');
      h.innerHTML = ''; h.style.display = 'none';
      return;
    }

    const txs    = Transactions.all();
    const gelir  = txs.filter(t => t.type === 'gelir').reduce((s,t) => s + (t.amount||0), 0);
    const gider  = txs.filter(t => t.type === 'gider').reduce((s,t) => s + (t.amount||0), 0);
    const bakiye = gelir - gider;

    const giderK = txs.filter(t => t.type === 'gider' && t.workType === 'kaba').reduce((s,t) => s + (t.amount||0), 0);
    const giderI = txs.filter(t => t.type === 'gider' && t.workType === 'ince').reduce((s,t) => s + (t.amount||0), 0);
    const giderG = txs.filter(t => t.type === 'gider' && t.workType === 'genel').reduce((s,t) => s + (t.amount||0), 0);

    // Total pending payments
    const personnel = Personnel.all();
    let totalKalan  = 0;
    for (const p of personnel) {
      const { kalan } = calcHakedis(p.id);
      if (kalan > 0) totalKalan += kalan;
    }

    // Summary cards
    document.getElementById('panel-cards').innerHTML = `
      <div class="cards-grid">
        <div class="card card-success">
          <div class="card-title">Toplam Gelir</div>
          <div class="card-value text-success">${formatCurrency(gelir)}</div>
        </div>
        <div class="card card-danger">
          <div class="card-title">Toplam Gider</div>
          <div class="card-value text-danger">${formatCurrency(gider)}</div>
        </div>
        <div class="card ${bakiye >= 0 ? 'card-info' : 'card-warning'}">
          <div class="card-title">Bakiye</div>
          <div class="card-value" style="color:${bakiye>=0?'var(--info)':'var(--danger)'}">${formatCurrency(bakiye)}</div>
        </div>
        <div class="card card-primary">
          <div class="card-title">Bekleyen Hakediş</div>
          <div class="card-value" style="color:${totalKalan>0?'var(--danger)':'var(--success)'}">${formatCurrency(totalKalan)}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:.75rem">
        <div class="card-title" style="margin-bottom:.5rem">Gider Kırılımı</div>
        <div style="display:flex;flex-direction:column;gap:.35rem">
          ${this._barRow('Kaba İş', giderK, gider, 'var(--warning)')}
          ${this._barRow('İnce İş', giderI, gider, 'var(--info)')}
          ${this._barRow('Genel', giderG, gider, 'var(--text-3)')}
        </div>
      </div>`;

    // Recent transactions
    const recent = txs.slice(0, 8);
    document.getElementById('panel-recent').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <h3 style="font-size:.875rem">Son Hareketler</h3>
        <a href="#" onclick="navigate('gelir-gider');return false" class="text-sm" style="color:var(--primary-dk)">Tümünü gör →</a>
      </div>
      ${!recent.length
        ? '<p class="text-secondary text-sm text-center" style="padding:.5rem">Henüz kayıt yok</p>'
        : '<div class="tx-list">' + recent.map(t => `
          <div class="tx-item ${t.type}" onclick="navigate('gelir-gider')">
            <div class="tx-info">
              <div class="tx-desc">${escHtml(t.description || t.category || '')}</div>
              <div class="tx-meta"><span>${formatDate(t.date)}</span></div>
            </div>
            <div class="tx-amount ${t.type}">${t.type==='gelir'?'+':'−'}${formatCurrency(t.amount)}</div>
          </div>`).join('') + '</div>'
      }`;

    // Personnel hakedis summary
    const pending = personnel.filter(p => { const {kalan} = calcHakedis(p.id); return kalan > 0; });
    const hakedisEl = document.getElementById('panel-hakedis');
    hakedisEl.style.display = pending.length ? '' : 'none';
    hakedisEl.innerHTML = pending.length ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <h3 style="font-size:.875rem">Bekleyen Ödemeler</h3>
        <a href="#" onclick="navigate('personel');return false" class="text-sm" style="color:var(--primary-dk)">Detay →</a>
      </div>
      ${pending.map(p => {
        const {hakedis, odenen, kalan} = calcHakedis(p.id);
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-weight:600;font-size:.9rem">${escHtml(p.name)}</div>
              <div class="text-xs text-secondary">${escHtml(p.role||'İşçi')}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--danger)">${formatCurrency(kalan)}</div>
              <div class="text-xs text-secondary">/ ${formatCurrency(hakedis)} hak.</div>
            </div>
          </div>`;
      }).join('')}` : '';
  },

  _barRow(label, value, total, color) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:3px">
          <span style="color:var(--text-2)">${label}</span>
          <span style="font-weight:600">${formatCurrency(value)} <span class="text-muted">(${pct}%)</span></span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s"></div>
        </div>
      </div>`;
  }
};
