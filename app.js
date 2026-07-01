/* ============================================================
   app.js
   「計算・ロジック」担当ファイル。
   顧客・注文・メニューの管理、画面の描画（renderXxx）、
   検索、チケット番号管理などの中心的な処理をまとめています。

   ※「売上リセット」「全消去」「バックアップ」機能は reset.js に
     分離してあります。そちらを直す際はこのファイルを触る必要は
     基本的にありません。
   ============================================================ */

const STORAGE_KEY = 'drink-ticket-app-v1';

// ドリンク券1枚あたりの「販売価格」（＝売上に計上される金額）と
// 「利用価値」（＝購入時に残高へ加算される金額）。
const TICKET_SALE_PRICE = 1000;
const TICKET_VALUE = 1200;

const DEFAULT_MENU = [
  { id: 1,  name: 'ビール',         price: 600, sizes: [], temps: [] },
  { id: 2,  name: '生ビール',       price: 700, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: [] },
  { id: 3,  name: 'ハイボール',     price: 500, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: [] },
  { id: 4,  name: '酎ハイ',         price: 500, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: [] },
  { id: 5,  name: '日本酒',         price: 600, sizes: [], temps: [] },
  { id: 6,  name: 'ワイン',         price: 550, sizes: [], temps: [] },
  { id: 7,  name: 'ウーロン茶',     price: 350, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: ['HOT','ICE'] },
  { id: 8,  name: 'コーラ',         price: 350, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: [] },
  { id: 9,  name: 'オレンジジュース', price: 400, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: [] },
  { id: 10, name: 'ノンアル',       price: 400, sizes: [{label:'S',priceDiff:0},{label:'L',priceDiff:100}], temps: ['HOT','ICE'] },
];

/* ---------- 追加売上メニュー（ラビ・貸卓・フード・教室） ----------
   既存の menu（ドリンク引換券メニュー＝残高を消費するだけ）とは別物。
   こちらはタップした瞬間に「本日の売上」へ即計上される現金商品。
   mode: 'tap'      → ボタン1回タップ＝1個購入（個数連打で積み上げ）
   mode: 'time'      → 分刻みのプリセットボタン（分数 ÷10 × ratePer10Min で計算）
   mode: 'fromMenu'  → items を持たず、既存のドリンク引換券メニュー（menu）を
                        そのまま流用して表示する（品揃え・価格を二重管理しない） */
const DEFAULT_EXTRA_MENU = [
  {
    key: 'rabi', label: '🪙 ラビ販売', mode: 'tap',
    items: [
      { id: 'rabi_500',  name: 'ラビ 500円',   price: 500 },
      { id: 'rabi_1000', name: 'ラビ 1,000円', price: 1000 },
      { id: 'rabi_2000', name: 'ラビ 2,000円', price: 2000 },
      { id: 'rabi_3000', name: 'ラビ 3,000円', price: 3000 },
      { id: 'rabi_5000', name: 'ラビ 5,000円', price: 5000 }
    ]
  },
  {
    key: 'table', label: '🀄 貸卓（時間課金）', shortLabel: '貸卓', mode: 'time',
    ratePer10Min: 100, presetMinutes: [30, 60, 90, 120] // ※時間計算方式は後日再検討予定の暫定仕様
  },
  {
    key: 'drink', label: '🥤 ドリンク単品（ドリンク券メニューと共通）', mode: 'fromMenu'
  },
  {
    key: 'snack', label: '🍘 お菓子', mode: 'tap',
    items: [
      { id: 'snack_potechi', name: 'ポテトチップス', price: 200 },
      { id: 'snack_kakipi',  name: '柿ピー',         price: 200 },
      { id: 'snack_other',   name: 'その他',         price: 0, isOther: true }
    ]
  },
  {
    key: 'noodle', label: '🍜 カップ麺', mode: 'tap',
    items: [
      { id: 'noodle',       name: 'カップ麺', price: 400 },
      { id: 'noodle_other', name: 'その他',   price: 0, isOther: true }
    ]
  },
  {
    key: 'lesson', label: '📚 麻雀教室（10分100円）', shortLabel: '麻雀教室', mode: 'time',
    ratePer10Min: 100, presetMinutes: [10, 20, 30, 60] // ※時間計算方式は後日再検討予定の暫定仕様
  }
];

const INITIAL_NAMES = [
  'お客様01','お客様02','お客様03','お客様04','お客様05','お客様06',
  'お客様07','お客様08','お客様09','お客様10','お客様11','お客様12',
  'お客様13','お客様14','お客様15','お客様16','お客様17','お客様18',
  'お客様19','お客様20','お客様21','お客様22','お客様23','お客様24',
  'お客様25','お客様26','お客様27','お客様28','お客様29','お客様30',
  'お客様31','お客様32','お客様33','お客様34','お客様35','お客様36',
  'お客様37','お客様38','お客様39','お客様40','お客様41'
];

const DEFAULT_CUSTOMERS = INITIAL_NAMES.map((name, i) => ({
  id: i + 1, name, balance: 1200, tickets: 1, ticketNumbers: [1],
  ticketSales: [], totalPurchased: 1,
  orders: [], sessions: [], extraSales: [], editing: false
}));

const BALANCE_OPTIONS = Array.from({ length: 121 }, (_, i) => i * 50);

/* ---------- データの保存・読み込み ---------- */

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customers: customers.map(c => ({ ...c, editing: false })),
      menu, extraMenu, nextId, nextMenuId, totalSalesAmount
    }));
  } catch(e) {}
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.customers) customers = data.customers.map(c => ({
      ticketNumbers: Array.from({ length: c.tickets || 1 }, (_, i) => i + 1),
      ticketSales: [],
      totalPurchased: c.tickets || 1,
      extraSales: [], // 旧データ（追加売上機能実装前）を読み込んだ場合の初期値
      ...c
    }));
    if (data.menu) menu = data.menu.map(m => ({ sizes: [], temps: [], ...m }));
    // extraMenu は「カテゴリ構成」が変わる可能性があるため、保存データに
    // 存在するカテゴリのみ価格・プリセットを上書きし、新規追加されたカテゴリ
    // （アプリ更新で増えた項目）はデフォルトのまま維持する。
    if (Array.isArray(data.extraMenu)) {
      extraMenu = DEFAULT_EXTRA_MENU.map(defCat => {
        const saved = data.extraMenu.find(x => x.key === defCat.key);
        if (!saved) return { ...defCat };
        if (defCat.mode === 'time' || defCat.mode === 'fromMenu') return { ...defCat, ...saved, mode: defCat.mode };
        // 保存データにある品目はそのまま維持しつつ、アプリ更新で新しく増えた
        // デフォルト品目（例：「その他」）が保存データに無ければ追加する。
        const savedItems = Array.isArray(saved.items) ? saved.items : defCat.items;
        const savedIds = new Set(savedItems.map(i => i.id));
        const missingDefaults = (defCat.items || []).filter(i => !savedIds.has(i.id));
        return { ...defCat, ...saved, items: [...savedItems, ...missingDefaults] };
      });
    }
    if (data.nextId) nextId = data.nextId;
    if (data.nextMenuId) nextMenuId = data.nextMenuId;
    if (typeof data.totalSalesAmount === 'number') totalSalesAmount = data.totalSalesAmount;
    return true;
  } catch(e) { return false; }
}

let menu = DEFAULT_MENU.slice();
let extraMenu = DEFAULT_EXTRA_MENU.map(cat => ({ ...cat, items: cat.items ? cat.items.map(i => ({ ...i })) : undefined }));
let nextMenuId = 11;
let customers = DEFAULT_CUSTOMERS.map(c => ({ ...c }));
let nextId = customers.length + 1;
let totalSalesAmount = 0; // ② 売上合計（円）。ドリンク券を1枚販売するたびに TICKET_SALE_PRICE(1,000円) が加算される。
loadData();

/* ---------- 画面状態（どのタブ・どの画面を表示中か） ---------- */

let view = 'list', selectedId = null, tab = 'list', searchQuery = '', searchDone = false, confirmCallback = null;
let menuSearchQuery = ''; // メニュー管理タブのドリンク名検索（ライブ絞り込み）
let historyFrom = '', historyTo = ''; // 履歴タブの日付絞り込み（from/to）。タブを行き来しても値は保持される。
let lastBackupAt = localStorage.getItem(STORAGE_KEY + '-last-backup') || ''; // 最終バックアップ日時（ページ再読込しても保持／reset.jsが更新）
let popupItemId = null, popupSelectedSize = null, popupSelectedTemp = null;
let manageTicketsId = null;

function getCustomer(id) { return customers.find(c => c.id === id); }

/* ---------- カフェ用ダミー伝票（お名前が分からないお客様向け） ----------
   麻雀のお客様と違い、カフェのお客様はお名前が分からないことが多い。
   名前入力なしでワンタップで伝票（顧客）を作成し、そのまま注文画面を開く。
   isDummy: true を付けておくことで、後から本名が分かった際に
   performRenameCustomer() でいつでも名前を設定し直せるようにする。 */
function performCreateDummyTicket() {
  const id = nextId++;
  const name = `☕匿名${id}`;
  customers.push({
    id, name, balance: 1200, tickets: 1, ticketNumbers: [1],
    ticketSales: [], totalPurchased: 1,
    orders: [], sessions: [], extraSales: [], editing: false,
    isDummy: true
  });
  saveData();
  selectedId = id; view = 'order';
  showToast(`${name} の伝票を作成しました`);
  render();
}

// お客様の名前を後から設定・変更する（ダミー伝票 → 本名が分かった時などに使用）。
function performRenameCustomer(id) {
  const c = getCustomer(id);
  if (!c) return;
  const input = window.prompt('お名前を入力してください', c.isDummy ? '' : c.name);
  if (input === null) return; // キャンセル
  const trimmed = input.trim();
  if (!trimmed) { showToast('お名前を入力してください'); return; }
  c.name = trimmed;
  c.isDummy = false;
  saveData();
  showToast('お名前を更新しました');
  render();
}

/* ---------- ① チケット枚数計算ロジック ---------- */
// 1枚 = TICKET_VALUE（1,200円）分の価値。
// 残高が1,200円増えるごとにチケットを1枚としてカウントする。
// 例）残高1,200円 → 1枚　残高2,400円 → 2枚　残高1,200円未満 → 0枚
function getValidTicketCount(c) {
  return Math.floor((c.balance || 0) / TICKET_VALUE);
}

/* ---------- チケット番号の「有効な分だけ」表示ロジック ---------- */
// 上のgetValidTicketCount()が返す枚数ぶんだけ、所持しているチケット№
// （若い番号から）を「有効」として表示する。
// ※これは「表示」だけのロジックで、チケット自体の所持数（tickets／
//   ticketNumbers）や、累計購入枚数（totalPurchased）は変更しない。
function getValidTicketNumbers(c) {
  const validCount = getValidTicketCount(c);
  if (validCount <= 0) return [];
  const nums = (c.ticketNumbers || []).slice().sort((a, b) => a - b);
  return nums.slice(0, Math.min(validCount, nums.length));
}

/* ---------- 本日（営業日）分の注文数・売上集計 ---------- */
// ドリンク券が販売される度に c.ticketSales へ { number, timestamp, price } を
// 記録している。ここでは reset.js の getBusinessDateKey / CURRENT_BUSINESS_DATE
// （早朝5時で切り替わる「営業日」判定）を使って「本日分」だけを集計する。
// 日付が変わればフィルタ結果が自動的に0件に戻るため、深夜0時ではなく
// 早朝5時に自動でリセットされたのと同じ見え方になる。
function getTodayTicketStats(c) {
  const sales = (c.ticketSales || []).filter(s =>
    s.timestamp && getBusinessDateKey(s.timestamp) === CURRENT_BUSINESS_DATE
  );
  return {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + (s.price || TICKET_SALE_PRICE), 0)
  };
}

function getStoreTodayStats() {
  return customers.reduce((acc, c) => {
    const s = getTodayTotalStats(c);
    acc.count += s.count; acc.total += s.total;
    return acc;
  }, { count: 0, total: 0 });
}

/* ---------- 本日（営業日）分の「追加売上」集計 ----------
   ラビ／貸卓／ドリンク単品／お菓子／カップ麺／麻雀教室など、
   customer.extraSales に記録された現金売上を、ドリンク券の
   getTodayTicketStats と全く同じ「営業日」判定で集計する。 */
function getTodayExtraStats(c) {
  const sales = (c.extraSales || []).filter(s =>
    s.timestamp && getBusinessDateKey(s.timestamp) === CURRENT_BUSINESS_DATE
  );
  return {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + (s.amount || 0), 0)
  };
}

function getAllTimeExtraStats(c) {
  const sales = c.extraSales || [];
  return {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + (s.amount || 0), 0)
  };
}

/* ---------- 「ドリンク券売上」＋「追加売上」を合算した総合売上 ----------
   顧客一覧・伝票画面の「本日売上」表示は、すべてこの関数経由にする。
   ここを直せば一覧・伝票・店舗合計のすべてに反映される。 */
function getTodayTotalStats(c) {
  const t = getTodayTicketStats(c);
  const e = getTodayExtraStats(c);
  return { count: t.count + e.count, total: t.total + e.total };
}

function getAllTimeTotalStats(c) {
  const t = getAllTimeTicketStats(c);
  const e = getAllTimeExtraStats(c);
  return { count: t.count + e.count, total: t.total + e.total };
}

/* ---------- 累計（全期間）の注文数・売上集計 ---------- */
// getTodayTicketStats() が「本日分」だけを見るのに対し、こちらは日付で
// 絞り込まず、そのお客様が今までに購入したチケット（ticketSales）を
// すべて合計する。顧客一覧の「注文数合計」「売上合計」列で使用する。
function getAllTimeTicketStats(c) {
  const sales = c.ticketSales || [];
  return {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + (s.price || TICKET_SALE_PRICE), 0)
  };
}

/* ---------- 履歴タブ用ヘルパー ---------- */
// 全顧客のsessions（来店履歴）を1つの配列にまとめ、新しい順に並べる。
// customers配列やsessions自体は変更しない（読み取り専用）。
function getAllSessions() {
  const all = [];
  customers.forEach(c => {
    (c.sessions || []).forEach((s, idx) => {
      all.push({ ...s, customerName: c.name, customerId: c.id, sessionIdx: idx });
    });
  });
  return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function timestampToDateInputValue(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 日付（from/to）でセッション一覧を絞り込む。timestampを持たない旧データは
// 絞り込み条件が指定されていない場合のみ表示する。
function filterSessionsByDate(sessions, from, to) {
  if (!from && !to) return sessions;
  return sessions.filter(s => {
    if (!s.timestamp) return false;
    const dateStr = timestampToDateInputValue(s.timestamp);
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  });
}

function nowStr() {
  const d = new Date();
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ---------- 共通UI部品（トースト・確認ダイアログ） ---------- */

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2500);
}

function showConfirm(msg, okLabel, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok').textContent = okLabel || '実行する';
  document.getElementById('confirm-overlay').classList.add('show');
  confirmCallback = cb;
}

/* ---------- 顧客一覧 ---------- */

function renderCustomerList() {
  const container = document.getElementById('customer-list-container');
  if (!container) return;
  if (!searchDone) {
    container.innerHTML = '<p class="search-hint">🔍 上の検索欄から名前を入力して<br>お客様を呼び出してください</p>';
    return;
  }
  const q = searchQuery.replace(/\s/g,'');
  const filtered = q ? customers.filter(c => c.name.replace(/\s/g,'').includes(q)) : [];

  // 現在表示されている検索結果（filtered）の合計売上・合計注文数をその場で集計
  const resultStats = filtered.reduce((acc, c) => {
    const t = getAllTimeTotalStats(c);
    acc.count += t.count; acc.total += t.total;
    return acc;
  }, { count: 0, total: 0 });
  const resultSummary = filtered.length
    ? `<div class="search-result-summary">
        <span>🔎 検索結果：<strong>${filtered.length}名</strong></span>
        <span>📋 注文数合計：<strong>${resultStats.count}件</strong></span>
        <span>💰 売上合計：<strong>¥${resultStats.total.toLocaleString()}</strong></span>
      </div>`
    : '';

  container.innerHTML = resultSummary + (filtered.length
    ? filtered.map(c => customerItemHTML(c)).join('')
    : '<p style="color:var(--text-muted);text-align:center;padding:1rem 0;">該当なし</p>');
  attachCustomerEvents();
}

function customerItemHTML(c) {
  const low = c.balance > 0 && c.balance < 400;
  const empty = c.balance === 0;
  const balClass = empty ? 'empty' : low ? 'low' : '';

  // 累計購入枚数（削除・並び替えをしても減らない、店員が「〇枚目」とコールするための数）
  const totalPurchased = c.totalPurchased || c.tickets || 1;
  const ticketBadge = `<span class="tickets-badge">累計${totalPurchased}枚</span>`;

  // 残高に基づく「有効な」チケット№だけを表示（1,200円未満は非表示）
  const validNums = getValidTicketNumbers(c);
  const ticketNumsLine = validNums.length
    ? `<div class="ticket-nums">✅ 有効№：${validNums.join(', ')}</div>`
    : '';

  // 本日（営業日）分の注文数合計・売上合計（ドリンク券販売＋追加売上メニューの合算）
  const stats = getTodayTotalStats(c);
  const salesInfoRow = `<div class="sales-info-row">
      <span>📋 本日注文数：<strong>${stats.count}件</strong></span>
      <span>💰 本日売上：<strong>¥${stats.total.toLocaleString()}</strong></span>
    </div>`;

  // 累計（全期間）の注文数合計・売上合計（ドリンク券販売＋追加売上メニューの合算）
  const totalStats = getAllTimeTotalStats(c);
  const totalInfoRow = `<div class="sales-info-row total-row">
      <span>🗂 注文数合計：<strong>${totalStats.count}件</strong></span>
      <span>💴 売上合計：<strong>¥${totalStats.total.toLocaleString()}</strong></span>
    </div>`;

  const editRow = c.editing ? `
    <div class="edit-row">
      <select class="edit-bal-select" data-id="${c.id}">
        ${BALANCE_OPTIONS.map(v => `<option value="${v}"${v === Math.round(c.balance/50)*50?' selected':''}>¥${v.toLocaleString()}</option>`).join('')}
      </select>
      <button class="btn-save" data-save="${c.id}">保存</button>
    </div>` : '';
  // ダミー伝票（カフェ等、来店時にお名前が分からないお客様）には目印バッジを付ける
  const dummyBadge = c.isDummy ? `<span class="tickets-badge" style="background:var(--pop-sky-light);color:var(--pop-sky-dark);">☕ 名前未設定</span>` : '';
  return `<div class="customer-item">
    <div class="customer-item-top">
      <span class="customer-name">${c.name}${ticketBadge}${dummyBadge}</span>
      <span class="balance-display ${balClass}">¥${c.balance.toLocaleString()}</span>
    </div>
    ${ticketNumsLine}
    ${salesInfoRow}
    ${totalInfoRow}
    <div class="customer-item-actions">
      <button class="btn btn-order" data-order="${c.id}">🍹 注文</button>
      <button class="btn btn-ticket" data-addticket="${c.id}">🎫+1枚売る</button>
      <button class="btn btn-edit" data-manage-tickets="${c.id}">🎫</button>
      <button class="btn btn-edit" data-edit="${c.id}">✏️</button>
      <button class="btn btn-edit" data-rename="${c.id}">📝名前</button>
      <button class="btn btn-reset" data-reset="${c.id}">🔄</button>
      <button class="btn btn-delete" data-delete="${c.id}">🗑</button>
    </div>
    ${editRow}
  </div>`;
}

/* ---------- メニュー管理 ---------- */

function renderMenuRows() {
  const container = document.getElementById('menu-list-container');
  if (!container) return;
  const q = menuSearchQuery.replace(/\s/g, '');
  const filtering = !!q;
  const entries = menu
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => !q || m.name.replace(/\s/g, '').includes(q));

  if (!entries.length) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:8px 0;">${menu.length ? '該当するメニューがありません' : 'メニューがありません'}</p>`;
    return;
  }

  container.innerHTML = entries.map(({ m, index }) => {
    const opts = [];
    if ((m.sizes || []).length > 0) opts.push('S/L');
    if ((m.temps || []).length > 0) opts.push('HOT/ICE');
    const optText = opts.length ? `<br><span style="font-size:11px;color:var(--text-muted);font-weight:500;">↳ ${opts.join('＋')}</span>` : '';
    // 検索で絞り込み中は表示順が実際の並び順と異なるため、▲▼の並び替えは非表示にする
    const sortActions = filtering ? '' : `
      <div class="menu-sort-actions" style="margin-top:2px;">
        <button class="btn-sort" onclick="moveMenu(${index},-1)" ${index===0?'disabled':''}>▲</button>
        <button class="btn-sort" onclick="moveMenu(${index},1)" ${index===menu.length-1?'disabled':''}>▼</button>
      </div>`;
    return `<div class="menu-item-row" style="align-items:flex-start;">
      ${sortActions}
      <span class="menu-item-name" style="margin-left:4px;padding-top:6px;">${m.name}${optText}</span>
      <div class="menu-price-edit-wrap" style="margin-top:2px;">
        <input class="menu-price-edit-input" type="number" value="${m.price}" min="0" step="50" onchange="updateMenuPrice(${m.id},this.value)">
        <span class="menu-price-edit-unit">円</span>
      </div>
      <button class="btn-menu-delete" data-menu-delete="${m.id}" style="margin-top:2px;">🗑</button>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-menu-delete]').forEach(el => {
    el.onclick = () => {
      const m = menu.find(x => x.id === parseInt(el.dataset.menuDelete));
      showConfirm(`「${m.name}」を削除しますか？`, '削除する', () => {
        menu = menu.filter(x => x.id !== m.id);
        saveData(); showToast(`${m.name} を削除しました`); render();
      });
    };
  });
}

function updateMenuPrice(id, newPrice) {
  const price = parseInt(newPrice);
  if (isNaN(price) || price < 0) { showToast('正しい金額を入力してください'); render(); return; }
  if (price % 50 !== 0) { showToast('⚠️ 金額は50円単位で入力してください'); render(); return; }
  const item = menu.find(m => m.id === id);
  if (item) { item.price = price; saveData(); showToast(`${item.name}の価格を¥${price}に変更しました`); }
}

function moveMenu(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= menu.length) return;
  const temp = menu[index]; menu[index] = menu[targetIndex]; menu[targetIndex] = temp;
  saveData(); render();
}

/* ---------- お菓子・カップ麺（追加売上メニュー）の自由な追加・削除・価格編集 ----------
   ラビ／貸卓／ドリンク単品／麻雀教室は固定の品揃え・計算方式のため対象外。
   snack・noodle の2カテゴリだけ、既存の「メニュー管理」と同じ操作感で
   品目を自由に増減できるようにする。 */
const EXTRA_EDITABLE_CATEGORY_KEYS = ['snack', 'noodle'];

function renderExtraMenuManageRows() {
  const container = document.getElementById('extra-menu-list-container');
  if (!container) return;
  const editableCats = extraMenu.filter(c => EXTRA_EDITABLE_CATEGORY_KEYS.includes(c.key));
  const rows = [];
  editableCats.forEach(cat => {
    // 「その他」はタップの都度金額を入力する仕組みのため、固定価格編集の対象外とする。
    (cat.items || []).filter(item => !item.isOther).forEach(item => rows.push({ cat, item }));
  });
  if (!rows.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:8px 0;">商品がありません</p>';
    return;
  }
  container.innerHTML = rows.map(({ cat, item }) => {
    const catShort = cat.label.replace(/^\S+\s/, '');
    return `<div class="menu-item-row">
      <span class="menu-item-name">${item.name}<br><span style="font-size:11px;color:var(--text-muted);font-weight:500;">↳ ${catShort}</span></span>
      <div class="menu-price-edit-wrap">
        <input class="menu-price-edit-input" type="number" value="${item.price}" min="0" step="50" onchange="updateExtraMenuPrice('${cat.key}','${item.id}',this.value)">
        <span class="menu-price-edit-unit">円</span>
      </div>
      <button class="btn-menu-delete" data-extra-menu-delete="${cat.key}:${item.id}">🗑</button>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-extra-menu-delete]').forEach(el => {
    el.onclick = () => {
      const [catKey, itemId] = el.dataset.extraMenuDelete.split(':');
      const cat = extraMenu.find(x => x.key === catKey);
      const item = cat && (cat.items || []).find(i => i.id === itemId);
      if (!cat || !item) return;
      showConfirm(`「${item.name}」を削除しますか？`, '削除する', () => {
        cat.items = cat.items.filter(i => i.id !== itemId);
        saveData(); showToast(`${item.name} を削除しました`); render();
      });
    };
  });
}

function updateExtraMenuPrice(catKey, itemId, newPrice) {
  const price = parseInt(newPrice);
  if (isNaN(price) || price < 0) { showToast('正しい金額を入力してください'); render(); return; }
  if (price % 50 !== 0) { showToast('⚠️ 金額は50円単位で入力してください'); render(); return; }
  const cat = extraMenu.find(c => c.key === catKey);
  const item = cat && (cat.items || []).find(i => i.id === itemId);
  if (item) { item.price = price; saveData(); showToast(`${item.name}の価格を¥${price}に変更しました`); }
}

/* ---------- ドリンク注文ポップアップ（サイズ・温度選択） ---------- */

function openDrinkPopup(itemId) {
  const item = menu.find(m => m.id === itemId);
  if (!item) return;
  popupItemId = itemId;
  const sizes = item.sizes || [], temps = item.temps || [];
  popupSelectedSize = sizes.length > 0 ? 0 : null;
  popupSelectedTemp = temps.length > 0 ? temps[0] : null;
  document.getElementById('popup-drink-name').textContent = item.name;
  document.getElementById('popup-drink-base-price').textContent = sizes.length > 0 ? `基本価格 ¥${item.price.toLocaleString()}` : `¥${item.price.toLocaleString()}`;
  const sizeSection = document.getElementById('popup-size-section');
  const sizeRow = document.getElementById('popup-size-row');
  if (sizes.length > 0) {
    sizeSection.style.display = '';
    sizeRow.innerHTML = sizes.map((s, i) => {
      const price = item.price + s.priceDiff;
      const diffLabel = s.priceDiff > 0 ? `+¥${s.priceDiff}` : s.priceDiff < 0 ? `-¥${Math.abs(s.priceDiff)}` : '';
      return `<button class="popup-option-btn${i===0?' selected':''}" data-size-idx="${i}">
        <span class="opt-label">${s.label}</span>
        <span class="opt-price">¥${price.toLocaleString()}</span>
      </button>`;
    }).join('');
  } else { sizeSection.style.display = 'none'; }
  const tempSection = document.getElementById('popup-temp-section');
  const tempRow = document.getElementById('popup-temp-row');
  if (temps.length > 0) {
    tempSection.style.display = '';
    tempRow.innerHTML = temps.map((t, i) => {
      const icon = t === 'HOT' ? '☕ HOT' : '❄️ ICE';
      const cls = t === 'HOT' ? 'hot' : 'ice';
      return `<button class="popup-option-btn ${cls}${i===0?' selected':''}" data-temp="${t}">${icon}</button>`;
    }).join('');
  } else { tempSection.style.display = 'none'; }
  updatePopupTotal();
  document.getElementById('drink-popup-overlay').classList.add('show');
  attachPopupEvents();
}

function updatePopupTotal() {
  const item = menu.find(m => m.id === popupItemId);
  if (!item) return;
  const sizes = item.sizes || [];
  const diff = (sizes.length > 0 && popupSelectedSize !== null) ? sizes[popupSelectedSize].priceDiff : 0;
  const total = item.price + diff;
  const c = getCustomer(selectedId);
  document.getElementById('popup-total-price').textContent = `¥${total.toLocaleString()}`;
  const orderBtn = document.getElementById('popup-order-btn');
  if (orderBtn) { orderBtn.disabled = total > c.balance; orderBtn.style.opacity = total <= c.balance ? '1' : '0.4'; }
}

function attachPopupEvents() {
  document.querySelectorAll('[data-size-idx]').forEach(btn => {
    btn.onclick = () => {
      popupSelectedSize = parseInt(btn.dataset.sizeIdx);
      document.querySelectorAll('[data-size-idx]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updatePopupTotal();
    };
  });
  document.querySelectorAll('[data-temp]').forEach(btn => {
    btn.onclick = () => {
      popupSelectedTemp = btn.dataset.temp;
      document.querySelectorAll('[data-temp]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });
  document.getElementById('popup-cancel-btn').onclick = closeDrinkPopup;
  document.getElementById('drink-popup-overlay').onclick = (e) => { if (e.target === e.currentTarget) closeDrinkPopup(); };
  document.getElementById('popup-order-btn').onclick = () => {
    const item = menu.find(m => m.id === popupItemId);
    const c = getCustomer(selectedId);
    if (!item || !c) return;
    const sizes = item.sizes || [];
    const diff = (sizes.length > 0 && popupSelectedSize !== null) ? sizes[popupSelectedSize].priceDiff : 0;
    const finalPrice = item.price + diff;
    if (finalPrice > c.balance) return;
    const sizeParts = sizes.length > 0 && popupSelectedSize !== null ? sizes[popupSelectedSize].label : '';
    const tempPart = popupSelectedTemp ? (popupSelectedTemp === 'HOT' ? 'HOT' : 'ICE') : '';
    const suffix = [sizeParts, tempPart].filter(Boolean).join(' / ');
    const orderName = suffix ? `${item.name}（${suffix}）` : item.name;
    c.balance -= finalPrice;
    c.orders.push({ name: orderName, price: finalPrice });
    saveData(); closeDrinkPopup(); render();
  };
}

function closeDrinkPopup() {
  document.getElementById('drink-popup-overlay').classList.remove('show');
  popupItemId = null;
}

/* ---------- チケット№管理ポップアップ ---------- */

function openTicketManage(id) {
  manageTicketsId = id;
  renderTicketManage();
  document.getElementById('ticket-manage-overlay').classList.add('show');
}

function closeTicketManage() {
  document.getElementById('ticket-manage-overlay').classList.remove('show');
  manageTicketsId = null;
}

function renderTicketManage() {
  const c = getCustomer(manageTicketsId);
  if (!c) return;
  if (!c.ticketNumbers) c.ticketNumbers = [];
  document.getElementById('ticket-manage-name').textContent = `${c.name} 様のチケット№`;
  const nums = c.ticketNumbers.slice().sort((a,b) => a-b);
  const validSet = new Set(getValidTicketNumbers(c));
  const listEl = document.getElementById('ticket-manage-list');
  listEl.innerHTML = nums.length
    ? nums.map(n => {
        const valid = validSet.has(n);
        const bg = valid ? 'var(--pop-pink-light)' : 'var(--surface-1)';
        const fg = valid ? 'var(--pop-pink-dark)' : 'var(--text-muted)';
        const border = valid ? 'none' : '1.5px dashed var(--border)';
        const label = valid ? `№${n}` : `№${n}（残高不足）`;
        return `
          <span style="display:inline-flex;align-items:center;gap:6px;background:${bg};color:${fg};border:${border};border-radius:var(--radius-pill);padding:6px 8px 6px 14px;font-size:14px;font-weight:700;">
            ${label}
            <button data-del-ticket="${n}" style="border:none;background:rgba(0,0,0,0.08);color:inherit;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;">✕</button>
          </span>`;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px;">チケット№がありません</p>';
  const startInp = document.getElementById('ticket-renumber-start');
  startInp.value = nums.length ? nums[0] : 1;
  listEl.querySelectorAll('[data-del-ticket]').forEach(btn => {
    btn.onclick = () => {
      const n = parseInt(btn.dataset.delTicket);
      showConfirm(`№${n}を削除しますか？`, '削除する', () => {
        c.ticketNumbers = c.ticketNumbers.filter(x => x !== n);
        c.tickets = c.ticketNumbers.length;
        saveData(); renderTicketManage(); renderCustomerList();
      });
    };
  });
}

function attachTicketManageEvents() {
  const closeBtn = document.getElementById('ticket-manage-close-btn');
  if (closeBtn) closeBtn.onclick = closeTicketManage;
  const overlay = document.getElementById('ticket-manage-overlay');
  if (overlay) overlay.onclick = (e) => { if (e.target === e.currentTarget) closeTicketManage(); };
  const renumberBtn = document.getElementById('ticket-renumber-btn');
  if (renumberBtn) renumberBtn.onclick = () => {
    const c = getCustomer(manageTicketsId);
    if (!c) return;
    let start = parseInt(document.getElementById('ticket-renumber-start').value);
    if (isNaN(start) || start < 1) { showToast('正しい開始番号を入力してください'); return; }
    const count = c.ticketNumbers.length;
    c.ticketNumbers = Array.from({ length: count }, (_, i) => start + i);
    saveData(); showToast(`№${start}からの連番に変更しました`); renderTicketManage(); renderCustomerList();
  };
}

/* ---------- 追加売上メニュー（ラビ・貸卓・ドリンク単品・お菓子・カップ麺・麻雀教室） ----------
   タップした瞬間に customer.extraSales へ1件記録＝即座に「本日売上」へ計上される。
   ドリンク引換券メニュー（menu／drink-card）とは完全に独立した仕組み。 */

// カテゴリごとのボタン一覧HTML（tapモード＝商品ボタン、timeモード＝分数プリセットボタン）
function renderExtraMenuHTML() {
  return extraMenu.map(cat => {
    if (cat.mode === 'time') {
      const btns = (cat.presetMinutes || []).map(min => {
        const amount = Math.round((min / 10) * cat.ratePer10Min);
        return `<div class="drink-card" data-extra-time="${cat.key}:${min}">
          <p class="drink-name">${min}分</p>
          <p class="drink-price">¥${amount.toLocaleString()}</p>
        </div>`;
      }).join('');
      return `<p class="popup-section-label" style="margin-top:14px;">${cat.label}</p><div class="drink-grid">${btns}</div>`;
    }
    if (cat.mode === 'fromMenu') {
      // ドリンク単品は独自の品揃えを持たず、ドリンク券メニュー（menu）をそのまま表示する。
      // メニュー管理タブで品目・価格を変更すれば、こちらにも自動的に反映される。
      const btns = menu.map(item => `
        <div class="drink-card" data-extra="${cat.key}:${item.id}">
          <p class="drink-name">${item.name}</p>
          <p class="drink-price">¥${item.price.toLocaleString()}</p>
        </div>`).join('');
      return `<p class="popup-section-label" style="margin-top:14px;">${cat.label}</p><div class="drink-grid">${btns || '<p style="color:var(--text-muted);font-size:13px;">メニューがありません</p>'}</div>`;
    }
    const btns = (cat.items || []).map(item => `
      <div class="drink-card" data-extra="${cat.key}:${item.id}">
        <p class="drink-name">${item.name}</p>
        <p class="drink-price">${item.isOther ? '金額を入力' : `¥${item.price.toLocaleString()}`}</p>
      </div>`).join('');
    return `<p class="popup-section-label" style="margin-top:14px;">${cat.label}</p><div class="drink-grid">${btns}</div>`;
  }).join('');
}

// 本日分の追加売上ログ（新しい順）＋各行の取消(✕)ボタン
function renderExtraSalesLogHTML(c) {
  const todayExtra = (c.extraSales || []).filter(s =>
    !s.timestamp || getBusinessDateKey(s.timestamp) === CURRENT_BUSINESS_DATE
  );
  if (!todayExtra.length) {
    return { rowsHTML: '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:6px 0;">まだ追加売上はありません</p>', total: 0 };
  }
  const rowsHTML = todayExtra.slice().reverse().map(s => `
    <div class="order-row">
      <span>${s.name}</span>
      <span>¥${s.amount.toLocaleString()}
        <button data-extra-delete="${s.id}" style="border:none;background:rgba(0,0,0,0.08);color:inherit;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;line-height:1;margin-left:6px;">✕</button>
      </span>
    </div>`).join('');
  const total = todayExtra.reduce((sum, s) => sum + s.amount, 0);
  return { rowsHTML, total };
}

function attachExtraSalesEvents() {
  // タップ即注文（ラビ／ドリンク単品／お菓子／カップ麺）
  document.querySelectorAll('[data-extra]').forEach(el => {
    el.onclick = () => {
      const [catKey, itemId] = el.dataset.extra.split(':');
      const cat = extraMenu.find(x => x.key === catKey);
      if (!cat) return;
      // fromMenu（ドリンク単品）は menu 配列（id は数値）、それ以外は cat.items（id は文字列）から探す
      const item = cat.mode === 'fromMenu'
        ? menu.find(m => m.id === parseInt(itemId))
        : (cat.items || []).find(i => i.id === itemId);
      const c = getCustomer(selectedId);
      if (!item || !c) return;
      if (!c.extraSales) c.extraSales = [];

      // 「その他」項目は固定金額を持たないため、タップ時にその場で金額を入力してもらう。
      if (item.isOther) {
        const amountStr = window.prompt(`${cat.label.replace(/^\S+\s/, '')}「その他」の金額を入力してください（円）`, '');
        if (amountStr === null) return; // キャンセル
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) { showToast('⚠️ 正しい金額を入力してください'); return; }
        c.extraSales.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          category: cat.key, itemId: item.id, name: item.name,
          qty: 1, unit: null, unitPrice: amount, amount,
          timestamp: Date.now()
        });
        saveData();
        showToast(`${item.name} を追加しました（+¥${amount.toLocaleString()}）`);
        render();
        return;
      }

      c.extraSales.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: cat.key, itemId: item.id, name: item.name,
        qty: 1, unit: null, unitPrice: item.price, amount: item.price,
        timestamp: Date.now()
      });
      saveData();
      showToast(`${item.name} を追加しました（+¥${item.price.toLocaleString()}）`);
      render();
    };
  });

  // 時間課金メニュー（貸卓／麻雀教室）
  document.querySelectorAll('[data-extra-time]').forEach(el => {
    el.onclick = () => {
      const [catKey, minStr] = el.dataset.extraTime.split(':');
      const minutes = parseInt(minStr);
      const cat = extraMenu.find(x => x.key === catKey);
      const c = getCustomer(selectedId);
      if (!cat || !c || isNaN(minutes)) return;
      const amount = Math.round((minutes / 10) * cat.ratePer10Min);
      const catName = cat.shortLabel || cat.label.replace(/^\S+\s/, '');
      if (!c.extraSales) c.extraSales = [];
      c.extraSales.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: cat.key, itemId: `${catKey}_${minutes}`, name: `${catName}（${minutes}分）`,
        qty: minutes, unit: '分', unitPrice: cat.ratePer10Min, amount,
        timestamp: Date.now()
      });
      saveData();
      showToast(`${catName} ${minutes}分を追加しました（+¥${amount.toLocaleString()}）`);
      render();
    };
  });

  // 追加売上1件の取消（✕ボタン）
  document.querySelectorAll('[data-extra-delete]').forEach(el => {
    el.onclick = () => {
      const c = getCustomer(selectedId);
      if (!c) return;
      const targetId = el.dataset.extraDelete;
      const target = (c.extraSales || []).find(s => String(s.id) === targetId);
      if (!target) return;
      showConfirm(`「${target.name}」（¥${target.amount.toLocaleString()}）を取り消しますか？`, '取り消す', () => {
        c.extraSales = c.extraSales.filter(s => String(s.id) !== targetId);
        saveData(); render();
      });
    };
  });
}

/* ---------- 画面全体の描画 ---------- */

function render() {
  document.getElementById('app').innerHTML = view === 'order' ? renderOrderView() : renderListView();
  attachEvents();
  // 「売上リセット機能」(reset.js) 側のボタンをこのタイミングで配線する。
  // reset.js が読み込まれていれば動く／なくてもエラーにならない。
  if (typeof attachResetEvents === 'function') attachResetEvents();
}

function renderListView() {
  // ── 履歴タブ用：全顧客の来店履歴を取得し、日付で絞り込む ──
  const allSessions = getAllSessions();
  const filteredSessions = filterSessionsByDate(allSessions, historyFrom, historyTo);
  const historyTotal = filteredSessions.reduce((s, x) => s + x.total, 0);

  // 絞り込んだ期間の「注文数合計」「売上合計」を画面上部に大きく表示するためのヒーロー行
  const historyHeroRow = `
    <div class="stats-hero-row">
      <div class="stats-hero-box">
        <span class="stats-hero-number">${filteredSessions.length}</span>
        <span class="stats-hero-label">🍹 注文数合計（件）</span>
      </div>
      <div class="stats-hero-box">
        <span class="stats-hero-number">¥${historyTotal.toLocaleString()}</span>
        <span class="stats-hero-label">💰 売上合計</span>
      </div>
    </div>`;

  const historyListHTML = filteredSessions.length
    ? filteredSessions.map(s => {
        // 来店確定（saveSession）時点でスナップショットした「有効チケット№」。
        // 旧データ（この機能追加より前に保存されたセッション）には存在しないため、
        // その場合は「記録なし」と表示する。
        const ticketNumsText = (s.ticketNumbersAtSave && s.ticketNumbersAtSave.length)
          ? s.ticketNumbersAtSave.join(', ')
          : '記録なし（旧データ）';
        return `
        <div class="history-session">
          <p class="history-date">📅 ${s.date}　<span style="color:var(--text-primary);font-weight:700;">${s.customerName}</span> 様</p>
          <p class="history-items">${s.items.map(i => `${i.name}×${i.count}`).join('、')}</p>
          <p class="history-ticket-nums">🎫 使用チケット№：${ticketNumsText}</p>
          <p class="history-total">合計 ¥${s.total.toLocaleString()}</p>
        </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);text-align:center;padding:1rem 0;">${(historyFrom || historyTo) ? '該当する来店履歴がありません' : 'まだ来店履歴がありません'}</p>`;

  const lastBackupText = lastBackupAt ? `最終バックアップ：${lastBackupAt}` : '';


  return `
    <div class="tabs">
      <button class="tab ${tab==='list'?'active':''}" data-tab="list">👥 一覧</button>
      <button class="tab ${tab==='history'?'active':''}" data-tab="history">🕘 履歴</button>
      <button class="tab ${tab==='add'?'active':''}" data-tab="add">➕ 追加</button>
      <button class="tab ${tab==='menu'?'active':''}" data-tab="menu">🍹 メニュー</button>
      <button class="tab ${tab==='settings'?'active':''}" data-tab="settings">⚙️</button>
    </div>
    ${tab === 'list' ? `
      <div class="search-screen">
        <div class="search-wrap">
          <input class="search-input" id="search-input" placeholder="名前で検索…" value="${searchQuery}" inputmode="text" lang="ja" autocomplete="off" />
          <button class="search-btn" id="search-btn">検索</button>
          ${searchDone ? `<button class="search-clear" id="search-clear">✕</button>` : ''}
        </div>
        <div id="customer-list-container"></div>
      </div>
    ` : tab === 'history' ? `
      ${historyHeroRow}
      <div class="card">
        <p class="section-title">来店履歴を日付で絞り込み</p>
        <div class="search-wrap">
          <input type="date" class="search-input" id="history-from" value="${historyFrom}" />
          <input type="date" class="search-input" id="history-to" value="${historyTo}" />
        </div>
        <div class="search-wrap">
          <button class="search-btn" id="history-search-btn" style="flex:1;">🔍 絞り込む</button>
          ${(historyFrom || historyTo) ? `<button class="search-clear" id="history-clear-btn">✕ クリア</button>` : ''}
        </div>
      </div>
      <div class="card">
        <p class="section-title">${(historyFrom || historyTo) ? '絞り込み結果' : '全履歴（新しい順）'}</p>
        ${historyListHTML}
      </div>
    ` : tab === 'add' ? `
      <div class="card">
        <p class="section-title">新しいお客様を追加（残高1200円でスタート）</p>
        <div class="add-form">
          <input type="text" id="new-name" placeholder="お名前を入力" maxlength="20" inputmode="text" lang="ja" autocomplete="off" />
          <label class="section-title" style="margin:4px 0 -4px;text-transform:none;letter-spacing:normal;">開始チケット№</label>
          <input type="number" id="new-start-ticket" placeholder="開始チケット№（初期値：1）" min="1" value="1" />
          <button class="btn-add" id="add-btn">✨ 追加する</button>
        </div>
      </div>
      <div class="card">
        <p class="section-title">☕ カフェのお客様（お名前が分からない場合）</p>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">名前入力なしでダミー伝票を作成し、そのまま注文画面を開きます。お名前が分かったら伝票画面の「✏️ 名前変更」からいつでも設定できます。</p>
        <button class="btn-add" id="add-dummy-btn" style="background:linear-gradient(135deg, var(--pop-sky), var(--pop-sky));">☕ ダミー伝票を作成する</button>
      </div>
    ` : tab === 'menu' ? `
      <div class="menu-manage-layout">
        <div class="card">
          <p class="section-title">現在のメニュー（${menu.length}品） ※▲▼で並び替え、価格は直接編集</p>
          <div class="search-wrap" style="margin-bottom:12px;">
            <input class="search-input" id="menu-search-input" placeholder="🔍 ドリンク名で検索…" value="${menuSearchQuery}" inputmode="text" lang="ja" autocomplete="off" />
            ${menuSearchQuery ? `<button class="search-clear" id="menu-search-clear">✕</button>` : ''}
          </div>
          <div id="menu-list-container"></div>
        </div>
        <div class="card">
          <p class="section-title">✨ 新しいメニューを追加</p>
          <div class="menu-add-form">
            <div class="menu-add-inputs">
              <input class="inp-name" type="text" id="menu-name" placeholder="品名（例：コーヒー）" maxlength="15" inputmode="text" lang="ja" autocomplete="off" />
              <input class="inp-price" type="number" id="menu-price" placeholder="金額" min="0" max="9999" step="50" />
            </div>
            <div class="menu-add-options">
              <label><input type="checkbox" id="chk-size" /> サイズ選択 (S/L)</label>
              <label><input type="checkbox" id="chk-temp" /> 温度選択 (HOT/ICE)</label>
            </div>
            <button class="btn-menu-add" id="menu-add-btn">➕ メニューに登録する</button>
          </div>
        </div>
        <div class="card">
          <p class="section-title">🍘 お菓子・カップ麺（追加売上メニュー） ※価格は直接編集</p>
          <div id="extra-menu-list-container"></div>
        </div>
        <div class="card">
          <p class="section-title">✨ お菓子・カップ麺を追加</p>
          <div class="menu-add-form">
            <div class="menu-add-inputs">
              <select id="extra-menu-category" style="height:44px;border:1.5px solid var(--border);border-radius:var(--radius-pill);padding:0 14px;font-size:15px;background:var(--surface-1);color:var(--text-primary);outline:none;">
                <option value="snack">🍘 お菓子</option>
                <option value="noodle">🍜 カップ麺</option>
              </select>
              <input class="inp-name" type="text" id="extra-menu-name" placeholder="商品名（例：柿の種）" maxlength="15" inputmode="text" lang="ja" autocomplete="off" />
              <input class="inp-price" type="number" id="extra-menu-price" placeholder="金額" min="0" max="9999" step="50" />
            </div>
            <button class="btn-menu-add" id="extra-menu-add-btn">➕ 追加する</button>
          </div>
        </div>
      </div>
    ` : `
      <div class="card">
        <p class="section-title">バックアップ</p>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">万が一データが消えても復元できるよう、定期的なバックアップをおすすめします。</p>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1.5px dashed var(--border);">
          <div>
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 2px;">バックアップを書き出す</p>
            <p style="font-size:12px;color:var(--text-muted);margin:0;">現在の全データをファイルとして保存</p>
          </div>
          <button class="btn btn-ticket" id="backup-export-btn" style="white-space:nowrap;">📤 書き出す</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
          <div>
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 2px;">バックアップから復元</p>
            <p style="font-size:12px;color:var(--text-muted);margin:0;">書き出したファイルを選択して上書き復元</p>
          </div>
          <button class="btn btn-ticket" id="backup-import-btn" style="white-space:nowrap;">📥 復元する</button>
          <input type="file" id="backup-import-input" accept="application/json" style="display:none;" />
        </div>
        ${lastBackupText ? `<p style="font-size:11px;color:var(--text-muted);margin:10px 0 0;text-align:center;">${lastBackupText}</p>` : ''}
      </div>
      <div class="card">
        <p class="section-title">データ管理</p>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">データはこのブラウザに自動保存されます。</p>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1.5px dashed var(--border);">
          <div>
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 2px;">お客様データを全てリセット</p>
            <p style="font-size:12px;color:var(--text-muted);margin:0;">全員の残高・注文・来店履歴を初期状態に戻す</p>
          </div>
          <button class="btn btn-delete" id="reset-all-customers-btn" style="white-space:nowrap;">全リセット</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
          <div>
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 2px;">保存データを完全削除</p>
            <p style="font-size:12px;color:var(--text-muted);margin:0;">ストレージを消去してアプリを初期状態に戻す</p>
          </div>
          <button class="btn btn-delete" id="clear-storage-btn" style="white-space:nowrap;">完全削除</button>
        </div>
      </div>
    `}
  `;
}

function renderOrderView() {
  const c = getCustomer(selectedId);
  if (!c) return '';
  const low = c.balance < 400;
  const pct = Math.min(100, Math.round((c.balance / (c.tickets * 1200)) * 100));
  const validTicketCount = getValidTicketCount(c); // 残高から換算した「使える」チケット枚数
  const drinkCards = menu.map(item => {
    const cntAll = c.orders.filter(o => o.name === item.name || o.name.startsWith(item.name + '（')).length;
    const dis = item.price > c.balance;
    const hasSizes = (item.sizes || []).length > 0;
    const hasTemps = (item.temps || []).length > 0;
    const optBadge = (hasSizes || hasTemps) ? `<span style="display:inline-block;font-size:10px;color:var(--text-muted);margin-top:2px;font-weight:500;">${[hasSizes?'S/L':'',hasTemps?'HOT/ICE':''].filter(Boolean).join(' · ')}</span>` : '';
    return `<div class="drink-card${dis?' disabled':''}" data-drink="${item.id}">
      <p class="drink-name">${item.name}</p>
      <p class="drink-price">¥${item.price}${hasSizes?'〜':''}</p>
      ${optBadge}
      <span class="drink-count" style="margin-top:6px;">${cntAll > 0 ? cntAll+'杯' : '　'}</span>
    </div>`;
  }).join('');

  const grouped = {};
  c.orders.forEach(o => {
    const key = `${o.name}__${o.price}`;
    if (!grouped[key]) grouped[key] = { name: o.name, price: o.price, count: 0 };
    grouped[key].count++;
  });
  const currentRows = Object.values(grouped).map(d =>
    `<div class="order-row"><span>${d.name} × ${d.count}</span><span>¥${(d.price*d.count).toLocaleString()}</span></div>`
  ).join('');
  const currentTotal = c.orders.reduce((s, o) => s + o.price, 0);

  // 早朝5時リセット：本日の営業日に属する来店履歴のみ表示する（残高には影響なし）。
  // getBusinessDateKey / CURRENT_BUSINESS_DATE は reset.js が提供する。
  // timestampを持たない旧データ（保存形式の互換性のため）は従来通りすべて表示する。
  const visibleSessions = c.sessions.filter(s => !s.timestamp || getBusinessDateKey(s.timestamp) === CURRENT_BUSINESS_DATE);
  const hiddenCount = c.sessions.length - visibleSessions.length;
  const sessionHistory = visibleSessions.length
    ? visibleSessions.slice().reverse().map(s => {
        const ticketNumsText = (s.ticketNumbersAtSave && s.ticketNumbersAtSave.length)
          ? s.ticketNumbersAtSave.join(', ')
          : '記録なし（旧データ）';
        return `
        <div class="history-session">
          <p class="history-date">📅 ${s.date}</p>
          <p class="history-items">${s.items.map(i => `${i.name}×${i.count}`).join('、')}</p>
          <p class="history-ticket-nums">🎫 使用チケット№：${ticketNumsText}</p>
          <p class="history-total">合計 ¥${s.total.toLocaleString()}</p>
        </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:6px 0;">来店履歴はありません</p>';
  const hiddenNote = hiddenCount > 0
    ? `<p style="color:var(--text-muted);font-size:11px;text-align:center;margin:4px 0 0;">※前営業日以前の履歴 ${hiddenCount} 件は非表示（早朝5時で切替）</p>`
    : '';

  // 本日の追加売上（ラビ／貸卓／ドリンク単品／お菓子／カップ麺／麻雀教室）ログと合計
  const extraLog = renderExtraSalesLogHTML(c);

  const ticketBadge = c.tickets > 1 ? `<span class="tickets-badge">${c.tickets}枚所持</span>` : '';

  // PC用サイドバー：全顧客の名前一覧（現在選択中をハイライト）
  const sidebarItems = customers.map(cu =>
    `<div class="pc-sidebar-item${cu.id === c.id ? ' active' : ''}" data-order="${cu.id}">
      <span class="pc-sidebar-item-name">${cu.name}</span>
      <span class="pc-sidebar-item-balance">¥${cu.balance.toLocaleString()}</span>
    </div>`
  ).join('');

  return `
    <div class="pc-order-layout">
      <div class="pc-sidebar">
        <button class="back-btn" id="back-btn" style="width:100%;margin-bottom:12px;justify-content:center;">← 一覧に戻る</button>
        <p class="pc-sidebar-title">顧客一覧</p>
        <div class="pc-sidebar-list">${sidebarItems}</div>
      </div>
      <div class="pc-main">
        <div class="card">
          <p style="font-size:11px;color:var(--text-muted);margin:0 0 2px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">注文中</p>
          <p style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0 0 12px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
            <span>${c.name} 様 ${ticketBadge}</span>
            <button data-rename="${c.id}" style="font-size:12px;font-weight:600;border:1.5px solid var(--border);border-radius:var(--radius-pill);background:var(--surface-1);color:var(--text-secondary);padding:4px 10px;cursor:pointer;">✏️ 名前変更</button>
          </p>
          <div class="ticket-hero-card">
            <span class="ticket-hero-icon">🎫</span>
            <span class="ticket-hero-number">${c.tickets}</span>
            <span class="ticket-hero-text">枚 所持中${validTicketCount !== c.tickets ? `<br><span class="ticket-hero-sub">残高から使える有効枚数：${validTicketCount}枚</span>` : ''}</span>
          </div>
          <div class="balance-bar">
            <span class="bal-big${low?' low':''}">残 ¥${c.balance.toLocaleString()}</span>
            <div class="prog-bg"><div class="prog-fill${low?' low':''}" style="width:${pct}%"></div></div>
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">${pct}%</span>
          </div>
          <div class="alert" id="alert-msg"></div>
          <p class="section-title">メニュー（クリックで注文）</p>
          <div class="drink-grid">${drinkCards || '<p style="color:var(--text-muted);">メニューがありません</p>'}</div>
        </div>
        <div class="card">
          <p class="section-title">今回の注文</p>
          ${c.orders.length === 0 ? '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:8px 0;">まだ注文がありません</p>' : `${currentRows}
               <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:10px;color:var(--text-primary);">
                 <span>合計</span><span>¥${currentTotal.toLocaleString()}</span>
               </div>
               <div style="display:flex;gap:10px;margin-top:12px;justify-content:flex-end;flex-wrap:wrap;">
                 <button class="undo-btn" id="undo-btn">↩ 最後を取り消す</button>
                 <button class="undo-btn" id="reset-orders-btn" style="color:var(--pop-orange);">🔄 全リセット</button>
                 <button class="undo-btn" id="save-session-btn" style="color:var(--pop-pink-dark);">✅ 来店確定</button>
               </div>`}
        </div>
        <div class="card">
          <p class="section-title">追加売上メニュー（タップで即計上）</p>
          ${renderExtraMenuHTML()}
          <p class="section-title" style="margin-top:16px;">本日の追加売上</p>
          ${extraLog.rowsHTML}
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:10px;color:var(--text-primary);">
            <span>追加売上 合計</span><span>¥${extraLog.total.toLocaleString()}</span>
          </div>
        </div>
        <div class="card">
          <p class="section-title">来店履歴（本日分）</p>
          ${sessionHistory}
          ${hiddenNote}
        </div>
      </div>
    </div>
  `;
}

/* ---------- イベント配線 ---------- */

function attachCustomerEvents() {
  document.querySelectorAll('[data-order]').forEach(el => {
    el.onclick = () => { selectedId = parseInt(el.dataset.order); view = 'order'; render(); };
  });
  document.querySelectorAll('[data-addticket]').forEach(el => {
    el.onclick = () => {
      const c = getCustomer(parseInt(el.dataset.addticket));
      if (!c.ticketNumbers) c.ticketNumbers = [];
      if (!c.ticketSales) c.ticketSales = [];
      const newNum = c.ticketNumbers.length ? Math.max(...c.ticketNumbers) + 1 : 1;
      c.ticketNumbers.push(newNum);
      c.balance += TICKET_VALUE;      // ① チケット1枚分の価値（1,200円）を残高に加算
      c.tickets += 1;
      c.totalPurchased = (c.totalPurchased || c.tickets - 1 || 0) + 1;
      c.ticketSales.push({ number: newNum, timestamp: Date.now(), price: TICKET_SALE_PRICE });

      totalSalesAmount += TICKET_SALE_PRICE; // ② 売上合計に販売価格（1,000円）を加算

      saveData();
      showToast(`${c.name} さんに№${newNum}を追加しました（売上 +¥${TICKET_SALE_PRICE.toLocaleString()}）`);
      renderCustomerList();
    };
  });
  document.querySelectorAll('[data-manage-tickets]').forEach(el => {
    el.onclick = () => { openTicketManage(parseInt(el.dataset.manageTickets)); };
  });
  document.querySelectorAll('[data-edit]').forEach(el => {
    el.onclick = () => {
      customers.forEach(x => { x.editing = false; });
      getCustomer(parseInt(el.dataset.edit)).editing = true;
      renderCustomerList();
    };
  });
  document.querySelectorAll('[data-rename]').forEach(el => {
    el.onclick = () => performRenameCustomer(parseInt(el.dataset.rename));
  });
  document.querySelectorAll('[data-save]').forEach(el => {
    el.onclick = () => {
      const c = getCustomer(parseInt(el.dataset.save));
      const sel = document.querySelector(`.edit-bal-select[data-id="${el.dataset.save}"]`);
      c.balance = parseInt(sel.value); c.editing = false;
      saveData(); renderCustomerList();
    };
  });
  document.querySelectorAll('[data-delete]').forEach(el => {
    el.onclick = () => {
      const c = getCustomer(parseInt(el.dataset.delete));
      showConfirm(`「${c.name}」さんを削除しますか？`, '削除する', () => {
        customers = customers.filter(x => x.id !== c.id);
        saveData(); showToast(`${c.name} さんを削除しました`); renderCustomerList();
      });
    };
  });
  // 個々の「🔄」リセットボタンの配線は reset.js の attachResetEvents() が担当する。
}

function attachEvents() {
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.onclick = () => { tab = el.dataset.tab; render(); };
  });
  const si = document.getElementById('search-input');
  const sb = document.getElementById('search-btn');
  const sc = document.getElementById('search-clear');
  if (si && sb) {
    sb.onclick = () => { searchQuery = si.value; searchDone = true; renderCustomerList(); };
    si.onkeydown = e => { if (e.key === 'Enter') { searchQuery = si.value; searchDone = true; renderCustomerList(); } };
  }
  if (sc) sc.onclick = () => { searchQuery = ''; searchDone = false; render(); };
  if (tab === 'list') renderCustomerList();

  // 履歴タブ：日付絞り込み・クリア
  const hsBtn = document.getElementById('history-search-btn');
  const hcBtn = document.getElementById('history-clear-btn');
  if (hsBtn) hsBtn.onclick = () => {
    historyFrom = document.getElementById('history-from').value;
    historyTo = document.getElementById('history-to').value;
    render();
  };
  if (hcBtn) hcBtn.onclick = () => { historyFrom = ''; historyTo = ''; render(); };

  const addBtn = document.getElementById('add-btn');
  if (addBtn) addBtn.onclick = () => {
    const inp = document.getElementById('new-name');
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    const startInp = document.getElementById('new-start-ticket');
    let startNum = parseInt(startInp.value);
    if (isNaN(startNum) || startNum < 1) startNum = 1;
    customers.push({ id: nextId++, name, balance: 1200, tickets: 1, ticketNumbers: [startNum], orders: [], sessions: [], extraSales: [], editing: false });
    inp.value = ''; startInp.value = '1'; tab = 'list'; searchQuery = ''; searchDone = false;
    saveData(); showToast(`${name} さんを追加しました（№${startNum}）`); render();
  };

  const addDummyBtn = document.getElementById('add-dummy-btn');
  if (addDummyBtn) addDummyBtn.onclick = performCreateDummyTicket;

  const menuAddBtn = document.getElementById('menu-add-btn');
  if (menuAddBtn) menuAddBtn.onclick = () => {
    const name = document.getElementById('menu-name').value.trim();
    const price = parseInt(document.getElementById('menu-price').value);
    if (!name || isNaN(price) || price < 0) { showToast('品名と金額を入力してください'); return; }
    if (price % 50 !== 0) { showToast('⚠️ 金額は50円単位で入力してください'); return; }
    const chkSize = document.getElementById('chk-size').checked;
    const chkTemp = document.getElementById('chk-temp').checked;
    const sizes = chkSize ? [{label:'S',priceDiff:0},{label:'L',priceDiff:100}] : [];
    const temps = chkTemp ? ['HOT','ICE'] : [];
    menu.push({ id: nextMenuId++, name, price, sizes, temps });
    saveData(); showToast(`${name}（¥${price}）を追加しました`); render();
  };

  // お菓子・カップ麺（追加売上メニュー）の新規登録
  const extraMenuAddBtn = document.getElementById('extra-menu-add-btn');
  if (extraMenuAddBtn) extraMenuAddBtn.onclick = () => {
    const catKey = document.getElementById('extra-menu-category').value;
    const name = document.getElementById('extra-menu-name').value.trim();
    const price = parseInt(document.getElementById('extra-menu-price').value);
    if (!name || isNaN(price) || price < 0) { showToast('品名と金額を入力してください'); return; }
    if (price % 50 !== 0) { showToast('⚠️ 金額は50円単位で入力してください'); return; }
    const cat = extraMenu.find(c => c.key === catKey);
    if (!cat) return;
    if (!cat.items) cat.items = [];
    const newId = `${catKey}_${Date.now()}`;
    cat.items.push({ id: newId, name, price });
    document.getElementById('extra-menu-name').value = '';
    document.getElementById('extra-menu-price').value = '';
    saveData(); showToast(`${name}（¥${price}）を追加しました`); render();
  };

  // メニュー管理タブ：ドリンク名のライブ検索
  const msi = document.getElementById('menu-search-input');
  const msc = document.getElementById('menu-search-clear');
  if (msi) msi.oninput = () => { menuSearchQuery = msi.value; renderMenuRows(); };
  if (msc) msc.onclick = () => { menuSearchQuery = ''; render(); };
  if (tab === 'menu') { renderMenuRows(); renderExtraMenuManageRows(); }

  const back = document.getElementById('back-btn');
  if (back) back.onclick = () => { view = 'list'; render(); };

  // PC用サイドバー（注文画面左側の顧客一覧）の顧客切り替え。
  // customer-list-container 内のカード（🍹注文ボタン等）は attachCustomerEvents() 側で
  // 配線されるが、サイドバーは renderCustomerList() を経由しない別要素のため、
  // ここで改めて [data-order] を配線しておく（配線漏れ防止のため二重に配線しても害はない）。
  document.querySelectorAll('[data-order]').forEach(el => {
    el.onclick = () => { selectedId = parseInt(el.dataset.order); view = 'order'; render(); };
  });

  document.querySelectorAll('[data-rename]').forEach(el => {
    el.onclick = () => performRenameCustomer(parseInt(el.dataset.rename));
  });

  document.querySelectorAll('[data-drink]').forEach(el => {
    el.onclick = () => {
      const item = menu.find(m => m.id === parseInt(el.dataset.drink));
      if (!item) return;
      const c = getCustomer(selectedId);
      if ((item.sizes || []).length > 0 || (item.temps || []).length > 0) { openDrinkPopup(item.id); return; }
      if (item.price > c.balance) {
        const alertEl = document.getElementById('alert-msg');
        alertEl.style.display = 'block'; alertEl.textContent = '残高不足';
        setTimeout(() => { alertEl.style.display = 'none'; }, 2500);
        return;
      }
      c.balance -= item.price;
      c.orders.push({ name: item.name, price: item.price });
      saveData(); render();
    };
  });

  const undo = document.getElementById('undo-btn');
  if (undo) undo.onclick = () => {
    const c = getCustomer(selectedId);
    if (!c.orders.length) return;
    const last = c.orders.pop(); c.balance += last.price;
    saveData(); render();
  };

  const saveSession = document.getElementById('save-session-btn');
  if (saveSession) saveSession.onclick = () => {
    const c = getCustomer(selectedId);
    if (!c.orders.length) return;
    const grouped = {};
    c.orders.forEach(o => {
      const key = `${o.name}__${o.price}`;
      if (!grouped[key]) grouped[key] = { name: o.name, price: o.price, count: 0 };
      grouped[key].count++;
    });
    const total = c.orders.reduce((s, o) => s + o.price, 0);
    // 来店確定時点で残高的に「有効」なチケット№をスナップショットとして記録する。
    // （どの1枚が実際に使われたかを厳密に追跡する仕組みは無いため、
    //  「この来店の時点で使えていたチケット№」という位置づけの参考情報）
    const ticketNumbersAtSave = getValidTicketNumbers(c);
    c.sessions.push({ date: nowStr(), timestamp: Date.now(), items: Object.values(grouped), total, ticketNumbersAtSave });
    c.orders = []; saveData(); showToast('来店を確定しました'); render();
  };

  document.getElementById('confirm-cancel').onclick = () => {
    document.getElementById('confirm-overlay').classList.remove('show'); confirmCallback = null;
  };
  document.getElementById('confirm-ok').onclick = () => {
    document.getElementById('confirm-overlay').classList.remove('show');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  };

  // 追加売上メニュー（ラビ／貸卓／ドリンク単品／お菓子／カップ麺／麻雀教室）のボタン配線。
  // 注文画面（view === 'order'）以外では該当要素が存在しないため何もしない（安全）。
  attachExtraSalesEvents();

  // 「reset-orders-btn」「reset-all-customers-btn」「clear-storage-btn」
  // 「backup-export-btn」「backup-import-btn」の配線は reset.js の
  // attachResetEvents() が担当する（render() の最後で自動的に呼ばれる）。
}

render();
attachTicketManageEvents();