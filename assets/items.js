/* ==========================================================================
   清单页：筛选、排序、分页、CSV 导出
   ========================================================================== */

(function () {
  "use strict";

  var PAGE_SIZE = 60;
  var state = { q: "", zone: "", cat: "", sort: "name", page: 1, item: "" };

  var input;
  var zoneSelect;
  var catSelect;
  var sortSelect;
  var resetBtn;
  var rows;
  var listEmpty;
  var listCount;
  var pager;
  var exportBtn;

  function $(id) {
    return document.getElementById(id);
  }

  function syncHash() {
    var hash = WH.buildHash(state);
    var url = location.pathname + location.search + (hash === "#" ? "" : hash);
    try {
      history.replaceState(null, "", url);
    } catch (error) {
      /* file:// 或受限环境忽略 */
    }
  }

  function setInputs() {
    input.value = state.q;
    zoneSelect.value = state.zone;
    catSelect.value = state.cat;
    sortSelect.value = state.sort;
  }

  function readInputs() {
    state.q = input.value;
    state.zone = zoneSelect.value;
    state.cat = catSelect.value;
    state.sort = sortSelect.value;
  }

  function populate() {
    var zones = WH.zoneStats().zones;
    zones.forEach(function (zone) {
      zoneSelect.append(
        UI.el("option", { value: zone.id, text: zone.name })
      );
    });
    WH.CATEGORIES.forEach(function (category) {
      catSelect.append(
        UI.el("option", { value: category.id, text: category.name })
      );
    });
  }

  function makePageButton(label, page, current, disabled, ariaLabel) {
    var button = UI.el("button", { type: "button", text: label });
    if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
    if (current) button.setAttribute("aria-current", "page");
    button.disabled = Boolean(disabled);
    if (!disabled) {
      button.addEventListener("click", function () {
        state.page = page;
        syncHash();
        render();
      });
    }
    return button;
  }

  function renderPager(page, pages) {
    UI.clear(pager);
    pager.hidden = pages <= 1;
    if (pages <= 1) return;

    pager.append(makePageButton("‹", page - 1, false, page <= 1, "上一页"));

    var wanted = [1, pages, page - 2, page - 1, page, page + 1, page + 2];
    var numbers = [];
    wanted.forEach(function (n) {
      if (n >= 1 && n <= pages && numbers.indexOf(n) === -1) numbers.push(n);
    });
    numbers.sort(function (a, b) {
      return a - b;
    });

    var previous = 0;
    numbers.forEach(function (n) {
      if (previous && n - previous > 1) {
        pager.append(UI.el("span", { class: "pager-info", text: "…" }));
      }
      pager.append(makePageButton(String(n), n, n === page, false, "第 " + n + " 页"));
      previous = n;
    });

    pager.append(makePageButton("›", page + 1, false, page >= pages, "下一页"));
  }

  function renderRows(list) {
    UI.clear(rows);
    list.forEach(function (item) {
      var row = UI.el("div", { class: "item-row" });

      row.append(UI.el("span", { class: "code row-code", text: item.code }));

      var nameCell = UI.el("div", { class: "row-name" });
      var open = UI.el("button", {
        type: "button",
        class: "item-open",
        text: item.name,
        title: "查看 " + item.name + " 的详情"
      });
      open.addEventListener("click", function () {
        openItem(item.code);
      });
      nameCell.append(open);
      row.append(nameCell);

      row.append(
        UI.el("div", { class: "row-loc", text: WH.locText(item.code) })
      );

      row.append(
        UI.el("div", { class: "row-cat" }, [
          UI.el("span", { class: "cat-pill" }, [
            UI.el("span", { class: "dot", style: { background: item.categoryColor } }),
            item.category
          ])
        ])
      );

      var copy = UI.el("button", {
        type: "button",
        class: "icon-btn",
        title: "复制编码",
        "aria-label": "复制 " + item.name + " 的编码",
        text: "⧉"
      });
      copy.addEventListener("click", function () {
        UI.copy(item.code, "编码");
      });

      var map = UI.el("a", {
        class: "icon-btn",
        href: "map.html#item=" + encodeURIComponent(item.code),
        title: "在地图中查看",
        "aria-label": "在地图中查看 " + item.name,
        text: "⌖"
      });

      row.append(UI.el("div", { class: "row-actions" }, [copy, map]));
      rows.append(row);
    });
  }

  function openItem(code) {
    state.item = code;
    syncHash();
    UI.openItem(code);
  }

  function render() {
    if (state.page < 1) state.page = 1;
    var query = state.q.trim();

    var first = WH.search(query, {
      zone: state.zone,
      cat: state.cat,
      sort: state.sort,
      offset: 0,
      limit: 1
    });
    var total = first.total;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (state.page > pages) {
      state.page = pages;
      syncHash();
    }

    var found = WH.search(query, {
      zone: state.zone,
      cat: state.cat,
      sort: state.sort,
      offset: (state.page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE
    });

    if (!total) {
      UI.clear(rows);
      renderPager(1, 1);
      listCount.textContent = "共 0 件";
      exportBtn.disabled = true;
      UI.emptyState(
        listEmpty,
        "没有匹配的物品",
        "试试清空筛选条件，或者换一个更短的关键词。",
        "items.html",
        "清空筛选"
      );
      return;
    }

    listEmpty.hidden = true;
    exportBtn.disabled = false;
    renderRows(found.items);
    renderPager(state.page, pages);

    var text = "共 " + total + " 件";
    if (pages > 1) text += " · 第 " + state.page + " / " + pages + " 页";
    listCount.textContent = text;
  }

  function csvCell(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function exportCsv() {
    var found = WH.search(state.q.trim(), {
      zone: state.zone,
      cat: state.cat,
      sort: state.sort,
      offset: 0,
      limit: 100000
    });
    if (!found.total) {
      UI.toast("没有可导出的数据");
      return;
    }

    var lines = ["code,zone,zone_name,row,slot,item,category"];
    found.items.forEach(function (item) {
      lines.push(
        [
          item.code,
          item.zone,
          item.zoneName,
          item.row,
          item.slot,
          item.name,
          item.category
        ].map(csvCell).join(",")
      );
    });

    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8"
    });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var link = UI.el("a", {
      href: url,
      download: "minecraft-warehouse-" + stamp + ".csv"
    });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    UI.toast("已导出 " + found.total + " 件");
  }

  function applyHash() {
    var hash = WH.parseHash(location.hash);
    state = {
      q: hash.q,
      zone: hash.zone,
      cat: hash.cat,
      sort: hash.sort,
      page: hash.page,
      item: hash.item
    };
    setInputs();
    render();
  }

  function bind() {
    document.getElementById("filters").addEventListener("submit", function (event) {
      event.preventDefault();
    });

    var debounced = UI.debounce(function () {
      readInputs();
      state.page = 1;
      state.item = "";
      syncHash();
      render();
    }, 150);

    input.addEventListener("input", function () {
      debounced();
    });

    input.addEventListener("search", function () {
      readInputs();
      state.page = 1;
      state.item = "";
      syncHash();
      render();
    });

    [zoneSelect, catSelect, sortSelect].forEach(function (select) {
      select.addEventListener("change", function () {
        readInputs();
        state.page = 1;
        state.item = "";
        syncHash();
        render();
      });
    });

    resetBtn.addEventListener("click", function () {
      state = { q: "", zone: "", cat: "", sort: "name", page: 1, item: "" };
      setInputs();
      syncHash();
      render();
      input.focus();
    });

    exportBtn.addEventListener("click", exportCsv);

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
        state.page = 1;
        state.item = "";
        syncHash();
        render();
      }
    });

    window.addEventListener("hashchange", function () {
      applyHash();
    });

    UI.onItemOpen = function (item) {
      state.item = item.code;
      syncHash();
    };
    UI.onItemDialogClose = function () {
      state.item = "";
      syncHash();
    };
  }

  function init() {
    input = $("q");
    zoneSelect = $("zone-filter");
    catSelect = $("cat-filter");
    sortSelect = $("sort-filter");
    resetBtn = $("reset");
    rows = $("rows");
    listEmpty = $("list-empty");
    listCount = $("list-count");
    pager = $("pager");
    exportBtn = $("export");

    populate();

    var hash = WH.parseHash(location.hash);
    state = {
      q: hash.q,
      zone: hash.zone,
      cat: hash.cat,
      sort: hash.sort,
      page: hash.page,
      item: hash.item
    };
    setInputs();
    render();
    bind();

    if (hash.item) {
      window.setTimeout(function () {
        UI.openItem(hash.item);
      }, 80);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
