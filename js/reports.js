'use strict';

const ReportsMgr = {
  _year:  new Date().getFullYear(),
  _month: new Date().getMonth() + 1,

  render() {
    document.getElementById('rep-month-label').textContent = monthStr(this._year, this._month);
    this._renderReport();
  },

  prevMonth() {
    if (this._month === 1) { this._month = 12; this._year--; }
    else this._month--;
    this.render();
  },

  nextMonth() {
    if (this._month === 12) { this._month = 1; this._year++; }
    else this._month++;
    this.render();
  },

  _renderReport() {
    const year  = this._year;
    const month = this._month;
    const prefix = `${year}-${String(month).padStart(2,'0')}`;

    const allTxs = Transactions.all().filter(t => t.date.startsWith(prefix));
    const gelir  = allTxs.filter(t => t.type === 'gelir').reduce((s,t) => s + (t.amount||0), 0);
    const giderK = allTxs.filter(t => t.type === 'gider' && t.workType === 'kaba').reduce((s,t) => s + (t.amount||0), 0);
    const giderI = allTxs.filter(t => t.type === 'gider' && t.workType === 'ince').reduce((s,t) => s + (t.amount||0), 0);
    const giderG = allTxs.filter(t => t.type === 'gider' && (t.workType === 'genel' || t.workType === 'gelir')).reduce((s,t) => s + (t.amount||0), 0);
    const gider  = giderK + giderI + giderG;
    const bakiye = gelir - gider;

    const personnel = Personnel.all();
    const tsEntries = Timesheet.forMonth(year, month);

    let hakedisRows = '';
    for (const p of personnel) {
      const monthEntries = tsEntries.filter(e => e.personnelId === p.id);
      let monthHakedis = 0;
      let totalWork    = 0;
      for (const e of monthEntries) {
        if (p.wageType === 'gunluk') {
          const v = Number(e.dayValue) || 0;
          monthHakedis += v * (Number(p.dailyRate) || 0);
          monthHakedis += (Number(e.overtimeHours)||0) * ((Number(p.dailyRate)||0)/8) * 1.5;
          totalWork += v;
        } else {
          const h = Number(e.hours) || 0;
          monthHakedis += h * (Number(p.hourlyRate) || 0);
          monthHakedis += (Number(e.overtimeHours)||0) * (Number(p.hourlyRate)||0) * 1.5;
          totalWork += h;
        }
      }
      if (totalWork > 0) {
        const unit = p.wageType === 'gunluk' ? 'gün' : 'saat';
        hakedisRows += `
          <tr>
            <td>${escHtml(p.name)}</td>
            <td>${escHtml(p.role || 'İşçi')}</td>
            <td style="text-align:right">${totalWork} ${unit}</td>
            <td style="text-align:right;font-weight:600">${formatCurrency(monthHakedis)}</td>
          </tr>`;
      }
    }

    // Category breakdown
    const catMap = {};
    for (const t of allTxs.filter(t => t.type === 'gider')) {
      const k = `${t.workType}|${t.category || 'Diğer'}`;
      catMap[k] = (catMap[k] || 0) + (t.amount || 0);
    }
    const catRows = Object.entries(catMap)
      .sort((a,b) => b[1] - a[1])
      .map(([k, v]) => {
        const [wt, cat] = k.split('|');
        const labels = { kaba: 'Kaba İş', ince: 'İnce İş', genel: 'Genel', gelir: '' };
        return `<tr><td>${labels[wt]||wt}</td><td>${escHtml(cat)}</td><td class="td-amount">${formatCurrency(v)}</td></tr>`;
      }).join('');

    const site = Sites.active();
    document.getElementById('report-content').innerHTML = `
      <div class="report-section no-print" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
        <button class="btn btn-outline btn-sm" onclick="ReportsMgr.exportTxCSV()">📥 Gelir/Gider CSV</button>
        <button class="btn btn-outline btn-sm" onclick="ReportsMgr.exportTimesheetCSV()">📥 Puantaj CSV</button>
        <button class="btn btn-outline btn-sm" onclick="ReportsMgr.exportHakedisCSV()">📥 Hakediş CSV</button>
        <button class="btn btn-primary btn-sm" onclick="ReportsMgr.print()">🖨️ Yazdır / PDF</button>
      </div>

      <div id="printable-report">
        <h2 style="margin-bottom:.25rem">${escHtml(site?.name || '')} — ${monthStr(year,month)} Raporu</h2>
        <p class="text-secondary text-sm" style="margin-bottom:1.5rem">Oluşturulma: ${formatDate(todayStr())}</p>

        <div class="report-section">
          <h3>Gelir / Gider Özeti</h3>
          <div class="table-wrap">
            <table>
              <tbody>
                <tr><td>Toplam Gelir</td><td class="td-amount text-success">${formatCurrency(gelir)}</td></tr>
                <tr><td>Kaba İş Gideri</td><td class="td-amount text-danger">${formatCurrency(giderK)}</td></tr>
                <tr><td>İnce İş Gideri</td><td class="td-amount text-danger">${formatCurrency(giderI)}</td></tr>
                <tr><td>Genel Gider</td><td class="td-amount text-danger">${formatCurrency(giderG)}</td></tr>
                <tr style="font-weight:700;background:#f8fafc">
                  <td>Toplam Gider</td><td class="td-amount" style="color:var(--danger)">${formatCurrency(gider)}</td>
                </tr>
                <tr style="font-weight:700;font-size:1.05rem">
                  <td>BAKİYE</td>
                  <td class="td-amount" style="color:${bakiye>=0?'var(--success)':'var(--danger)'}">${formatCurrency(bakiye)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        ${catRows ? `
        <div class="report-section">
          <h3>Gider Kırılımı</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>İş Türü</th><th>Kategori</th><th style="text-align:right">Tutar</th></tr></thead>
              <tbody>${catRows}</tbody>
            </table>
          </div>
        </div>` : ''}

        ${hakedisRows ? `
        <div class="report-section">
          <h3>Personel Hakediş — ${monthStr(year,month)}</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Personel</th><th>Görev</th><th style="text-align:right">Çalışma</th><th style="text-align:right">Hakediş</th></tr></thead>
              <tbody>${hakedisRows}</tbody>
            </table>
          </div>
        </div>` : ''}

        ${allTxs.length ? `
        <div class="report-section">
          <h3>Hareket Listesi</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tarih</th><th>Tür</th><th>Kategori</th><th>Açıklama</th><th style="text-align:right">Tutar</th></tr></thead>
              <tbody>
                ${allTxs.map(t => `
                  <tr>
                    <td>${formatDate(t.date)}</td>
                    <td><span class="badge ${t.type==='gelir'?'badge-success':'badge-danger'}">${t.type==='gelir'?'Gelir':'Gider'}</span></td>
                    <td>${escHtml(t.category||'')}</td>
                    <td>${escHtml(t.description||'')}</td>
                    <td class="td-amount" style="color:${t.type==='gelir'?'var(--success)':'var(--danger)'}">${t.type==='gelir'?'+':'−'}${formatCurrency(t.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>` : '<p class="text-secondary text-sm">Bu ay için kayıt bulunamadı.</p>'}
      </div>`;
  },

  print() {
    const section = document.getElementById('raporlar');
    section.classList.add('printing');
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      section.classList.remove('printing');
    };
    window.onafterprint = cleanup;
    window.print();
  },

  // CSV helpers
  _csvEscape(v) {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  },

  _downloadCSV(filename, rows) {
    const BOM     = '﻿';
    const content = BOM + rows.map(r => r.map(this._csvEscape).join(',')).join('\r\n');
    const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  },

  exportTxCSV() {
    const year   = this._year;
    const month  = this._month;
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    const txs    = Transactions.all().filter(t => t.date.startsWith(prefix));
    const rows   = [['Tarih','Tür','İş Türü','Kategori','Açıklama','Tutar','Ödeme Yöntemi','Notlar']];
    for (const t of txs) {
      rows.push([t.date, t.type==='gelir'?'Gelir':'Gider', t.workType||'', t.category||'', t.description||'', t.amount||0, t.paymentMethod||'', t.notes||'']);
    }
    const site = Sites.active();
    this._downloadCSV(`${site?.name||'santiye'}_gelir_gider_${year}_${String(month).padStart(2,'0')}.csv`, rows);
  },

  exportTimesheetCSV() {
    const year  = this._year;
    const month = this._month;
    const numDays = daysInMonth(year, month);
    const personnel = Personnel.all();
    const entries   = Timesheet.forMonth(year, month);

    const entryMap = {};
    for (const e of entries) entryMap[`${e.personnelId}_${e.date}`] = e;

    const dayHeaders = [];
    for (let d = 1; d <= numDays; d++) dayHeaders.push(`${d}`);

    const rows = [['Personel', 'Görev', 'Ücret Türü', ...dayHeaders, 'Toplam']];
    for (const p of personnel) {
      const row = [p.name, p.role||'', p.wageType === 'gunluk' ? 'Günlük' : 'Saatlik'];
      let total = 0;
      for (let d = 1; d <= numDays; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const e = entryMap[`${p.id}_${dateStr}`];
        if (e) {
          const v = p.wageType === 'gunluk' ? (e.dayValue||0) : (e.hours||0);
          row.push(v); total += Number(v);
        } else row.push('');
      }
      row.push(total);
      rows.push(row);
    }

    const site = Sites.active();
    this._downloadCSV(`${site?.name||'santiye'}_puantaj_${year}_${String(month).padStart(2,'0')}.csv`, rows);
  },

  exportHakedisCSV() {
    const personnel = Personnel.all();
    const rows = [['Personel','Görev','Ücret Türü','Birim Ücret','Toplam Hakediş','Ödenen','Kalan Borç']];
    for (const p of personnel) {
      const { hakedis, odenen, kalan } = calcHakedis(p.id);
      rows.push([
        p.name, p.role||'',
        p.wageType === 'gunluk' ? 'Günlük' : 'Saatlik',
        p.wageType === 'gunluk' ? (p.dailyRate||0) : (p.hourlyRate||0),
        hakedis, odenen, kalan
      ]);
    }
    const site = Sites.active();
    this._downloadCSV(`${site?.name||'santiye'}_hakedis.csv`, rows);
  }
};
