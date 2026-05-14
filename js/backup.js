'use strict';

const BackupMgr = {
  render() {
    // Static section, nothing to compute
  },

  download() {
    const json    = exportDB();
    const blob    = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    const site    = Sites.active();
    const dateStr = todayStr().replace(/-/g, '');
    a.href     = url;
    a.download = `santiye_yedek_${site?.name?.replace(/\s+/g,'_') || 'tum'}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    showToast('Yedek indirildi', 'success');
  },

  triggerImport() {
    document.getElementById('backup-file-input').click();
  },

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const ok = await confirmDialog(
        'Mevcut tüm veriler bu yedek dosyasıyla değiştirilecek. Devam etmek istiyor musunuz?',
        'Evet, Yükle', 'btn-primary'
      );
      if (!ok) { e.target.value = ''; return; }
      const success = importDB(ev.target.result);
      if (success) {
        renderHeader();
        navigate('panel');
        showToast('Yedek başarıyla yüklendi', 'success');
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  },

  async clearAll() {
    const ok1 = await confirmDialog(
      'TÜM veriler silinecek. Bu işlem geri alınamaz. Önce yedek almayı unutmayın!',
      'Evet, Devam Et', 'btn-danger'
    );
    if (!ok1) return;
    const ok2 = await confirmDialog(
      'Son onay: Tüm şantiye, gelir/gider ve puantaj verileri kalıcı olarak silinecek.',
      'Tamamen Sil', 'btn-danger'
    );
    if (!ok2) return;

    localStorage.removeItem(DB_KEY);
    resetDB();
    renderHeader();
    navigate('santiyeler');
    showToast('Tüm veriler silindi', 'danger');
  }
};
