/**
 * Research Platform admin v2 — giao diện sidebar mới
 */
window.PlatformAdmin = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let dirty = false;
  let botsDraft = [];
  let daysCache = [];
  let activeSub = "overview";
  let selectedDayId = null;
  let lastPlat = {};

  const PAGES = {
    overview: { title: "Tổng quan", desc: "Trạng thái hệ thống Research Platform" },
    cfg: { title: "Cấu hình", desc: "3 lớp ON/OFF · forum · membership · backup" },
    bots: { title: "Bots delivery", desc: "Tối đa 10 bot token · queue tuần tự" },
    archive: { title: "Archive", desc: "Index ngày VN — link + metadata" },
    vip: { title: "VIP & Stars", desc: "Gói thanh toán Telegram Stars" },
    gift: { title: "Giftcode", desc: "Tạo mã kích hoạt VIP" },
    ads: { title: "Ads contracts", desc: "Alias quảng cáo · revoke strip khi xem" },
    contrib: { title: "Đóng góp", desc: "Duyệt tên bộ media từ user" },
    share: { title: "Share event", desc: "Leaderboard đua top mời bạn" },
    users: { title: "Users", desc: "Danh sách user bot" },
    rollup: { title: "Rollup", desc: "Mục lục text 30 ngày" },
  };

  const STATUS_LABEL = {
    draft: "Nháp", channel_done: "Up kênh", indexed: "Indexed",
    published: "Published", closed: "Đóng",
  };

  function markDirty() {
    dirty = true;
    if (typeof bumpEditPause === "function") bumpEditPause();
  }

  function isDirty() { return dirty; }

  function subTab(name, btn) {
    activeSub = name;
    document.querySelectorAll(".rp-pane").forEach((el) => el.classList.remove("active"));
    const pane = $("plat-pane-" + name);
    if (pane) pane.classList.add("active");
    document.querySelectorAll(".rp-nav-item").forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const pg = PAGES[name] || PAGES.overview;
    if ($("rp-page-title")) $("rp-page-title").textContent = pg.title;
    if ($("rp-page-desc")) $("rp-page-desc").textContent = pg.desc;
    if (name === "vip") loadVipPlans();
    if (name === "gift") loadGiftCodes();
    if (name === "ads") loadAdsList();
    if (name === "share") loadShareLb();
    if (name === "users") loadUsers();
    if (name === "contrib") loadContributions();
    if (name === "rollup") loadRollups();
    if (name === "archive" && selectedDayId) loadDayItems(selectedDayId);
  }

  function renderStats(stats, queue, botStatus) {
    const el = $("plat-stats");
    if (!el) return;
    stats = stats || {};
    const online = stats.bots_online ?? (botStatus || []).filter((b) => b.running).length;
    const total = stats.bots_configured ?? (botStatus || []).length;
    el.innerHTML = `
      <div class="rp-stat-card"><div class="val">${stats.days_count ?? 0}</div><div class="lbl">Ngày archive</div></div>
      <div class="rp-stat-card"><div class="val">${online}<span style="font-size:0.9rem;color:var(--rp-dim)">/${total}</span></div><div class="lbl">Bot online</div></div>
      <div class="rp-stat-card"><div class="val">${stats.pending_contributions ?? 0}</div><div class="lbl">Chờ duyệt</div></div>
      <div class="rp-stat-card"><div class="val">${stats.users_count ?? "—"}</div><div class="lbl">Users</div></div>
      <div class="rp-stat-card"><div class="val">${queue?.running ? "▶" : "⏸"}</div><div class="lbl">Queue</div></div>`;
    const badge = $("plat-contrib-badge");
    if (badge) {
      const n = stats.pending_contributions || 0;
      badge.textContent = n > 0 ? String(n) : "0";
      badge.style.display = n > 0 ? "inline" : "none";
    }
  }

  function renderEnabledPill(plat) {
    const pill = $("plat-enabled-pill");
    if (!pill) return;
    const on = !!plat?.enabled;
    pill.className = "rp-status-pill" + (on ? " on" : "");
    pill.innerHTML = `<span class="dot"></span> ${on ? "Platform đang bật" : "Platform tắt"}`;
  }

  function renderLayersViz(plat) {
    const el = $("plat-layers-viz");
    if (!el) return;
    const layers = [
      { key: "publish_channels", label: "Up kênh", icon: "📤" },
      { key: "archive_index", label: "Index", icon: "📚" },
      { key: "bot_delivery", label: "Delivery", icon: "🤖" },
    ];
    el.innerHTML = layers.map((l) => {
      const on = plat[l.key] !== false;
      return `<div class="rp-layer-pill ${on ? "on" : ""}"><span class="num">${l.icon}</span>${l.label}</div>`;
    }).join("");
  }

  function renderOverview(plat, botStatus, stats) {
    renderLayersViz(plat);
    renderEnabledPill(plat);

    const actions = $("plat-overview-actions");
    if (actions) {
      const pending = stats?.pending_contributions || 0;
      actions.innerHTML = `
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.go('cfg')">
          <div class="qa-ico">⚙️</div><div><strong>Cấu hình</strong><span>Forum, membership, backup</span></div>
        </button>
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.go('bots')">
          <div class="qa-ico">🤖</div><div><strong>Quản lý bots</strong><span>${(botStatus||[]).length} bot cấu hình</span></div>
        </button>
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.go('archive')">
          <div class="qa-ico">📅</div><div><strong>Archive</strong><span>${stats?.days_count||0} ngày</span></div>
        </button>
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.go('contrib')">
          <div class="qa-ico">💡</div><div><strong>Đóng góp</strong><span>${pending} chờ duyệt</span></div>
        </button>
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.runBackup()">
          <div class="qa-ico">💾</div><div><strong>Backup ngay</strong><span>ZIP + Telegram</span></div>
        </button>
        <button type="button" class="rp-quick-action" onclick="PlatformAdmin.restartBot(null)">
          <div class="qa-ico">🔄</div><div><strong>Restart bots</strong><span>Reload tất cả delivery</span></div>
        </button>`;
    }

    const botsEl = $("plat-overview-bots");
    if (botsEl) {
      const list = botStatus || [];
      if (!list.length) {
        botsEl.innerHTML = '<p class="rp-hint">Chưa có bot — cấu hình trong tab Bots</p>';
      } else {
        botsEl.innerHTML = list.map((b) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--rp-border)">
            <span>@${esc(b.username || b.key)}</span>
            <span><span class="rp-dot ${b.running ? "on" : ""}"></span> ${b.running ? "online" : "offline"}</span>
          </div>`).join("");
      }
    }
  }

  function go(name) {
    const btn = document.querySelector(`.rp-nav-item[data-plat="${name}"]`);
    subTab(name, btn);
  }

  function renderBots(bots, botStatus) {
    botsDraft = (bots || []).map((b) => ({ ...b }));
    if (!botsDraft.length) {
      botsDraft = [{ username: "", branch: "ads", enabled: true, queue_order: 0,
        publish_channels: true, archive_index: true, bot_delivery: true }];
    }
    const statusMap = {};
    (botStatus || []).forEach((s) => { statusMap[s.username || s.key] = s; });

    $("plat-bots-list").innerHTML = botsDraft.map((b, i) => {
      const st = statusMap[b.username] || {};
      return `
      <div class="rp-bot-card" data-idx="${i}">
        <div class="rp-bot-head">
          <span class="name">Bot #${i + 1} ${b.username ? "@" + esc(b.username) : ""}</span>
          <span class="status">
            <span class="rp-dot ${st.running ? "on" : ""}"></span>
            ${st.running ? "Online" : "Offline"}
            <button type="button" class="rp-btn" style="padding:0.2rem 0.5rem;font-size:0.72rem;margin-left:0.5rem"
              onclick="PlatformAdmin.restartBot('${esc(b.username || "").replace(/'/g, "")}')">↻</button>
          </span>
        </div>
        <div class="rp-grid">
          <div><label class="rp-label">@username</label><input class="pb-user" value="${esc(b.username || "")}" /></div>
          <div><label class="rp-label">Token</label><input class="pb-token" type="password" placeholder="${b.has_token ? "••• giữ cũ" : "token"}" /></div>
          <div><label class="rp-label">Queue</label><input class="pb-order" type="number" value="${b.queue_order ?? i}" /></div>
          <div><label class="rp-label">Branch</label>
            <select class="pb-branch">
              <option value="ads" ${b.branch !== "plain" ? "selected" : ""}>ads</option>
              <option value="plain" ${b.branch === "plain" ? "selected" : ""}>plain</option>
            </select>
          </div>
        </div>
        <div class="rp-grid" style="margin-top:0.5rem">
          <div><label class="rp-label">Forum nguồn</label><input class="pb-forum" type="number" value="${b.source_forum_id ?? ""}" /></div>
          <div><label class="rp-label">Topic nguồn</label><input class="pb-topic" type="number" value="${b.source_topic_id ?? ""}" /></div>
          <div><label class="rp-label">Catalog topic</label><input class="pb-cat" type="number" value="${b.catalog_topic_id ?? ""}" /></div>
        </div>
        <div class="rp-chip-row">
          <label class="rp-chip"><input class="pb-en" type="checkbox" ${b.enabled !== false ? "checked" : ""} /> Enabled</label>
          <label class="rp-chip"><input class="pb-pub" type="checkbox" ${b.publish_channels !== false ? "checked" : ""} /> Up kênh</label>
          <label class="rp-chip"><input class="pb-idx" type="checkbox" ${b.archive_index !== false ? "checked" : ""} /> Index</label>
          <label class="rp-chip"><input class="pb-del" type="checkbox" ${b.bot_delivery !== false ? "checked" : ""} /> Delivery</label>
        </div>
      </div>`;
    }).join("");
  }

  function renderConfig(plat) {
    plat = plat || {};
    lastPlat = plat;
    $("plat-enabled").checked = !!plat.enabled;
    $("plat-orchestrator").checked = plat.orchestrator_running !== false;
    $("plat-channel-first").checked = plat.channel_first !== false;
    $("plat-publish").checked = plat.publish_channels !== false;
    $("plat-index").checked = plat.archive_index !== false;
    $("plat-delivery").checked = plat.bot_delivery !== false;
    $("plat-vip-req").checked = !!plat.require_vip_for_archive;
    $("plat-auto-pub").checked = plat.auto_publish_on_index !== false;
    $("plat-delay").value = plat.delivery_delay_sec ?? 1;
    $("plat-notify-group").value = plat.admin_notify_group_id ?? "";
    $("plat-admin-forum").value = plat.admin_forum_id ?? "";
    $("plat-zip-topic").value = plat.admin_zip_topic_id ?? "";
    $("plat-contrib-topic").value = plat.admin_contrib_topic_id ?? "";
    $("plat-mem-ch").value = plat.membership_channel_id ?? "";
    $("plat-mem-un").value = plat.membership_channel_username || "";
    $("plat-mem-sec").value = plat.force_join_check_sec ?? 300;
    $("plat-mem-msg").value = plat.force_join_message || "";
    $("plat-backup-forum").value = plat.backup_forum_id ?? "";
    $("plat-backup-hours").value = plat.backup_interval_hours ?? 24;
    $("plat-backup-keep").value = plat.backup_keep_days ?? 7;
    $("plat-backup-tg").checked = plat.backup_to_telegram !== false;
    const se = plat.share_event || {};
    $("plat-share-ev").checked = !!se.enabled;
    $("plat-share-start").value = (se.period_start || "").slice(0, 16);
    $("plat-share-end").value = (se.period_end || "").slice(0, 16);
    renderLayersViz(plat);
    renderEnabledPill(plat);
  }

  function badgeClass(st) {
    return `rp-badge rp-badge-${st === "published" ? "published" : st === "indexed" ? "indexed" : st === "closed" ? "closed" : "draft"}`;
  }

  function renderArchive(days) {
    daysCache = days || [];
    const el = $("plat-days-table");
    if (!daysCache.length) {
      el.innerHTML = '<p class="rp-empty"><div class="ico">📅</div>Chưa có ngày archive</p>';
      return;
    }
    let html = `<table class="rp-table"><tr><th>Ngày</th><th>Bot</th><th>TT</th><th>Lượt</th><th></th></tr>`;
    for (const d of daysCache) {
      const sel = d.id === selectedDayId ? " selected" : "";
      html += `<tr class="${sel.trim()}" data-day="${d.id}">
        <td><a onclick="PlatformAdmin.selectDay(${d.id})">${esc(d.topic_label)}</a></td>
        <td>${d.bot_id}</td>
        <td><span class="${badgeClass(d.status)}">${STATUS_LABEL[d.status] || d.status}</span></td>
        <td>${d.runs_count || 0}</td>
        <td>
          <button type="button" class="rp-btn" style="padding:0.2rem 0.4rem;font-size:0.72rem" onclick="PlatformAdmin.publishDay(${d.id})">Pub</button>
          <button type="button" class="rp-btn" style="padding:0.2rem 0.4rem;font-size:0.72rem" onclick="PlatformAdmin.closeDay(${d.id})">Đóng</button>
        </td></tr>`;
    }
    html += "</table>";
    el.innerHTML = html;
  }

  async function selectDay(id) {
    selectedDayId = id;
    renderArchive(daysCache);
    await loadDayItems(id);
  }

  async function loadDayItems(dayId) {
    const el = $("plat-day-detail");
    if (!el) return;
    el.innerHTML = '<p class="rp-hint">Đang tải…</p>';
    try {
      const r = await api("/platform/days/" + dayId + "/items");
      const items = r.items || [];
      const day = daysCache.find((d) => d.id === dayId);
      el.innerHTML = `<div style="font-family:var(--rp-font);font-weight:600;margin-bottom:0.5rem;font-size:0.85rem">${esc(day?.topic_label || dayId)} · ${items.length} items</div>` +
        items.map((it) => `
          <div class="rp-item-row ${it.item_type === "ads" ? "type-ads" : ""}">
            <span class="seq">${it.seq}</span>
            <span>${it.item_type}</span>
            <span style="color:var(--rp-dim)">${it.src_chat_id}:${it.src_msg_id}</span>
            ${it.ads_alias ? `<span>${esc(it.ads_alias)}</span>` : ""}
          </div>`).join("") || '<p class="rp-hint">Trống</p>';
    } catch (e) {
      el.innerHTML = '<p class="rp-hint">Lỗi: ' + esc(e.message) + "</p>";
    }
  }

  function collectPatch(extra) {
    return {
      enabled: $("plat-enabled").checked,
      orchestrator_running: $("plat-orchestrator").checked,
      channel_first: $("plat-channel-first").checked,
      publish_channels: $("plat-publish").checked,
      archive_index: $("plat-index").checked,
      bot_delivery: $("plat-delivery").checked,
      require_vip_for_archive: $("plat-vip-req").checked,
      auto_publish_on_index: $("plat-auto-pub").checked,
      delivery_delay_sec: parseFloat($("plat-delay").value) || 1,
      admin_notify_group_id: numOrNull("plat-notify-group"),
      admin_forum_id: numOrNull("plat-admin-forum"),
      admin_zip_topic_id: numOrNull("plat-zip-topic"),
      admin_contrib_topic_id: numOrNull("plat-contrib-topic"),
      membership_channel_id: numOrNull("plat-mem-ch"),
      membership_channel_username: $("plat-mem-un").value.trim(),
      force_join_check_sec: parseInt($("plat-mem-sec").value, 10) || 300,
      force_join_message: $("plat-mem-msg").value.trim(),
      backup_forum_id: numOrNull("plat-backup-forum"),
      backup_to_telegram: $("plat-backup-tg").checked,
      backup_interval_hours: parseInt($("plat-backup-hours").value, 10) || 24,
      backup_keep_days: parseInt($("plat-backup-keep").value, 10) || 7,
      share_event: {
        enabled: $("plat-share-ev").checked,
        period_start: $("plat-share-start").value ? new Date($("plat-share-start").value).toISOString() : null,
        period_end: $("plat-share-end").value ? new Date($("plat-share-end").value).toISOString() : null,
      },
      bots: collectBotsFromDom(),
      ...extra,
    };
  }

  function collectBotsFromDom() {
    return [...document.querySelectorAll("#plat-bots-list .rp-bot-card")].map((row, i) => {
      const tok = row.querySelector(".pb-token").value.trim();
      const b = {
        username: row.querySelector(".pb-user").value.trim(),
        source_forum_id: numVal(row.querySelector(".pb-forum").value),
        source_topic_id: row.querySelector(".pb-topic").value !== "" ? +row.querySelector(".pb-topic").value : null,
        catalog_topic_id: numVal(row.querySelector(".pb-cat").value),
        queue_order: +(row.querySelector(".pb-order").value || i),
        branch: row.querySelector(".pb-branch").value,
        enabled: row.querySelector(".pb-en").checked,
        publish_channels: row.querySelector(".pb-pub").checked,
        archive_index: row.querySelector(".pb-idx").checked,
        bot_delivery: row.querySelector(".pb-del").checked,
      };
      if (tok) b.token = tok;
      return b;
    });
  }

  function numOrNull(id) { const v = $(id).value.trim(); return v ? +v : null; }
  function numVal(v) { return v ? +v : null; }
  function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }

  async function save() {
    markDirty();
    try {
      await api("/platform", { method: "PATCH", body: JSON.stringify(collectPatch()) });
      dirty = false;
      toast("✅ Đã lưu Platform");
      if (typeof scheduleRefreshAfterEdit === "function") scheduleRefreshAfterEdit();
      await refreshFromApi();
    } catch (e) { toast("Lỗi: " + e.message); }
  }

  async function refreshFromApi() {
    try {
      const r = await api("/platform");
      applySnapshot(r.platform, r.days, r.bot_status, r.queue, r.stats);
      if (r.pending_contributions) renderContributions(r.pending_contributions);
    } catch (e) { console.warn("platform refresh", e); }
  }

  function applySnapshot(plat, days, botStatus, queue, stats) {
    if (typeof panelEditing === "function" && panelEditing("platform", isDirty())) return;
    renderStats(stats, queue, botStatus);
    renderConfig(plat);
    renderBots(plat?.bots || (plat?.bot ? [plat.bot] : []), botStatus);
    renderArchive(days);
    renderOverview(plat, botStatus, stats);
    loadBackupStatus();
  }

  function addBot() {
    if (botsDraft.length >= 10) { toast("Tối đa 10 bot"); return; }
    botsDraft.push({ username: "", enabled: true, queue_order: botsDraft.length, branch: "ads",
      publish_channels: true, archive_index: true, bot_delivery: true });
    renderBots(botsDraft, []);
    markDirty();
  }

  async function publishDay(id) {
    try {
      await api("/platform/days/" + id + "/publish", { method: "POST" });
      toast("Publish OK");
      if (typeof scheduleRefreshAfterEdit === "function") scheduleRefreshAfterEdit();
      await refreshFromApi();
    } catch (e) { toast(e.message); }
  }

  async function closeDay(id) {
    try {
      await api("/platform/days/" + id + "/close", { method: "POST" });
      toast("Đóng ngày OK");
      if (typeof scheduleRefreshAfterEdit === "function") scheduleRefreshAfterEdit();
      await refreshFromApi();
    } catch (e) { toast(e.message); }
  }

  async function restartBot(username) {
    try {
      await api("/platform/bots/restart", { method: "POST", body: JSON.stringify({ username: username || null }) });
      toast(username ? "Restart @" + username : "Restart all bots");
      if (typeof scheduleRefreshAfterEdit === "function") scheduleRefreshAfterEdit();
    } catch (e) { toast(e.message); }
  }

  async function loadBackupStatus() {
    const el = $("plat-backup-status");
    if (!el) return;
    try {
      const r = await api("/platform/backup");
      const s = r.status || {};
      el.textContent = [s.scheduler_on ? "🟢 scheduler" : "⏸ scheduler", s.last_backup_at || "chưa backup", (s.local_file_count||0) + " files"].join(" · ");
    } catch { el.textContent = "Backup: —"; }
  }

  async function runBackup() {
    try {
      const r = await api("/platform/backup", { method: "POST", body: JSON.stringify({ telegram: $("plat-backup-tg").checked }) });
      toast(r.sent_telegram ? "Backup + Telegram OK" : "Backup local OK");
      loadBackupStatus();
    } catch (e) { toast(e.message); }
  }

  async function downloadBackup() {
    try {
      const r = await fetch("/api/platform/backup/download", { headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "backup_platform.zip";
      a.click();
    } catch (e) { toast(e.message); }
  }

  async function recheckAds() {
    const r = await api("/platform/ads/recheck", { method: "POST" });
    toast("Recheck: " + JSON.stringify(r));
  }

  async function runRollup() {
    const r = await api("/platform/rollup", { method: "POST" });
    toast("Rollup OK");
  }

  async function loadVipPlans() {
    try {
      const r = await api("/platform/vip/plans");
      $("plat-vip-plans").innerHTML = (r.plans || []).map((p) =>
        `<div style="padding:0.6rem 0;border-bottom:1px solid var(--rp-border);display:flex;justify-content:space-between">
          <span><strong>#${p.id}</strong> ${esc(p.name)}</span>
          <span>${p.stars_price}⭐ · ${p.plan_type} <span class="rp-badge rp-badge-${p.enabled?'published':'draft'}">${p.enabled?"ON":"OFF"}</span></span>
        </div>`).join("") || '<p class="rp-hint">Chưa có plan</p>';
    } catch (e) { $("plat-vip-plans").textContent = e.message; }
  }

  async function createVipPlan() {
    await api("/platform/vip/plans", { method: "POST", body: JSON.stringify({
      plan_type: $("plat-vip-type").value, name: $("plat-vip-name").value.trim(),
      stars_price: +$("plat-vip-stars").value || 1,
      duration_days: $("plat-vip-days").value ? +$("plat-vip-days").value : null, enabled: true,
    })});
    toast("Đã tạo plan"); loadVipPlans();
  }

  async function grantVip() {
    await api("/platform/vip/grant", { method: "POST", body: JSON.stringify({
      user_id: +$("plat-vip-uid").value, plan_id: +$("plat-vip-planid").value,
    })});
    toast("Grant VIP OK");
  }

  async function createGiftCodes() {
    const r = await api("/platform/giftcodes", { method: "POST", body: JSON.stringify({
      plan_id: +$("plat-gift-plan").value, count: +$("plat-gift-count").value, prefix: $("plat-gift-prefix").value,
    })});
    toast("Tạo " + (r.codes || []).length + " mã"); loadGiftCodes();
  }

  async function loadGiftCodes() {
    const r = await api("/platform/giftcodes");
    $("plat-gift-list").innerHTML = (r.codes || []).map((c) =>
      `<div style="padding:0.35rem 0;font-family:var(--rp-mono);font-size:0.8rem"><code>${esc(c.code)}</code> · ${c.used_count}/${c.max_uses}</div>`
    ).join("") || '<p class="rp-hint">Chưa có mã</p>';
  }

  async function saveAdsAlias() {
    const ids = ($("plat-ads-ids").value || "").split(",").map((s) => +s.trim()).filter(Boolean);
    await api("/platform/ads", { method: "POST", body: JSON.stringify({
      alias: $("plat-ads-alias").value.trim(), src_msg_ids: ids, src_chat_id: numOrNull("plat-ads-chat"),
    })});
    toast("Ads OK"); loadAdsList();
  }

  async function loadAdsList() {
    const r = await api("/platform/ads");
    $("plat-ads-list").innerHTML = (r.contracts || []).map((c) =>
      `<div style="padding:0.5rem 0;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rp-border)">
        <span><strong>${esc(c.alias)}</strong> ${c.active ? "✅" : "❌"}</span>
        <button type="button" class="rp-btn" data-alias="${esc(c.alias)}" onclick="PlatformAdmin.terminateAds(this.dataset.alias)">Terminate</button>
      </div>`).join("") || '<p class="rp-hint">Chưa có contract</p>';
  }

  async function terminateAds(alias) {
    await api("/platform/ads/" + encodeURIComponent(alias) + "/terminate", { method: "POST" });
    loadAdsList();
  }

  async function loadShareLb() {
    const r = await api("/platform/share/leaderboard");
    $("plat-share-lb").innerHTML = (r.leaderboard || []).map((row) =>
      `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--rp-border)">
        <span>#${row.rank} ${esc(row.display)}</span><strong>${row.clicks}</strong></div>`
    ).join("") || '<p class="rp-hint">Chưa có dữ liệu</p>';
  }

  async function loadUsers() {
    const r = await api("/platform/users");
    const u = r.users || [];
    $("plat-users-table").innerHTML = u.length
      ? `<table class="rp-table"><tr><th>ID</th><th>User</th><th>VIP</th><th>Tier</th><th>Spam</th></tr>` +
        u.map((x) => `<tr><td>${x.telegram_id}</td><td>@${esc(x.username||"—")}</td><td>${x.is_vip?"✅":"—"}</td><td>${esc(x.tier||"")}</td><td>${x.spam_ban_until||"—"}</td></tr>`).join("") + "</table>"
      : '<p class="rp-hint">Chưa có user</p>';
  }

  function renderContributions(items) {
    $("plat-contrib-list").innerHTML = (items || []).map((c) =>
      `<div class="rp-contrib-item">
        <span>#${c.id} · user ${c.user_id} · <strong>${esc(c.proposed_name)}</strong></span>
        <span>
          <button type="button" class="rp-btn rp-btn-primary" onclick="PlatformAdmin.approveContrib(${c.id})">Duyệt</button>
          <button type="button" class="rp-btn" onclick="PlatformAdmin.rejectContrib(${c.id})">Từ chối</button>
        </span>
      </div>`).join("") || '<p class="rp-empty"><div class="ico">✨</div>Không có đóng góp chờ duyệt</p>';
  }

  async function loadContributions() {
    const r = await api("/platform/contributions");
    renderContributions(r.items);
  }

  async function approveContrib(id) {
    await api("/platform/contributions/" + id + "/approve", { method: "POST" });
    toast("Đã duyệt"); loadContributions(); refreshFromApi();
  }

  async function rejectContrib(id) {
    await api("/platform/contributions/" + id + "/reject", { method: "POST" });
    toast("Đã từ chối"); loadContributions();
  }

  async function loadRollups() {
    const r = await api("/platform/rollup");
    $("plat-rollup-list").innerHTML = (r.rollups || []).map((x) =>
      `<div style="padding:0.5rem 0;border-bottom:1px solid var(--rp-border)">Bot ${x.bot_id} · ${esc(x.month_label)} ${x.posted_at?"✅":"—"}</div>`
    ).join("") || '<p class="rp-hint">Chưa rollup</p>';
  }

  function bindEvents() {
    document.querySelectorAll(".rp-nav-item[data-plat]").forEach((btn) => {
      btn.addEventListener("click", () => subTab(btn.dataset.plat, btn));
    });
    const root = $("platform");
    if (root) {
      root.addEventListener("change", (e) => {
        markDirty();
        if (["plat-publish","plat-index","plat-delivery","plat-enabled"].includes(e.target?.id)) {
          renderLayersViz({
            publish_channels: $("plat-publish")?.checked,
            archive_index: $("plat-index")?.checked,
            bot_delivery: $("plat-delivery")?.checked,
            enabled: $("plat-enabled")?.checked,
          });
          renderEnabledPill({ enabled: $("plat-enabled")?.checked });
        }
      });
      root.addEventListener("input", () => markDirty());
    }
  }

  function init() { bindEvents(); }

  return {
    init, isDirty, applySnapshot, subTab, go, save, addBot,
    publishDay, closeDay, selectDay, restartBot, runBackup, downloadBackup,
    recheckAds, runRollup, createVipPlan, grantVip, createGiftCodes,
    saveAdsAlias, terminateAds, approveContrib, rejectContrib, refreshFromApi,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (window.PlatformAdmin) PlatformAdmin.init();
});
