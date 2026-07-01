/* ============================================================
   reset.js
   「売上リセット機能」担当ファイル。

   このファイルには以下だけが入っています：
   ① 早朝5時を境に「営業日」を切り替える表示ロジック
      （残高計算には一切影響しません。表示のみ）
   ② 営業日の自動ロールオーバー監視（ブラウザを開いたまま5時を
      跨いだ場合に、自動で営業日を更新して再描画する）
   ③ お客様1人の注文・残高・チケットを初期状態に戻す
   ④ 注文中の内容だけを取り消す
   ⑤ 全員のデータを初期状態に戻す（全リセット）
   ⑥ 保存データを完全に消去する
   ⑦ データのバックアップ書き出し／復元

   「リセット・初期化・バックアップまわりだけ直したい」時は
   このファイルだけを見れば完結するようにしてあります。
   app.js 側の customers / menu / saveData / showToast / showConfirm /
   render などの共通処理を呼び出して使っています。
   ============================================================ */

/* ---------- ① 早朝5時リセット（営業日）ロジック ---------- */
// 当日午前5時を基準に「営業日」を判定する。
// 5時以降 → 営業日は本日の日付
// 5時より前 → 営業日は前日の日付（深夜営業の延長とみなす）
// この判定は来店履歴の「表示」だけに使用し、残高計算には一切影響させない。
function getBusinessDateKey(d) {
  const dt = new Date(d);
  if (dt.getHours() < 5) dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`;
}
let CURRENT_BUSINESS_DATE = getBusinessDateKey(new Date());

/* ---------- ② 営業日の自動ロールオーバー監視 ---------- */
// ブラウザ／タブを開いたまま早朝5時をまたいだ場合、CURRENT_BUSINESS_DATE が
// 更新されないままだと「本日分」の集計（getTodayTicketStats等）や
// 履歴タブの表示が古い営業日のまま止まってしまう。
// そこで「今の時刻から計算した営業日」と「今保持している営業日」を
// 定期的に比較し、ズレていたら更新→再描画→トースト通知を行う。
//
// チェックのタイミングは2つ：
//   1) setInterval による定期チェック（1分ごと）
//   2) タブがフォーカス／表示状態に戻った瞬間
//      （スマホでスリープ後に開いた時など、setIntervalがバックグラウンドで
//       間引かれるケースをカバーするため）
//
// この処理は「表示上の営業日」を切り替えるだけで、残高・注文・
// チケット枚数などのデータには一切手を加えない。
function checkBusinessDateRollover() {
  const latest = getBusinessDateKey(new Date());
  if (latest === CURRENT_BUSINESS_DATE) return; // まだ切り替わっていない
  CURRENT_BUSINESS_DATE = latest;
  // 「本日分」集計・履歴の絞り込みは CURRENT_BUSINESS_DATE を参照している
  // だけなので、再描画すれば自動的に新しい営業日の内容に切り替わる。
  if (typeof render === 'function') render();
  if (typeof showToast === 'function') showToast('🌅 営業日が更新されました');
}

// 1分ごとの定期チェック（5時ちょうどに厳密に反応する必要はないため）
setInterval(checkBusinessDateRollover, 60 * 1000);
// タブがフォーカスされた瞬間にも即座にチェック（PCブラウザ向け）
window.addEventListener('focus', checkBusinessDateRollover);
// スマホでスリープ復帰・タブ切替から戻った瞬間にも即座にチェック
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkBusinessDateRollover();
});

/* ---------- ③ お客様1人分のリセット（🔄ボタン） ---------- */
function performSingleReset(id) {
  const c = getCustomer(id);
  if (!c) return;
  showConfirm(`「${c.name}」さんの注文・残高・枚数・追加売上を\n初期状態に戻しますか？`, '全リセットする', () => {
    c.orders = []; c.balance = 1200; c.tickets = 1; c.ticketNumbers = [1]; c.extraSales = [];
    saveData(); showToast(`${c.name} さんをリセットしました`); renderCustomerList();
  });
}

/* ---------- ④ 注文画面：今回の注文だけを取り消す ---------- */
function performCurrentOrderReset() {
  const c = getCustomer(selectedId);
  if (!c) return;
  showConfirm('今回の注文を全リセットしますか？', '全て取り消す', () => {
    c.balance += c.orders.reduce((s, o) => s + o.price, 0);
    c.orders = []; saveData(); render();
  });
}

/* ---------- ⑤ 設定タブ：全員のデータをリセット ---------- */
function performResetAllCustomers() {
  showConfirm('全員をリセットしますか？', 'リセット', () => {
    customers.forEach(c => { c.balance = 1200; c.tickets = 1; c.ticketNumbers = [1]; c.orders = []; c.sessions = []; c.extraSales = []; c.editing = false; });
    saveData(); render();
  });
}

/* ---------- ⑥ 設定タブ：保存データを完全削除 ---------- */
function performClearStorage() {
  showConfirm('データを全消去しますか？', '消去する', () => {
    localStorage.removeItem(STORAGE_KEY); location.reload();
  });
}

/* ---------- ⑦ バックアップ：書き出し・復元 ---------- */
// 現在の全データ（customers, menu, nextId, nextMenuId）をJSONファイルとして書き出す。
function exportBackup() {
  const data = {
    customers: customers.map(c => ({ ...c, editing: false })),
    menu, extraMenu, nextId, nextMenuId,
    exportedAt: nowStr()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const fname = `drink-ticket-backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.json`;
  const a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  lastBackupAt = nowStr();
  try { localStorage.setItem(STORAGE_KEY + '-last-backup', lastBackupAt); } catch(e) {}
  showToast('📤 バックアップを書き出しました');
  render();
}

// 選択されたJSONバックアップファイルを読み込み、確認の上で現在のデータを上書き復元する。
function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try { data = JSON.parse(e.target.result); }
    catch (err) { showToast('⚠️ ファイルの読み込みに失敗しました'); return; }
    if (!data || !Array.isArray(data.customers)) { showToast('⚠️ バックアップファイルの形式が正しくありません'); return; }
    showConfirm('バックアップから復元しますか？\n現在のデータは上書きされます。', '復元する', () => {
      customers = data.customers.map(c => ({
        ticketNumbers: Array.from({ length: c.tickets || 1 }, (_, i) => i + 1),
        extraSales: [],
        ...c
      }));
      if (Array.isArray(data.menu)) menu = data.menu.map(m => ({ sizes: [], temps: [], ...m }));
      if (Array.isArray(data.extraMenu)) {
        extraMenu = DEFAULT_EXTRA_MENU.map(defCat => {
          const saved = data.extraMenu.find(x => x.key === defCat.key);
          if (!saved) return { ...defCat };
          if (defCat.mode === 'time' || defCat.mode === 'fromMenu') return { ...defCat, ...saved, mode: defCat.mode };
          return { ...defCat, ...saved, items: Array.isArray(saved.items) ? saved.items : defCat.items };
        });
      }
      if (data.nextId) nextId = data.nextId;
      if (data.nextMenuId) nextMenuId = data.nextMenuId;
      saveData();
      showToast('📥 バックアップから復元しました');
      render();
    });
  };
  reader.readAsText(file);
}

/* ---------- リセット関連ボタンのイベント配線 ---------- */
// app.js の render() が、画面を描画するたびに毎回このさせ関数を呼び出す。
// 該当するボタンが今の画面に存在しない場合は何もしない（安全）。
function attachResetEvents() {
  // 顧客一覧の「🔄」個別リセット
  document.querySelectorAll('[data-reset]').forEach(el => {
    el.onclick = () => performSingleReset(parseInt(el.dataset.reset));
  });

  // 注文画面の「🔄 全リセット」（今回の注文のみ）
  const resetOrders = document.getElementById('reset-orders-btn');
  if (resetOrders) resetOrders.onclick = performCurrentOrderReset;

  // 設定タブの「全リセット」
  const resetAllBtn = document.getElementById('reset-all-customers-btn');
  if (resetAllBtn) resetAllBtn.onclick = performResetAllCustomers;

  // 設定タブの「完全削除」
  const clearStorageBtn = document.getElementById('clear-storage-btn');
  if (clearStorageBtn) clearStorageBtn.onclick = performClearStorage;

  // 設定タブの「バックアップを書き出す」
  const exportBtn = document.getElementById('backup-export-btn');
  if (exportBtn) exportBtn.onclick = exportBackup;

  // 設定タブの「バックアップから復元」
  const importBtn = document.getElementById('backup-import-btn');
  const importInput = document.getElementById('backup-import-input');
  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => {
      const file = importInput.files[0];
      if (file) importBackupFile(file);
      importInput.value = '';
    };
  }
}
