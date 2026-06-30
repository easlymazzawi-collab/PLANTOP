/**
 * Research Platform admin — UI khớp /api/platform/*
 * Phụ thuộc globals từ index.html: api(), toast(), bumpEditPause(), scheduleRefreshAfterEdit()
 */
window.PlatformAdmin = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let dirty = false;
  let botsDraft = [];
  let daysCache = [];
  let activeSub = "cfg";
  let selectedDayId = null;

  const STATUS_LABEL = {
    draft: "Nháp",
    channel_done: "Đã up kênh",
    indexed: "Đã index",
    published: "Published",
    closed: "Đóng",
  };

  function markDirty() {
    dirty = true;
    if (typeof bumpEditPause === "function") bumpEditPause();
  }

  function isDirty() {
    return dirty;
  }

  function subTab(name, btn) {
    activeSub = name;
    document.querySelectorAll(".plat-pane").forEach((el) => el.classList.remove("active"));
    const pane = $("plat-pane-" + name);
    if (pane) pane.classList.add("active");
    document.querySelectorAll(".plat-nav button").forEach((b) => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
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
    el.innerHTML = `
      <div class="plat-stat"><div class="n">${stats.days_count ?? 0}</div><div class="l">Ngày archive</div></div>
      <div class="plat-stat"><div class="n">${online}/${stats.bots_configured ?? (botStatus || []).length}</div><div class="l">Bot online</div></div>
      <div class="plat-stat"><div class="n">${stats.pending_contributions ?? 0}</div><div class="l">Chờ duyệt tên</div></div>
      <div class="plat-stat"><div class="n">${stats.users_count ?? "—"}</div><div class="l">Users</div></div>
      <div class="plat-stat"><div class="n">${queue?.running ? "▶" : "⏸"}</div><div class="l">Queue</div></div>`;
    const badge = $("plat-contrib-badge");
    if (badge) {
      const n = stats.pending_contributions || 0;
      badge.textContent = n > 0 ? String(n) : "";
      badge.style.display = n > 0 ? "inline" : "none";
    }
  }

  function renderBots(bots, botStatus) {
    botsDraft = (bots || []).map((b) => ({ ...b }));
    if (!botsDraft.length) {
      botsDraft = [{
        username: "", branch: "ads", enabled: true, queue_order: 0,
        publish_channels: true, archive_index: true, bot_delivery: true,
      }];
    }
    const statusMap = {};
    (botStatus || []).forEach((s) => { statusMap[s.username || s.key] = s; });

    $("plat-bots-list").innerHTML = botsDraft.map((b, i) => {
      const st = statusMap[b.username] || {};
      const dot = st.running ? "on" : "off";
      return `
      <div class="plat-bot-card" data-idx="${i}">
        <h4>
          <span>Bot #${i + 1} ${b.username ? "@" + b.username : ""}</span>
          <span><span class="plat-status-dot ${dot}"></span> ${st.running ? "online" : "offline"}
          <button type="button" class="secondary" style="padding:0.2rem 0.5rem;font-size:0.75rem;margin-left:0.5rem"
            onclick="PlatformAdmin.restartBot('${(b.username || "").replace(/'/g, "")}')">Restart</button></span>
        </h4>
        <div class="plat-inline-form">
          <div><label>@username</label><input class="pb-user" value="${esc(b.username || "")}" /></div>
          <div><label>Token</label><input class="pb-token" type="password" placeholder="${b.has_token ? "••• giữ cũ" : "bot token"}" /></div>
          <div><label>Queue order</label><input class="pb-order" type="number" value="${b.queue_order ?? i}" /></div>
          <div><label>Branch</label>
            <select class="pb-branch">
              <option value="ads" ${b.branch !== "plain" ? "selected" : ""}>ads</option>
              <option value="plain" ${b.branch === "plain" ? "selected" : ""}>plain</option>
            </select>
          </div>
        </div>
        <div class="plat-inline-form">
          <div><label>Forum nguồn ID</label><input class="pb-forum" type="number" value="${b.source_forum_id ?? ""}" /></div>
          <div><label>Topic nguồn ID</label><input class="pb-topic" type="number" value="${b.source_topic_id ?? ""}" /></div>
          <div><label>Catalog topic ID</label><input class="pb-cat" type="number" value="${b.catalog_topic_id ?? ""}" /></div>
        </div>
        <div class="layers">
          <label><input class="pb-en" type="checkbox" ${b.enabled !== false ? "checked" : ""} /> Enabled</label>
          <label><input class="pb-pub" type="checkbox" ${b.publish_channels !== false ? "checked" : ""} /> Up kênh</label>
          <label><input class="pb-idx" type="checkbox" ${b.archive_index !== false ? "checked" : ""} /> Index</label>
          <label><input class="pb-del" type="checkbox" ${b.bot_delivery !== false ? "checked" : ""} /> Delivery</label>
        </div>
      </div>`;
    }).join("");
  }

  function renderConfig(plat) {
    plat = plat || {};
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
  }

  function renderArchive(days) {
    daysCache = days || [];
    const el = $("plat-days-table");
    if (!daysCache.length) {
      el.innerHTML = "<p class=\"hint\">Chưa có ngày — chạy auto up hoặc bật archive index.</p>";
      $("plat-day-detail").innerHTML = "";
      return;
    }
    let html = `<table class="plat-archive-table"><tr>
      <th>Ngày</th><th>Bot</th><th>Trạng thái</th><th>Lượt</th><th></th></tr>`;
    for (const d of daysCache) {
      const st = d.status || "draft";
      html += `<tr>
        <td><a href="#" onclick="PlatformAdmin.selectDay(${d.id});return false">${esc(d.topic_label)}</a></td>
        <td>${d.bot_id}</td>
        <td><span class="status-${st}">${STATUS_LABEL[st] || st}</span></td>
        <td>${d.runs_count || 0}</td>
        <td>
          <button type="button" class="secondary" onclick="PlatformAdmin.publishDay(${d.id})">Publish</button>
          <button type="button" class="secondary" onclick="PlatformAdmin.closeDay(${d.id})">Đóng</button>
        </td></tr>`;
    }
    html += "</table>";
    el.innerHTML = html;
  }

  async function selectDay(id) {
    selectedDayId = id;
    subTab("archive", document.querySelector('.plat-nav button[data-plat="archive"]'));
    await loadDayItems(id);
  }

  async function loadDayItems(dayId) {
    const el = $("plat-day-detail");
    if (!el) return;
    el.innerHTML = "<p class=\"hint\">Đang tải sequence…</p>";
    try {
      const r = await api("/platform/days/" + dayId + "/items");
      const items = r.items || [];
      const day = daysCache.find((d) => d.id === dayId);
      el.innerHTML = `<h3 style="margin:0 0 0.5rem;font-size:0.9rem">${esc(day?.topic_label || dayId)} — ${items.length} items</h3>` +
        items.map((it) => `
          <div class="item-row">
            <span class="seq">${it.seq}</span>
            <span class="${it.item_type === "ads" ? "type-ads" : ""}">${it.item_type}</span>
            <span>chat:${it.src_chat_id} msg:${it.src_msg_id}</span>
            ${it.ads_alias ? `<span>alias:${esc(it.ads_alias)}</span>` : ""}
          </div>`).join("") || "<p class=\"hint\">Trống</p>";
    } catch (e) {
      el.innerHTML = "<p class=\"hint\">Lỗi: " + esc(e.message) + "</p>";
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
    return [...document.querySelectorAll("#plat-bots-list .plat-bot-card")].map((row, i) => {
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

  function numOrNull(id) {
    const v = $(id).value.trim();
    return v ? +v : null;
  }

  function numVal(v) {
    return v ? +v : null;
  }

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  async function save() {
    markDirty();
    try {
      await api("/platform", { method: "PATCH", body: JSON.stringify(collectPatch()) });
      dirty = false;
      toast("Đã lưu Platform");
      if (typeof scheduleRefreshAfterEdit === "function") scheduleRefreshAfterEdit();
      await refreshFromApi();
    } catch (e) { toast("Lỗi lưu: " + e.message); }
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
    loadBackupStatus();
  }

  function addBot() {
    if (botsDraft.length >= 10) { toast("Tối đa 10 bot"); return; }
    botsDraft.push({
      username: "", enabled: true, queue_order: botsDraft.length, branch: "ads",
      publish_channels: true, archive_index: true, bot_delivery: true,
    });
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
      await api("/platform/bots/restart", {
        method: "POST",
        body: JSON.stringify({ username: username || null }),
      });
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
      el.textContent = [
        s.scheduler_on ? "scheduler ON" : "OFF",
        s.last_backup_at || "chưa backup",
        (s.local_file_count || 0) + " file",
        (s.skip_reasons || []).join("; "),
      ].filter(Boolean).join(" · ");
    } catch { el.textContent = "Backup: —"; }
  }

  async function runBackup() {
    try {
      const r = await api("/platform/backup", {
        method: "POST",
        body: JSON.stringify({ telegram: $("plat-backup-tg").checked }),
      });
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
    toast("Rollup: " + (r.posted ?? r.ok ?? "OK"));
  }

  async function loadVipPlans() {
    try {
      const r = await api("/platform/vip/plans");
      $("plat-vip-plans").innerHTML = (r.plans || []).map((p) =>
        `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
          <strong>#${p.id}</strong> ${esc(p.name)} — ${p.stars_price}⭐ · ${p.plan_type}
          ${p.duration_days ? p.duration_days + " ngày" : "vĩnh viễn"}
          <span class="badge">${p.enabled ? "ON" : "OFF"}</span>
        </div>`).join("") || "<p class=\"hint\">Chưa có plan</p>";
    } catch (e) { $("plat-vip-plans").textContent = e.message; }
  }

  async function createVipPlan() {
    try {
      await api("/platform/vip/plans", {
        method: "POST",
        body: JSON.stringify({
          plan_type: $("plat-vip-type").value,
          name: $("plat-vip-name").value.trim(),
          stars_price: +$("plat-vip-stars").value || 1,
          duration_days: $("plat-vip-days").value ? +$("plat-vip-days").value : null,
          enabled: true,
        }),
      });
      toast("Đã tạo plan");
      loadVipPlans();
    } catch (e) { toast(e.message); }
  }

  async function grantVip() {
    await api("/platform/vip/grant", {
      method: "POST",
      body: JSON.stringify({ user_id: +$("plat-vip-uid").value, plan_id: +$("plat-vip-planid").value }),
    });
    toast("Grant VIP OK");
  }

  async function createGiftCodes() {
    const r = await api("/platform/giftcodes", {
      method: "POST",
      body: JSON.stringify({
        plan_id: +$("plat-gift-plan").value,
        count: +$("plat-gift-count").value,
        prefix: $("plat-gift-prefix").value,
      }),
    });
    toast("Tạo " + (r.codes || []).length + " mã");
    loadGiftCodes();
  }

  async function loadGiftCodes() {
    const r = await api("/platform/giftcodes");
    $("plat-gift-list").innerHTML = (r.codes || []).map((c) =>
      `<div><code>${esc(c.code)}</code> plan=${c.plan_id} used=${c.used_count}/${c.max_uses}</div>`
    ).join("") || "<p class=\"hint\">Chưa có mã</p>";
  }

  async function saveAdsAlias() {
    const ids = ($("plat-ads-ids").value || "").split(",").map((s) => +s.trim()).filter(Boolean);
    await api("/platform/ads", {
      method: "POST",
      body: JSON.stringify({
        alias: $("plat-ads-alias").value.trim(),
        src_msg_ids: ids,
        src_chat_id: numOrNull("plat-ads-chat"),
      }),
    });
    toast("Ads alias OK");
    loadAdsList();
  }

  async function loadAdsList() {
    const r = await api("/platform/ads");
    $("plat-ads-list").innerHTML = (r.contracts || []).map((c) =>
      `<div style="padding:0.35rem 0">${esc(c.alias)} ${c.active ? "✅" : "❌"}
        <button type="button" class="secondary" data-alias="${esc(c.alias)}" onclick="PlatformAdmin.terminateAds(this.dataset.alias)">Terminate</button></div>`
    ).join("") || "<p class=\"hint\">Chưa có contract</p>";
  }

  async function terminateAds(alias) {
    await api("/platform/ads/" + encodeURIComponent(alias) + "/terminate", { method: "POST" });
    loadAdsList();
  }

  async function loadShareLb() {
    const r = await api("/platform/share/leaderboard");
    $("plat-share-lb").innerHTML = (r.leaderboard || []).map((row) =>
      `<div>#${row.rank} ${esc(row.display)} — ${row.clicks} clicks</div>`
    ).join("") || "<p class=\"hint\">Chưa có dữ liệu / event tắt</p>";
  }

  async function loadUsers() {
    const r = await api("/platform/users");
    const u = r.users || [];
    $("plat-users-table").innerHTML = u.length
      ? `<table><tr><th>ID</th><th>User</th><th>VIP</th><th>Tier</th><th>Spam</th><th>Forward</th></tr>` +
        u.map((x) => `<tr>
          <td>${x.telegram_id}</td>
          <td>@${esc(x.username || "—")}</td>
          <td>${x.is_vip ? "✅" : "—"}</td>
          <td>${esc(x.tier || "")}</td>
          <td>${x.spam_ban_until || "—"}</td>
          <td>${x.allow_forward ? "✅" : "❌"}</td>
        </tr>`).join("") + "</table>"
      : "<p class=\"hint\">Chưa có user</p>";
  }

  function renderContributions(items) {
    $("plat-contrib-list").innerHTML = (items || []).map((c) =>
      `<div class="plat-contrib-item">
        <span>#${c.id} user ${c.user_id} · <strong>${esc(c.proposed_name)}</strong> · msgs ${(c.msg_ids || []).length}</span>
        <span>
          <button class="secondary" onclick="PlatformAdmin.approveContrib(${c.id})">Duyệt</button>
          <button class="secondary" onclick="PlatformAdmin.rejectContrib(${c.id})">Từ chối</button>
        </span>
      </div>`).join("") || "<p class=\"hint\">Không có đóng góp chờ duyệt</p>";
  }

  async function loadContributions() {
    const r = await api("/platform/contributions");
    renderContributions(r.items);
  }

  async function approveContrib(id) {
    await api("/platform/contributions/" + id + "/approve", { method: "POST" });
    toast("Đã duyệt");
    loadContributions();
    refreshFromApi();
  }

  async function rejectContrib(id) {
    await api("/platform/contributions/" + id + "/reject", { method: "POST" });
    toast("Đã từ chối");
    loadContributions();
  }

  async function loadRollups() {
    const r = await api("/platform/rollup");
    $("plat-rollup-list").innerHTML = (r.rollups || []).map((x) =>
      `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
        Bot ${x.bot_id} · ${esc(x.month_label)} ${x.posted_at ? "✅" : "—"}
      </div>`).join("") || "<p class=\"hint\">Chưa rollup</p>";
  }

  function bindEvents() {
    document.querySelectorAll(".plat-nav button[data-plat]").forEach((btn) => {
      btn.addEventListener("click", () => subTab(btn.dataset.plat, btn));
    });
    const root = $("platform");
    if (root) {
      root.addEventListener("change", () => markDirty());
      root.addEventListener("input", () => markDirty());
    }
  }

  function init() {
    bindEvents();
  }

  return {
    init,
    isDirty,
    applySnapshot,
    subTab,
    save,
    addBot,
    publishDay,
    closeDay,
    selectDay,
    restartBot,
    runBackup,
    downloadBackup,
    recheckAds,
    runRollup,
    createVipPlan,
    grantVip,
    createGiftCodes,
    saveAdsAlias,
    terminateAds,
    approveContrib,
    rejectContrib,
    refreshFromApi,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (window.PlatformAdmin) PlatformAdmin.init();
});
