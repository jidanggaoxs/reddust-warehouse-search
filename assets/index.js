/* ==========================================================================
   总览页：搜索、分类筛选、最近查看、区域概览
   ========================================================================== */

(function () {
  "use strict";

  var state = { q: "", cat: "" };
  var pickCache = null;

  var input;
  var clearBtn;
  var form;
  var chips;
  var results;
  var empty;
  var resultTitle;
  var resultCount;
  var recentSection;
  var recentList;
  var zoneGrid;

  var SUGGESTIONS = [
    "钻石",
    "羊毛",
    "橡木楼梯",
    "苹果",
    "红石火把",
    "玻璃",
    "铁锭",
    "面包",
    "海带",
    "珊瑚",
    "南瓜灯",
    "木棍"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function catName(id) {
    for (var i = 0; i < WH.CATEGORIES.length; i += 1) {
      if (WH.CATEGORIES[i].id === id) return WH.CATEGORIES[i].name;
    }
    return "";
  }

  function syncHash() {
    var hash = WH.buildHash({ q: state.q, cat: state.cat, page: 1, sort: "name" });
    var url = location.pathname + location.search + (hash === "#" ? "" : hash);
    try {
      history.replaceState(null, "", url);
    } catch (error) {
      /* file:// 或受限环境忽略 */
    }
  }

  function setCount(text, linkHref, linkText) {
    resultCount.textContent = text;
    if (linkHref) {
      resultCount.append(" · ");
      resultCount.append(
        UI.el("a", { href: linkHref, text: linkText || "查看全部" })
      );
    }
  }

  function setTitle(text) {
    resultTitle.textContent = text;
  }

  function renderChips() {
    UI.clear(chips);
    var stats = WH.zoneStats();

    var all = UI.el("button", {
      type: "button",
      class: "chip",
      "aria-pressed": state.cat ? "false" : "true"
    }, [
      UI.el("span", { text: "全部" }),
      UI.el("span", { class: "faint", text: String(stats.used) })
    ]);
    all.addEventListener("click", function () {
      state.cat = "";
      renderChips();
      render();
    });
    chips.append(all);

    WH.categoryStats().forEach(function (category) {
      var active = state.cat === category.id;
      var chip = UI.el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": active ? "true" : "false",
        title: category.desc || category.name
      }, [
        UI.el("span", { class: "dot", style: { background: category.color } }),
        UI.el("span", { text: category.name }),
        UI.el("span", { class: "faint", text: String(category.count) })
      ]);
      chip.addEventListener("click", function () {
        state.cat = active ? "" : category.id;
        renderChips();
        render();
      });
      chips.append(chip);
    });
  }

  function getPicks() {
    if (pickCache) return pickCache;
    var picked = [];
    var seen = {};
    SUGGESTIONS.forEach(function (term) {
      if (picked.length >= 12) return;
      var found = WH.search(term, { limit: 1 });
      if (!found.items.length) return;
      var item = found.items[0];
      if (seen[item.code]) return;
      seen[item.code] = true;
      picked.push(item);
    });
    pickCache = picked;
    return picked;
  }

  function renderCards(list) {
    UI.clear(results);
    list.forEach(function (item) {
      results.append(UI.itemCard(item));
    });
  }

  function renderRecent() {
    if (!recentList) return;
    var codes = WH.getRecent();
    UI.clear(recentList);
    if (!codes.length) {
      recentSection.hidden = true;
      return;
    }
    var used = 0;
    codes.forEach(function (code) {
      var item = UI.itemByCode(code);
      if (!item) return;
      used += 1;
      var button = UI.el("button", {
        type: "button",
        class: "recent-item",
        title: "查看 " + item.name
      }, [
        UI.el("span", { class: "code", text: item.code }),
        UI.el("span", { text: item.name })
      ]);
      button.addEventListener("click", function () {
        UI.openItem(item.code);
      });
      recentList.append(button);
    });
    recentSection.hidden = used === 0;
  }

  function renderZones() {
    var stats = WH.zoneStats();
    UI.clear(zoneGrid);

    stats.zones.forEach(function (zone) {
      var color = UI.zoneColor(zone.id);
      var card = UI.el("a", {
        class: "zone-card",
        href: "map.html#zone-" + encodeURIComponent(zone.id),
        style: { "--zone-color": color },
        "aria-label": "打开 " + zone.name + " 的地图"
      });

      var head = UI.el("div", { class: "zone-card-head" }, [
        UI.el("h3", { text: zone.name }),
        UI.el("span", {
          class: "zone-kind",
          text: (zone.kind === "aisle" ? "货架" : "柜子") + " · " + zone.rows + " 排 × " + zone.cols + " 格"
        })
      ]);

      var meter = UI.el("div", { class: "zone-meter" }, [
        UI.el("span", { style: { width: zone.rate + "%" } })
      ]);

      var foot = UI.el("div", { class: "zone-card-foot" }, [
        UI.el("span", { text: zone.used + " / " + zone.total + " 格" }),
        UI.el("span", { text: UI.fmtRate(zone.rate) })
      ]);

      card.append(head, meter, foot);
      zoneGrid.append(card);
    });
  }

  function itemsLink() {
    var hash = WH.buildHash({
      q: state.q,
      cat: state.cat,
      sort: state.q ? "relevance" : "name"
    });
    return "items.html" + (hash === "#" ? "" : hash);
  }

  function render() {
    var query = state.q.trim();
    var hasFilter = Boolean(query || state.cat);

    if (!hasFilter) {
      setTitle("快速开始");
      setCount("输入关键词，或从下面挑一件");
      var picks = getPicks();
      renderCards(picks);
      empty.hidden = true;
      results.hidden = false;
      return;
    }

    var found = WH.search(query, {
      cat: state.cat,
      sort: query ? "relevance" : "name",
      limit: 60
    });

    if (state.cat) {
      var name = catName(state.cat);
      setTitle(query ? "搜索结果 · " + name : "分类 · " + name);
    } else {
      setTitle("搜索结果");
    }

    if (!found.total) {
      renderCards([]);
      setCount("0 件");
      UI.emptyState(
        empty,
        "没有找到匹配的物品",
        "换一个更短的关键词，或清空分类筛选再试一次。",
        itemsLink(),
        "打开完整清单"
      );
      results.hidden = true;
      return;
    }

    empty.hidden = true;
    results.hidden = false;
    renderCards(found.items);

    if (found.total > found.items.length) {
      setCount(
        "共 " + found.total + " 件（显示前 " + found.items.length + " 件）",
        itemsLink(),
        "查看全部"
      );
    } else {
      setCount("共 " + found.total + " 件");
    }
  }

  function updateClear() {
    clearBtn.hidden = !input.value;
  }

  function applyHash() {
    var hash = WH.parseHash(location.hash);
    state.q = hash.q;
    state.cat = hash.cat;
    input.value = state.q;
    updateClear();
    renderChips();
    render();
  }

  function bind() {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      render();
    });

    var debounced = UI.debounce(function () {
      render();
    }, 120);

    input.addEventListener("input", function () {
      state.q = input.value;
      updateClear();
      syncHash();
      debounced();
    });

    input.addEventListener("search", function () {
      state.q = input.value;
      updateClear();
      syncHash();
      render();
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      state.q = "";
      updateClear();
      syncHash();
      render();
      input.focus();
    });

    document.getElementById("clear-recent").addEventListener("click", function () {
      UI.clearRecent();
      renderRecent();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "/" && !UI.isTypingTarget(event)) {
        event.preventDefault();
        input.focus();
        input.select();
      } else if (
        event.key === "Escape" &&
        document.activeElement === input &&
        input.value
      ) {
        event.preventDefault();
        input.value = "";
        state.q = "";
        updateClear();
        syncHash();
        render();
      }
    });

    window.addEventListener("hashchange", applyHash);
    UI.onItemDialogClose = function () {
      renderRecent();
      syncHash();
    };
  }

  function init() {
    input = $("q");
    clearBtn = $("clear-btn");
    form = $("search-form");
    chips = $("cat-chips");
    results = $("results");
    empty = $("empty");
    resultTitle = $("results-title");
    resultCount = $("result-count");
    recentSection = $("recent-section");
    recentList = $("recent-list");
    zoneGrid = $("zone-grid");

    var hash = WH.parseHash(location.hash);
    state.q = hash.q;
    state.cat = hash.cat;
    input.value = state.q;
    updateClear();

    renderChips();
    renderZones();
    renderRecent();
    render();
    bind();

    if (hash.item) {
      window.setTimeout(function () {
        UI.openItem(hash.item);
      }, 60);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
