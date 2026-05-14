'use strict';

const TimesheetMgr = {
  _year:  new Date().getFullYear(),
  _month: new Date().getMonth() + 1,

  render() {
    const site = Sites.active();
    if (!site) {
      document.getElementById('timesheet-grid').innerHTML =
        '<div class="empty-state"><div class="empty-icon">🏗️</div><div class="empty-title">Önce şantiye seçin</div></div>';
      return;
    }
    document.getElementById('ts-month-label').textContent = monthStr(this._year, this._month);
    this._renderGrid();
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

  _renderGrid() {
    const year   = this._year;
    const month  = this._month;
    const numDays = daysInMonth(year, month);
    const todayS  = todayStr();
    const personnel = Personnel.all().filter(p => p.active !== false);
    const entries   = Timesheet.forMonth(year, month);

    const entryMap = {};
    for (const e of entries) {
      const key = `${e.personnelId}_${e.date}`;
      entryMap[key] = e;
    }

    const container = document.getElementById('timesheet-grid');

    if (!personnel.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👷</div>
          <div class="empty-title">Önce personel ekleyin</div>
          <div class="empty-desc"><a href="#" onclick="navigate('personel');return false">Personel sayfasına</a> gidin ve işçilerinizi ekleyin.</div>
        </div>`;
      return;
    }

    // Build day headers
    let headerHtml = '<th class="col-name">Personel</th>';
    const dayData = [];
    for (let d = 1; d <= numDays; d++) {
      const dow = dayOfWeek(year, month, d);
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isSat   = dow === 6;
      const isSun   = dow === 0;
      const isToday = dateStr === todayS;
      dayData.push({ d, dateStr, dow, isSat, isSun, isToday });
      headerHtml += `<th class="col-day${isSat ? ' sat' : isSun ? ' sun' : ''}">${d}<br><span style="font-weight:400">${TR_DAYS[dow]}</span></th>`;
    }
    headerHtml += '<th class="col-total">Toplam</th><th class="col-total">Hakediş</th>';

    // Build rows
    let rowsHtml = '';
    for (const p of personnel) {
      let rowTotal = 0;
      let cellsHtml = `<td class="col-name" title="${escHtml(p.name)}">${escHtml(p.name.split(' ')[0])}</td>`;

      for (const { d, dateStr, isSat, isSun, isToday } of dayData) {
        const entry = entryMap[`${p.id}_${dateStr}`];
        let cellClass = 'day-cell';
        if (isSat) cellClass += ' sat-col';
        if (isSun) cellClass += ' sun-col';
        if (isToday) cellClass += ' today';

        let cellContent = '';
        if (entry) {
          if (p.wageType === 'gunluk') {
            const v = Number(entry.dayValue) || 0;
            if (v === 1)      { cellClass += ' day-full';  cellContent = '1'; }
            else if (v === 0.5){ cellClass += ' day-half'; cellContent = '½'; }
            else if (v > 1)   { cellClass += ' day-extra'; cellContent = v; }
            else              { cellClass += ' day-empty'; cellContent = '-'; }
            rowTotal += v;
          } else {
            const h = Number(entry.hours) || 0;
            cellClass += h > 0 ? ' day-hours' : ' day-empty';
            cellContent = h > 0 ? h : '-';
            rowTotal += h;
          }
        } else {
          cellClass += ' day-empty';
          cellContent = '';
        }

        cellsHtml += `
          <td class="${cellClass}" onclick="TimesheetMgr.showEntryModal('${p.id}','${dateStr}')">
            <div class="day-cell-inner">${cellContent}</div>
          </td>`;
      }

      const { hakedis, kalan } = calcHakedis(p.id);
      const totalLabel = p.wageType === 'gunluk' ? `${rowTotal} gün` : `${rowTotal} s`;
      cellsHtml += `<td class="col-total">${totalLabel}</td>`;
      cellsHtml += `<td class="col-total" style="color:${kalan > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(kalan)}</td>`;
      rowsHtml += `<tr>${cellsHtml}</tr>`;
    }

    container.innerHTML = `
      <div style="margin-bottom:.5rem">
        <div class="puantaj-legend">
          <div class="legend-item"><div class="legend-box" style="background:#d1fae5"></div> Tam gün</div>
          <div class="legend-item"><div class="legend-box" style="background:#fef9c3"></div> Yarım gün</div>
          <div class="legend-item"><div class="legend-box" style="background:#e0e7ff"></div> Fazla mesai</div>
          <div class="legend-item"><div class="legend-box" style="background:#dbeafe"></div> Saatlik</div>
          <div class="legend-item"><div class="legend-box" style="background:#fffbeb"></div> Cumartesi</div>
          <div class="legend-item"><div class="legend-box" style="background:#fff0f0"></div> Pazar</div>
        </div>
        <p class="text-xs text-secondary" style="margin-bottom:.5rem">Hücreye tıklayarak giriş yapın.</p>
      </div>
      <div class="puantaj-wrap">
        <table class="puantaj-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  },

  showEntryModal(personnelId, date) {
    const p = Personnel.get(personnelId);
    if (!p) return;

    const modal = document.getElementById('modal-ts-entry');
    const form  = document.getElementById('form-ts-entry');
    form.reset();
    form['ts-personnel-id'].value = personnelId;
    form['ts-date'].value         = date;

    document.getElementById('modal-ts-title').textContent = `Puantaj — ${p.name} (${formatDate(date)})`;

    const isGunluk = p.wageType === 'gunluk';
    document.getElementById('ts-gunluk-fields').style.display  = isGunluk  ? '' : 'none';
    document.getElementById('ts-saatlik-fields').style.display = !isGunluk ? '' : 'none';

    const existing = Timesheet.getByPersonnelDate(personnelId, date);
    if (existing) {
      if (isGunluk) {
        form['ts-dayvalue'].value     = existing.dayValue     || '';
        form['ts-overtime'].value     = existing.overtimeHours || '';
      } else {
        form['ts-hours'].value        = existing.hours         || '';
        form['ts-overtime-h'].value   = existing.overtimeHours || '';
      }
      form['ts-notes'].value = existing.notes || '';
      document.getElementById('ts-delete-btn').style.display = '';
      document.getElementById('ts-delete-btn').onclick = () => {
        Timesheet.deleteByPersonnelDate(personnelId, date);
        modal.close();
        this.render();
        showToast('Giriş silindi', 'danger');
      };
    } else {
      document.getElementById('ts-delete-btn').style.display = 'none';
    }

    modal.showModal();
  },

  saveEntry(e) {
    e.preventDefault();
    const form        = e.target;
    const personnelId = form['ts-personnel-id'].value;
    const date        = form['ts-date'].value;
    const p           = Personnel.get(personnelId);
    if (!p) return;

    const isGunluk = p.wageType === 'gunluk';
    const data = { personnelId, date };

    if (isGunluk) {
      const dayValue = parseFloat(form['ts-dayvalue'].value);
      if (!dayValue && dayValue !== 0) { showToast('Gün değeri girin', 'danger'); return; }
      data.dayValue      = dayValue;
      data.overtimeHours = parseFloat(form['ts-overtime'].value) || 0;
    } else {
      const hours = parseFloat(form['ts-hours'].value);
      if (!hours && hours !== 0) { showToast('Saat girin', 'danger'); return; }
      data.hours         = hours;
      data.overtimeHours = parseFloat(form['ts-overtime-h'].value) || 0;
    }
    data.notes = form['ts-notes'].value.trim();

    Timesheet.upsert(data);
    document.getElementById('modal-ts-entry').close();
    this.render();
    showToast('Puantaj kaydedildi', 'success');
  }
};
