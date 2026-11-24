/* ==========================================================================
   地图页：六个区域完整铺开，按排/组渲染格位
   ========================================================================== */

(function () {
  "use strict";

  var container;
  var jump;
  var byCode = null;
  var lastZone = "";

  function $(id) {
    return document.getElementById(id);
  }

  function lookup(code) {
    if (!byCode) {
      byCode = {};
      WH.items().forEach(function (item) {
        byCode[item.code] = item;
      });
    }
    return byCode[code] || null;
  }

  function zoneKind(zone) {
    return zone.kind === "aisle" ? "货架" : "柜子";
  }

  function groupCount(zone) {
    return zone.kind === "aisle" ? Math.ceil(zone.cols / 11) : 1;
  }

  function groupBounds(zone, index) {
    if (zone.kind !== "aisle") {
      return { start: 1, end: zone.cols, size: zone.cols };
    }
    var start = index * 11 + 1;
    var end = Math.min(start + 10, zone.cols);
    return { start: start, end: end, size: end - start + 1 };
  }

  function setHash(hash) {
    try {
      history.replaceState(null, "", location.pathname + location.search + hash);
    } catch (error) {
      /* file:// 或受限环境忽略 */
    }
  }

  function scrollZone(zoneId) {
    var node = document.getElementById("zone-" + zoneId);
    if (!node) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function buildJump(zones) {
    UI.clear(jump);
    zones.forEach(function (zone) {
      var color = UI.zoneColor(zone.id);
      var link = UI.el("a", {
        class: "chip",
        href: "#zone-" + zone.id,
        "aria-label": "跳到 " + zone.name
      }, [
        UI.el("span", { class: "dot", style: { background: color } }),
        UI.el("span", { text: zone.name })
      ]);
      link.addEventListener("click", function (event) {
        event.preventDefault();
        scrollZone(zone.id);
        setHash("#zone-" + zone.id);
        lastZone = zone.id;
      });
      jump.append(link);
    });
  }

  function buildZone(zone, stats) {
    var color = UI.zoneColor(zone.id);
    var section = UI.el("section", {
      class: "map-zone",
      id: "zone-" + zone.id,
      style: { "--zone-color": color },
      "aria-labelledby": "zone-" + zone.id + "-title"
    });

    var head = UI.el("div", { class: "map-zone-head" });
    var title = UI.el("div", { class: "map-zone-title" }, [
      UI.el("span", { class: "zone-badge", text: zone.id.charAt(0), "aria-hidden": "true" }),
      UI.el("div", {}, [
        UI.el("h2", { id: "zone-" + zone.id + "-title", text: zone.name }),
        UI.el("p", {
          text:
            zoneKind(zone) +
            " · " +
            (zone.kind === "aisle"
              ? zone.rows + " 排 × " + zone.cols + " 格"
              : zone.cols + " 格（单排）")
        })
      ])
    ]);

    var meter = UI.el("div", { class: "map-zone-meter" });
    var bar = UI.el("div", { class: "bar" }, [
      UI.el("span", { style: { width: stats.rate + "%" } })
    ]);
    meter.append(
      bar,
      UI.el("p", {}, [
        UI.el("span", { text: stats.used + " / " + stats.total + " 格" }),
        UI.el("span", { text: UI.fmtRate(stats.rate) })
      ])
    );

    head.append(title, meter);

    var scroll = UI.el("div", { class: "map-scroll", tabindex: "0", "aria-label": zone.name + " 地图，可横向滚动" });
    var board = UI.el("div", { class: "map-board" });

    var heads = UI.el("div", { class: "map-group-heads", "aria-hidden": "true" });
    for (var g = 0; g < groupCount(zone); g += 1) {
      var bounds = groupBounds(zone, g);
      heads.append(
        UI.el("div", {
          class: "map-group-head",
          text: UI.pad2(bounds.start) + "–" + UI.pad2(bounds.end)
        })
      );
    }
    board.append(heads);

    for (var row = 1; row <= zone.rows; row += 1) {
      var rowEl = UI.el("div", { class: "map-row" });
      rowEl.append(
        UI.el("div", {
          class: "map-row-label",
          text: zone.kind === "aisle" ? "第 " + row + " 排" : "柜内"
        })
      );

      for (var group = 0; group < groupCount(zone); group += 1) {
        var range = groupBounds(zone, group);
        var groupEl = UI.el("div", {
          class: "map-group" + (zone.kind === "aisle" ? "" : " small")
        });
        for (var slot = range.start; slot <= range.end; slot += 1) {
          var code = WH.codeFor(zone.id, row, slot);
          var item = lookup(code);
          if (item) groupEl.append(UI.slot(item));
          else groupEl.append(UI.emptySlot("空位"));
        }
        rowEl.append(groupEl);
      }
      board.append(rowEl);
    }

    scroll.append(board);
    section.append(head, scroll);
    return section;
  }

  function renderMap() {
    var stats = WH.zoneStats();
    var statsById = {};
    stats.zones.forEach(function (zone) {
      statsById[zone.id] = zone;
    });
    UI.clear(container);
    stats.zones.forEach(function (zone) {
      container.append(buildZone(zone, statsById[zone.id]));
    });
    buildJump(stats.zones);
  }

  /* 深链进来的物品：图上高亮 + 搜索框填名字 */
  var schematicInput = null;
  var schematicClear = null;

  function itemName(code) {
    var list = WH.items();
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i].name;
    }
    return "";
  }

  function focusSchematic(code) {
    if (!WH.schematic) return;
    var p = WH.schematic.payloadFor(code) || WH.schematic.payloadForShelf(code);
    if (!p) return;
    var name = itemName(code);
    WH.schematic.highlight(p, name);
    if (schematicInput) {
      schematicInput.value = name || code;
      if (schematicClear) schematicClear.hidden = false;
    }
  }

  function applyHash() {
    var raw = String(location.hash || "").replace(/^#/, "");
    if (!raw) return;

    var params;
    try {
      params = new URLSearchParams(raw);
    } catch (error) {
      params = null;
    }

    var item = params ? params.get("item") : "";
    if (item) {
      var parsed = WH.parseCode(item);
      if (parsed) {
        lastZone = parsed.zone;
        scrollZone(parsed.zone);
        focusSchematic(parsed.code);
        window.setTimeout(function () {
          UI.openItem(parsed.code);
        }, 80);
        return;
      }
    }

    var zoneParam = params ? (params.get("zone") || "").toUpperCase() : "";
    if (zoneParam && WH.zoneById(zoneParam)) {
      lastZone = zoneParam;
      scrollZone(zoneParam);
      if (WH.schematic) WH.schematic.focusZone(zoneParam);
      return;
    }

    var anchor = raw.match(/^zone-([A-Za-z]{2})$/);
    if (anchor && WH.zoneById(anchor[1].toUpperCase())) {
      lastZone = anchor[1].toUpperCase();
      scrollZone(lastZone);
      if (WH.schematic) WH.schematic.focusZone(lastZone);
      return;
    }
  }

  function init() {
    container = $("map-zones");
    jump = $("zone-jump");

    if (WH.schematic) WH.schematic.mount(document.querySelector("[data-schematic]"));

    /* 卡片内搜索 → 候选列表 → 选中才在图上定位 */
    var sInput = document.getElementById("schematic-q");
    var sClear = document.getElementById("schematic-clear");
    schematicInput = sInput;
    schematicClear = sClear;

    function syncClearBtn() {
      if (sClear) sClear.hidden = !sInput.value.trim();
    }

    if (WH.schematic && sInput) {
      WH.schematic.attachSearch(sInput, { onSelect: syncClearBtn });
      sInput.addEventListener("input", syncClearBtn);
    }

    if (sInput) {
      sInput.addEventListener("search", syncClearBtn);
      if (sClear) {
        sClear.addEventListener("click", function () {
          sInput.value = "";
          syncClearBtn();
          if (WH.schematic) WH.schematic.clear();
          sInput.focus();
        });
      }
    }


    renderMap();

    UI.onItemOpen = function (item) {
      lastZone = item.zone;
      setHash("#item=" + encodeURIComponent(item.code));
    };
    UI.onItemDialogClose = function () {
      if (lastZone) setHash("#zone-" + lastZone);
      else setHash("");
    };

    window.addEventListener("hashchange", applyHash);
    window.setTimeout(applyHash, 80);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
