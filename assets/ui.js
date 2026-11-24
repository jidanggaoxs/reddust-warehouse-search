/* ==========================================================================
   仓库导航 · 公共 UI 工具
   负责：DOM 构建、分类色、统计注入、复制、Toast、物品详情弹窗。
   所有用户数据只通过 textContent 写入，不拼接 innerHTML。
   ========================================================================== */

(function (global) {
  "use strict";

  var UI = {};

  /* ---------- DOM ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") {
          node.className = value;
        } else if (key === "text") {
          node.textContent = value;
        } else if (key === "html") {
          /* 仅用于本文件内写死的静态结构，绝不传入用户数据 */
          node.innerHTML = value;
        } else if (key === "dataset") {
          Object.keys(value).forEach(function (name) {
            node.dataset[name] = value[name];
          });
        } else if (key === "style" && typeof value === "object") {
          Object.keys(value).forEach(function (name) {
            if (name.indexOf("--") === 0) {
              node.style.setProperty(name, value[name]);
            } else {
              node.style[name] = value[name];
            }
          });
        } else if (key === "on" && typeof value === "object") {
          Object.keys(value).forEach(function (event) {
            node.addEventListener(event, value[event]);
          });
        } else if (typeof value === "function" && key.indexOf("on") === 0) {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(key, value === true ? "" : value);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (child === null || child === undefined || child === false) return;
        node.append(child && child.nodeType ? child : document.createTextNode(String(child)));
      });
    }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function fmtRate(rate) {
    return (Number(rate) || 0).toFixed(1) + "%";
  }

  /* ---------- 颜色 ---------- */

  var ZONE_COLOR = { A: "#6fe0a0", B: "#7fb6e8", C: "#f0b45a" };

  UI.zoneColor = function (zoneId) {
    return ZONE_COLOR[String(zoneId || "").charAt(0)] || "#6fe0a0";
  };

  /* ---------- 统计 ---------- */

  UI.hydrateStats = function () {
    if (!global.WH || !global.WH.zoneStats) return;
    var stats = WH.zoneStats();
    var values = {
      used: stats.used,
      total: stats.total,
      zones: stats.zones.length,
      categories: WH.CATEGORIES.length,
      empty: stats.empty,
      rate: fmtRate(stats.rate)
    };
    document.querySelectorAll("[data-stat]").forEach(function (node) {
      var key = node.getAttribute("data-stat");
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        node.textContent = values[key];
      }
    });
    var ring = document.getElementById("ring");
    if (ring) ring.style.setProperty("--rate", stats.rate.toFixed(2) + "%");
    var ringRate = document.getElementById("ring-rate");
    if (ringRate) ringRate.textContent = fmtRate(stats.rate);
  };

  UI.setActiveNav = function () {
    var page = document.body && document.body.dataset ? document.body.dataset.page : "";
    if (!page) {
      var file = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
      page = file === "404" ? "" : file || "index";
    }
    document.querySelectorAll(".site-nav a[data-nav]").forEach(function (link) {
      if (link.getAttribute("data-nav") === page) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  /* ---------- 物品索引 ---------- */

  var byCode = null;

  UI.itemByCode = function (code) {
    if (!byCode && global.WH) {
      byCode = {};
      WH.items().forEach(function (item) {
        byCode[item.code] = item;
      });
    }
    return byCode[code] || null;
  };

  UI.neighbors = function (code) {
    var item = UI.itemByCode(code);
    if (!item) return [];
    var zone = WH.zoneById(item.zone);
    var out = [];
    function add(c) {
      var next = UI.itemByCode(c);
      if (next) out.push(next);
    }
    if (item.slot > 1) add(WH.codeFor(item.zone, item.row, item.slot - 1));
    if (item.slot < zone.cols) add(WH.codeFor(item.zone, item.row, item.slot + 1));
    if (item.kind === "aisle") {
      if (item.row > 1) add(WH.codeFor(item.zone, item.row - 1, item.slot));
      if (item.row < zone.rows) add(WH.codeFor(item.zone, item.row + 1, item.slot));
    }
    return out;
  };

  /* ---------- Toast ---------- */

  var toastTimer = 0;

  function ensureToast() {
    var node = document.querySelector(".toast");
    if (!node) {
      node = el("div", { class: "toast", role: "status", "aria-live": "polite" });
      document.body.append(node);
    }
    return node;
  }

  UI.toast = function (message) {
    var node = ensureToast();
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      node.classList.remove("show");
    }, 2400);
  };

  /* ---------- 复制 ---------- */

  UI.copy = function (text, label) {
    var done = function () {
      UI.toast((label || "内容") + "已复制");
    };
    var fallback = function () {
      var area = el("textarea", {
        style: { position: "fixed", top: "-1000px", left: "-1000px", opacity: "0" },
        "aria-hidden": "true"
      });
      area.value = text;
      document.body.append(area);
      area.focus();
      area.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (error) {
        ok = false;
      }
      area.remove();
      if (ok) done();
      else UI.toast("复制失败，请手动选择文本");
    };

    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  };

  /* ---------- 物品详情弹窗 ---------- */

  var dialog = null;
  var lastCode = "";

  function ensureDialog() {
    if (dialog) return dialog;

    dialog = el("dialog", { class: "item-dialog", "aria-labelledby": "dlg-title" });
    var body = el("div", { class: "dialog-body" });

    var closeBtn = el("button", {
      type: "button",
      class: "dialog-close",
      "aria-label": "关闭详情",
      text: "✕"
    });
    closeBtn.addEventListener("click", function () {
      dialog.close();
    });

    var top = el("div", { class: "dialog-top" }, [
      el("div", {}, [
        el("p", { class: "dialog-eyebrow", text: "物品详情" }),
        el("h2", { id: "dlg-title", text: "" })
      ]),
      closeBtn
    ]);

    var meta = el("div", { class: "dialog-meta", id: "dlg-meta" });

    var fields = el("div", { class: "dialog-grid" }, [
      el("div", { class: "dialog-field" }, [
        el("span", { text: "编码" }),
        el("strong", { class: "code", id: "dlg-code", text: "" })
      ]),
      el("div", { class: "dialog-field" }, [
        el("span", { text: "位置" }),
        el("strong", { id: "dlg-loc", text: "" })
      ]),
      el("div", { class: "dialog-field" }, [
        el("span", { text: "区域" }),
        el("strong", { id: "dlg-zone", text: "" })
      ]),
      el("div", { class: "dialog-field" }, [
        el("span", { text: "段位" }),
        el("strong", { id: "dlg-rough", text: "" })
      ]),
      el("div", { class: "dialog-field" }, [
        el("span", { text: "分类" }),
        el("strong", { id: "dlg-cat", text: "" })
      ])
    ]);

    var actions = el("div", { class: "dialog-actions" }, [
      el("button", {
        type: "button",
        class: "btn",
        id: "dlg-copy-code",
        text: "复制编码"
      }),
      el("button", {
        type: "button",
        class: "btn ghost",
        id: "dlg-copy-loc",
        text: "复制位置"
      }),
      el("a", {
        class: "btn ghost",
        id: "dlg-map",
        href: "map.html",
        text: "在地图中查看"
      })
    ]);

    var neighbors = el("div", { class: "neighbors", id: "dlg-neighbors" });

    body.append(top, meta, fields, actions, neighbors);
    dialog.append(body);
    document.body.append(dialog);

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      if (typeof UI.onItemDialogClose === "function") UI.onItemDialogClose(lastCode);
    });

    return dialog;
  }

  function fillMeta(item) {
    var meta = dialog.querySelector("#dlg-meta");
    clear(meta);
    meta.append(
      el("span", { class: "cat-pill" }, [
        el("span", { class: "dot", style: { background: item.categoryColor } }),
        item.category
      ]),
      el("span", { class: "code", text: item.code })
    );
  }

  /* 和地图上的说法一致：第几排（贴走道为第 1 排）+ 哪一组（从大厅那侧数） */
  function roughLocText(code) {
    if (!WH.schematic || !WH.schematic.payloadFor) return "—";
    var p = WH.schematic.payloadFor(code);
    if (!p) p = WH.schematic.payloadForShelf(code);
    if (!p) return "—";
    if (p.zone.vertical) return "第 " + p.slot + " 格（柜区）";
    return "第 " + p.row + " 排 · " + p.range[0] + "–" + p.range[1] + " 组";
  }

  UI.openItem = function (code) {
    if (!global.WH) return false;
    var item = UI.itemByCode(code);
    if (!item) {
      UI.toast("没有找到编码 " + code);
      return false;
    }
    ensureDialog();
    lastCode = item.code;

    dialog.querySelector("#dlg-title").textContent = item.name;
    dialog.querySelector("#dlg-code").textContent = item.code;
    dialog.querySelector("#dlg-loc").textContent = WH.locText(item.code);
    dialog.querySelector("#dlg-zone").textContent = item.zoneName;
    dialog.querySelector("#dlg-rough").textContent = roughLocText(item.code);
    dialog.querySelector("#dlg-cat").textContent = item.category;
    dialog.querySelector("#dlg-map").href =
      "map.html#item=" + encodeURIComponent(item.code);

    fillMeta(item);

    var copyCode = dialog.querySelector("#dlg-copy-code");
    copyCode.onclick = function () {
      UI.copy(item.code, "编码");
    };
    var copyLoc = dialog.querySelector("#dlg-copy-loc");
    copyLoc.onclick = function () {
      UI.copy(WH.locText(item.code), "位置");
    };

    var wrap = dialog.querySelector("#dlg-neighbors");
    clear(wrap);
    var nearby = UI.neighbors(item.code);
    if (nearby.length) {
      var head = el("h3", { text: "相邻格位" });
      var list = el("div", { class: "neighbor-list" });
      nearby.forEach(function (next) {
        var button = el("button", {
          type: "button",
          class: "neighbor",
          title: next.code + " · " + next.name
        }, [
          el("span", { class: "code", text: next.code }),
          el("span", { class: "neighbor-name", text: next.name })
        ]);
        button.addEventListener("click", function () {
          UI.openItem(next.code);
        });
        list.append(button);
      });
      wrap.append(head, list);
    }

    WH.pushRecent(item.code);

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    if (typeof UI.onItemOpen === "function") UI.onItemOpen(item);
    return true;
  };

  /* ---------- 卡片与格子 ---------- */

  UI.itemCard = function (item) {
    var card = el("article", { class: "item-card" });

    var top = el("div", { class: "item-card-top" }, [
      el("span", { class: "code", text: item.code }),
      el("span", { class: "cat-pill" }, [
        el("span", { class: "dot", style: { background: item.categoryColor } }),
        item.category
      ])
    ]);

    var title = el("h3");
    var open = el("button", {
      type: "button",
      class: "item-open",
      text: item.name,
      title: "查看 " + item.name + " 的详情"
    });
    open.addEventListener("click", function () {
      UI.openItem(item.code);
    });
    title.append(open);

    var meta = el("div", { class: "item-meta" }, [
      el("span", { class: "item-loc", text: WH.locText(item.code) })
    ]);

    var copy = el("button", {
      type: "button",
      class: "icon-btn",
      title: "复制编码",
      "aria-label": "复制 " + item.name + " 的编码",
      text: "⧉"
    });
    copy.addEventListener("click", function () {
      UI.copy(item.code, "编码");
    });

    var map = el("a", {
      class: "icon-btn",
      href: "map.html#item=" + encodeURIComponent(item.code),
      title: "在地图中查看",
      "aria-label": "在地图中查看 " + item.name,
      text: "⌖"
    });

    var actions = el("div", { class: "item-actions" }, [copy, map]);

    card.append(top, title, meta, actions);
    return card;
  };

  UI.slot = function (item) {
    var button = el("button", {
      type: "button",
      class: "slot",
      dataset: { code: item.code },
      title: item.code + " · " + item.name + "\n" + WH.locText(item.code),
      style: { "--cat-color": item.categoryColor }
    }, [
      el("span", { class: "slot-no", text: pad2(item.slot) }),
      el("span", { class: "slot-name", text: item.name }),
      el("span", { class: "dot" })
    ]);
    button.addEventListener("click", function () {
      UI.openItem(item.code);
    });
    return button;
  };

  UI.emptySlot = function (label) {
    return el("div", {
      class: "slot empty-slot",
      title: label || "空位",
      "aria-label": label || "空位"
    }, [el("span", { class: "slot-name", text: label || "空位" })]);
  };

  UI.emptyState = function (container, title, message, linkHref, linkText) {
    clear(container);
    container.hidden = false;
    container.append(el("strong", { text: title }), el("p", { text: message }));
    if (linkHref) {
      var link = el("a", { class: "btn ghost", href: linkHref, text: linkText || "查看全部" });
      link.style.marginTop = "14px";
      container.append(link);
    }
  };

  /* ---------- 杂项 ---------- */

  UI.debounce = function (fn, delay) {
    var timer = 0;
    return function () {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

  UI.isTypingTarget = function (event) {
    var tag = event.target && event.target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target && event.target.isContentEditable);
  };

  UI.clearRecent = function () {
    try {
      localStorage.removeItem("wh.recent.v1");
    } catch (error) {
      /* localStorage 不可用时静默失败 */
    }
  };

  UI.el = el;
  UI.clear = clear;
  UI.pad2 = pad2;
  UI.fmtRate = fmtRate;

  /* ---------- 初始化 ---------- */

  function init() {
    UI.setActiveNav();
    UI.hydrateStats();
    ensureToast();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.UI = UI;
})(window);
