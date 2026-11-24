/* ==========================================================================
   仓库总平面图 · 极简 SVG 示意图
   六个区域的位置、排/段划分与大厅；点击格子给出大致位置。
   纯静态生成，不请求任何外部资源。
   ========================================================================== */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var COLOR_A = "#6fe0a0";
  var COLOR_B = "#7fb6e8";
  var COLOR_C = "#f0b45a";

  /* 分组：每 11 格一组（44 格 = 4 组），从大厅那侧往外数；排从走道那侧数起为第 1 排 */
  var GROUP_SIZE = 11;

  /* 区块几何：照俯视图还原——BR 左上、AL 右上、BL 左下、AR 右下，CR/CL 在下方 */
  var ZONES = [
    { id: "BR", name: "B 区 · 右侧", color: COLOR_B, x: 40, y: 44, w: 272, h: 104, rows: 4, cols: 44, hallSide: "right", corridorSide: "bottom" },
    { id: "AL", name: "A 区 · 左侧", color: COLOR_A, x: 588, y: 44, w: 272, h: 104, rows: 4, cols: 44, hallSide: "left", corridorSide: "bottom" },
    { id: "BL", name: "B 区 · 左侧", color: COLOR_B, x: 40, y: 176, w: 272, h: 104, rows: 4, cols: 44, hallSide: "right", corridorSide: "top", below: true },
    { id: "AR", name: "A 区 · 右侧", color: COLOR_A, x: 588, y: 176, w: 272, h: 104, rows: 4, cols: 44, hallSide: "left", corridorSide: "top", below: true },
    { id: "CR", name: "C 区 · 右侧", color: COLOR_C, x: 332, y: 300, w: 107, h: 182, rows: 1, cols: 9, vertical: true },
    { id: "CL", name: "C 区 · 左侧", color: COLOR_C, x: 461, y: 300, w: 107, h: 182, rows: 1, cols: 9, vertical: true }
  ];

  function colorOf(zoneId) {
    var ch = String(zoneId || "").charAt(0);
    return ch === "A" ? COLOR_A : ch === "B" ? COLOR_B : COLOR_C;
  }

  function el(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  function text(x, y, str, cls) {
    var t = el("text", { x: x, y: y, class: cls });
    t.textContent = str;
    return t;
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function groupCountFor(cols) {
    return Math.ceil(cols / GROUP_SIZE);
  }

  function groupRange(g, cols) {
    var a = g * GROUP_SIZE + 1;
    var b = Math.min(cols, a + GROUP_SIZE - 1);
    return [a, b];
  }

  function groupOf(slot) {
    var g = Math.floor((slot - 1) / GROUP_SIZE);
    return g < 0 ? 0 : g;
  }

  /* 槽位 1 在靠大厅那侧，往外递增 */
  function xOfSlot(z, slot, unitW) {
    return z.hallSide === "right" ? z.x + z.w - slot * unitW : z.x + (slot - 1) * unitW;
  }

  /* 格位区段（a..b，含两端）在图上的矩形：靠大厅那侧是第 a 格 */
  function spanOf(z, a, b, unitW) {
    var span = { x: 0, w: (b - a + 1) * unitW };
    if (z.hallSide === "right") span.x = z.x + z.w - b * unitW;
    else span.x = z.x + (a - 1) * unitW;
    return span;
  }

  /* 第 groups 组之后的分界线（从大厅那侧数） */
  function groupEdge(z, groups, unitW) {
    var offset = groups * GROUP_SIZE * unitW;
    return z.hallSide === "right" ? z.x + z.w - offset : z.x + offset;
  }

  function posText(p) {
    var z = p.zone;
    if (z.vertical) return z.id + " · 第 " + (p.seg + 1) + " 格";
    var range = p.range || groupRange(p.seg, z.cols);
    var head = z.id + " · 第 " + p.row + " 排";
    if (p.slot) {
      return head + " · 第 " + p.slot + " 格（" + range[0] + "–" + range[1] + " 组）";
    }
    return head + " · " + range[0] + "–" + range[1] + " 组";
  }

  var svg = null;
  var readout = null;
  var idleText = "点一个格子，或搜索物品";
  var cells = [];
  var current = null;
  var bound = false;

  function drawFrame() {
    svg.appendChild(el("path", {
      d: "M30 10H439M461 10H870A14 14 0 0 1 884 24V516A14 14 0 0 1 870 530H30A14 14 0 0 1 16 516V24A14 14 0 0 1 30 10",
      class: "sch-frame"
    }));
  }

  function drawZone(z) {
    var g = el("g", { "data-zone": z.id });

    var blk = el("rect", {
      x: z.x, y: z.y, width: z.w, height: z.h, rx: 8,
      class: "sch-block", "data-block": z.id
    });
    blk.style.fill = z.color;
    blk.style.fillOpacity = ".10";
    blk.style.stroke = z.color;
    blk.style.strokeOpacity = ".45";
    blk.style.strokeWidth = "1.2";
    g.appendChild(blk);

    var grid = el("g", { class: "sch-grid" });

    if (z.vertical) {
      var slotH = z.h / z.cols;
      for (var vs = 0; vs < z.cols; vs++) {
        var vrect = el("rect", {
          x: z.x, y: z.y + vs * slotH, width: z.w, height: slotH, class: "sch-cell",
          "data-zone": z.id, "data-row": 1, "data-seg": vs
        });
        g.appendChild(vrect);
        var vcode = z.id + "-" + pad2(vs + 1);
        cells.push({ node: vrect, code: vcode, zone: z, row: 1, seg: vs });
        bind(vrect, { code: vcode, zone: z, row: 1, seg: vs, slot: vs + 1 });
      }
      for (var vj = 1; vj < z.cols; vj++) {
        grid.appendChild(el("line", {
          x1: z.x, y1: z.y + vj * slotH, x2: z.x + z.w, y2: z.y + vj * slotH, class: "sch-slot-line"
        }));
      }
    } else {
      var unitW = z.w / z.cols;
      var unitH = z.h / z.rows;
      var gc = groupCountFor(z.cols);

      for (var r = 1; r <= z.rows; r++) {
        var cy = z.corridorSide === "top" ? z.y + (r - 1) * unitH : z.y + z.h - r * unitH;

        for (var gi = 0; gi < gc; gi++) {
          var range = groupRange(gi, z.cols);
          var span = spanOf(z, range[0], range[1], unitW);
          var rect = el("rect", {
            x: span.x, y: cy,
            width: span.w, height: unitH, class: "sch-cell",
            "data-zone": z.id, "data-row": r, "data-seg": gi
          });
          g.appendChild(rect);
          var mid = Math.round((range[0] + range[1]) / 2);
          var code = z.id + "-" + r + "-" + pad2(mid);
          cells.push({ node: rect, code: code, zone: z, row: r, seg: gi });
          bind(rect, { code: code, zone: z, row: r, seg: gi, slot: mid, range: range });
        }

        if (r > 1) {
          grid.appendChild(el("line", { x1: z.x, y1: cy, x2: z.x + z.w, y2: cy, class: "sch-row-line" }));
        }
      }

      for (var gb = 1; gb < gc; gb++) {
        var bx = groupEdge(z, gb, unitW);
        grid.appendChild(el("line", { x1: bx, y1: z.y, x2: bx, y2: z.y + z.h, class: "sch-seg-line" }));
      }
    }
    g.appendChild(grid);

    /* 标签：编号在框内，区名在框外 */
    var tc = text(z.x + z.w / 2, z.y + z.h / 2 + 7, z.id, "sch-code");
    tc.setAttribute("text-anchor", "middle");
    tc.setAttribute("data-code-zone", z.id);
    tc.style.fill = z.color;
    tc.style.opacity = ".78";
    g.appendChild(tc);

    var ny = z.vertical ? z.y + z.h + 30 : (z.below ? z.y + z.h + 15 : z.y - 8);
    var rightSide = !z.vertical && (z.x + z.w / 2) > 450;
    var nm = text(rightSide ? z.x + z.w : (z.vertical ? z.x + z.w / 2 : z.x), ny, z.name, "sch-name");
    if (z.vertical) nm.setAttribute("text-anchor", "middle");
    else if (rightSide) nm.setAttribute("text-anchor", "end");
    g.appendChild(nm);

    svg.appendChild(g);
  }

  function drawHall() {
    svg.appendChild(el("rect", { x: 332, y: 44, width: 236, height: 236, rx: 10, class: "sch-hall" }));
    svg.appendChild(el("path", {
      d: "M332 150V54A10 10 0 0 1 342 44H439" +
        "M461 44H558A10 10 0 0 1 568 54V150" +
        "M568 174V270A10 10 0 0 1 558 280H461" +
        "M439 280H342A10 10 0 0 1 332 270V174",
      class: "sch-hall-line"
    }));
  }

  function drawHub() {
    var hub = el("g");
    var arms = [
      [439, 10, 22, 117.73],
      [439, 196.27, 22, 297.73],
      [483.94, 150, 388.06, 24],
      [28, 150, 388.06, 24]
    ];
    arms.forEach(function (a) {
      hub.appendChild(el("rect", { x: a[0], y: a[1], width: a[2], height: a[3], class: "sch-hub" }));
    });

    var walls = [
      "M439 10V127.73", "M461 10V127.73",
      "M439 196.27V494", "M461 196.27V494",
      "M483.94 150H872", "M483.94 174H872",
      "M28 150H416.06", "M28 174H416.06"
    ];
    walls.forEach(function (d) {
      hub.appendChild(el("path", { d: d, class: "sch-hub-wall" }));
    });

    hub.appendChild(el("circle", { cx: 450, cy: 162, r: 36, class: "sch-hub-floor" }));
    var arcs = [
      "M483.94 174A36 36 0 0 1 461.02 196.27",
      "M438.98 196.27A36 36 0 0 1 416.06 174",
      "M416.06 150A36 36 0 0 1 438.98 127.73",
      "M461.02 127.73A36 36 0 0 1 483.94 150"
    ];
    arcs.forEach(function (d) {
      hub.appendChild(el("path", { d: d, class: "sch-hub-arc" }));
    });

    hub.appendChild(text(450, 168, "大厅", "sch-hub-name"));
    hub.appendChild(text(385.5, 97, "盒输入", "sch-deck"));
    hub.appendChild(text(514.5, 97, "鸡蛋糕", "sch-deck"));
    hub.appendChild(text(385.5, 227, "杂物区", "sch-deck"));
    hub.appendChild(text(514.5, 227, "盒填充", "sch-deck"));
    svg.appendChild(hub);
  }

  function bind(node, payload) {
    node.addEventListener("click", function () {
      highlight(payload);
    });
  }

  function clear(message) {
    cells.forEach(function (c) {
      c.node.classList.remove("on");
      c.node.style.fill = "";
      c.node.style.fillOpacity = "";
      c.node.style.stroke = "";
      c.node.style.strokeOpacity = "";
      c.node.style.strokeWidth = "";
    });
    svg.querySelectorAll(".sch-block").forEach(function (b) {
      var zc = colorOf(b.getAttribute("data-block"));
      b.classList.remove("on");
      b.style.fill = zc;
      b.style.fillOpacity = ".10";
      b.style.stroke = zc;
      b.style.strokeOpacity = ".45";
      b.style.strokeWidth = "1.2";
    });
    svg.querySelectorAll(".sch-code").forEach(function (t) {
      t.classList.remove("on");
      t.style.fill = colorOf(t.getAttribute("data-code-zone"));
      t.style.opacity = ".78";
    });
    svg.querySelectorAll(".sch-grid line").forEach(function (l) {
      l.style.opacity = "";
    });
    current = null;
    if (readout) {
      readout.classList.add("idle");
      readout.textContent = message || idleText;
    }
  }

  /* 只点亮某个区（用于 #zone=XX 深链），不标具体格位 */
  function focusZone(zoneId) {
    if (!svg) return;
    var zone = null;
    ZONES.forEach(function (z) {
      if (z.id === zoneId) zone = z;
    });
    if (!zone) return;
    clear();

    var block = svg.querySelector('[data-block="' + zone.id + '"]');
    if (block) {
      block.classList.add("on");
      var gr = block.parentNode && block.parentNode.querySelector(".sch-grid");
      if (gr) {
        Array.prototype.forEach.call(gr.children, function (l) {
          l.style.opacity = "1";
        });
      }
      block.style.fill = zone.color;
      block.style.fillOpacity = ".16";
      block.style.stroke = zone.color;
      block.style.strokeOpacity = "1";
      block.style.strokeWidth = "1.8";
    }

    if (readout) {
      readout.classList.remove("idle");
      readout.textContent = zone.name;
    }
  }

  /* 高亮：同区 + 同排 + 同段（柜区为精确格位）；label 可选，用于显示物品名 */
  function highlight(p, label) {
    if (!svg || !p || !p.zone) return;
    clear();

    cells.forEach(function (c) {
      if (c.zone.id === p.zone.id && c.seg === p.seg && (p.zone.vertical || c.row === p.row)) {
        c.node.classList.add("on");
        c.node.style.fill = p.zone.color;
        c.node.style.fillOpacity = ".34";
        c.node.style.stroke = p.zone.color;
        c.node.style.strokeOpacity = "1";
        c.node.style.strokeWidth = "1.4";
      }
    });

    var block = svg.querySelector('[data-block="' + p.zone.id + '"]');
    if (block) {
      block.classList.add("on");
      var gr = block.parentNode && block.parentNode.querySelector(".sch-grid");
      if (gr) {
        Array.prototype.forEach.call(gr.children, function (l) {
          l.style.opacity = "1";
        });
      }
      block.style.fill = p.zone.color;
      block.style.fillOpacity = ".16";
      block.style.stroke = p.zone.color;
      block.style.strokeOpacity = "1";
      block.style.strokeWidth = "1.8";
    }

    svg.querySelectorAll(".sch-code").forEach(function (t) {
      if (t.textContent === p.zone.id) {
        t.classList.add("on");
        t.style.fill = p.zone.color;
        t.style.opacity = "1";
      }
    });

    if (readout) {
      readout.classList.remove("idle");
      readout.textContent = label
        ? label + "　" + posText(p)
        : posText(p) + "　" + p.code;
    }
    current = p;
  }

  /* 按编码定位：AL-2-13 / CL-07 */
  function payloadFor(code) {
    var m = /^([A-Z]{2})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(String(code || "").trim().toUpperCase());
    if (!m) return null;
    var zone = null;
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].id === m[1]) { zone = ZONES[i]; break; }
    }
    if (!zone) return null;
    var row = m[3] ? Number(m[2]) : 1;
    var slot = m[3] ? Number(m[3]) : Number(m[2]);
    if (zone.vertical) {
      if (slot < 1 || slot > zone.cols) return null;
      return { code: code, zone: zone, row: 1, seg: slot - 1, slot: slot };
    }
    if (row < 1 || row > zone.rows || slot < 1 || slot > zone.cols) return null;
    var gi = groupOf(slot);
    return { code: code, zone: zone, row: row, seg: gi, slot: slot, range: groupRange(gi, zone.cols) };
  }

  /* 柜区需要精确格位，单独给一个入口 */
  function payloadForShelf(code) {
    var m = /^([A-Z]{2})-(\d{1,2})$/.exec(String(code || "").trim().toUpperCase());
    if (!m) return null;
    var zone = null;
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].id === m[1]) { zone = ZONES[i]; break; }
    }
    if (!zone || !zone.vertical) return null;
    return { code: code, zone: zone, row: 1, seg: Number(m[2]) - 1, slot: Number(m[2]) };
  }

  /* ---------- 搜索框 + 候选项：未选中前不定位 ---------- */
  function attachSearch(input, options) {
    if (!input || input.getAttribute("data-sch-search") === "1") return null;
    input.setAttribute("data-sch-search", "1");

    var opts = options || {};
    var form = input.parentNode;
    var box = document.createElement("div");
    box.className = "sch-sugg";
    box.hidden = true;
    form.appendChild(box);

    var rows = [];
    var active = -1;

    function hide() {
      box.hidden = true;
      box.innerHTML = "";
      rows = [];
      active = -1;
    }

    function markActive(next) {
      if (!rows.length) return;
      if (active >= 0 && rows[active]) rows[active].node.classList.remove("is-active");
      active = (next + rows.length) % rows.length;
      rows[active].node.classList.add("is-active");
      if (rows[active].node.scrollIntoView) rows[active].node.scrollIntoView({ block: "nearest" });
    }

    function choose(payload, item) {
      hide();
      if (!payload) return;
      input.value = item.name;
      highlight(payload, item.name);
      if (typeof opts.onSelect === "function") opts.onSelect(item);
    }

    function showList(term, found) {
      box.innerHTML = "";
      rows = [];
      active = -1;

      if (!found.total) {
        var none = document.createElement("p");
        none.className = "sch-sugg-empty";
        none.textContent = "没有找到「" + term + "」";
        box.appendChild(none);
        box.hidden = false;
        clear("没有找到「" + term + "」");
        return;
      }

      found.items.forEach(function (item) {
        var p = payloadFor(item.code);
        if (!p) p = payloadForShelf(item.code);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sch-sugg-row";

        var name = document.createElement("span");
        name.className = "sch-sugg-name";
        name.textContent = item.name;

        var meta = document.createElement("span");
        meta.className = "sch-sugg-meta";
        meta.textContent = (p ? posText(p) : item.code) + " · " + item.code;

        btn.appendChild(name);
        btn.appendChild(meta);
        btn.addEventListener("click", function () { choose(p, item); });
        box.appendChild(btn);
        rows.push({ node: btn, payload: p, item: item });
      });

      box.hidden = false;
    }

    function run() {
      var term = input.value.trim();
      if (!term) {
        hide();
        clear();
        return;
      }

      /* 直接输入编码 → 立即定位 */
      var byCode = payloadFor(term) || payloadForShelf(term);
      if (byCode) {
        hide();
        highlight(byCode);
        return;
      }

      var found = WH.search(term, { limit: 8 });
      var exact = null;
      found.items.forEach(function (item) {
        if (!exact && item.name.toLowerCase() === term.toLowerCase()) exact = item;
      });
      if (exact) {
        var p = payloadFor(exact.code) || payloadForShelf(exact.code);
        choose(p, exact);
        return;
      }

      /* 还没选中 → 图上不定位，只给候选 */
      clear();
      showList(term, found);
    }

    var timer = null;
    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 90);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (box.hidden) return;
        event.preventDefault();
        markActive(active + (event.key === "ArrowDown" ? 1 : -1));
        return;
      }
      if (event.key === "Enter") {
        if (box.hidden || !rows.length) return;
        event.preventDefault();
        var row = rows[active >= 0 ? active : 0];
        choose(row.payload, row.item);
        return;
      }
      if (event.key === "Escape" && !box.hidden) {
        event.preventDefault();
        hide();
      }
    });

    document.addEventListener("click", function (event) {
      if (box.hidden) return;
      if (form.contains(event.target)) return;
      hide();
    });

    return { run: run, hide: hide };
  }

  function mount(host) {
    if (!host || bound) return null;
    bound = true;

    svg = el("svg", {
      viewBox: "0 -30 900 570",
      role: "img",
      "aria-label": "仓库总平面图：四个货架区、两个柜区与中央大厅"
    });
    svg.setAttribute("class", "schematic-svg");

    readout = document.querySelector("[data-schematic-readout]");
    if (readout && readout.textContent.trim()) idleText = readout.textContent.trim();

    drawFrame();
    ZONES.forEach(drawZone);
    drawHall();
    drawHub();
    svg.appendChild(text(450, -2, "入口", "sch-entry"));

    host.appendChild(svg);
    clear();
    return api;
  }

  var api = {
    mount: mount,
    attachSearch: attachSearch,
    focusZone: focusZone,
    highlight: highlight,
    clear: clear,
    posText: posText,
    payloadFor: payloadFor,
    payloadForShelf: payloadForShelf,
    groupOf: groupOf,
    groupRange: groupRange,
    zones: ZONES,
    current: function () { return current; }
  };

  var WH = global.WH = global.WH || {};
  WH.schematic = api;
})(window);
