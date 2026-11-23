/* 仓库核心逻辑：数据访问、坐标、分类、搜索、URL 状态。
 * 浏览器中挂载到 window.WH；Node 中可直接 require 用于测试。
 * 不依赖任何第三方库，不访问网络。
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WH = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var ZONE_ORDER = ["AL", "AR", "BL", "BR", "CL", "CR"];
  var ZONE_FALLBACK = {
    AL: "A 区 · 左侧",
    AR: "A 区 · 右侧",
    BL: "B 区 · 左侧",
    BR: "B 区 · 右侧",
    CL: "C 区 · 左侧",
    CR: "C 区 · 右侧"
  };
  var RECENT_KEY = "wh.recent.v1";
  var MAX_RECENT = 8;

  var CATEGORIES = [
    {
      id: "deco",
      name: "染色与装饰",
      color: "#f08fb8",
      desc: "羊毛、地毯、混凝土、陶瓦、玻璃、蜡烛、旗帜与告示牌等。"
    },
    {
      id: "wood",
      name: "木材与植物",
      color: "#9ad06a",
      desc: "原木、木板、树叶、树苗、竹子和菌柄等木质材料。"
    },
    {
      id: "mineral",
      name: "矿物与材料",
      color: "#7fb6e8",
      desc: "矿石、锭、宝石、海晶碎片、皮革、火药等合成材料。"
    },
    {
      id: "food",
      name: "食物与农作物",
      color: "#f0b45a",
      desc: "苹果、面包、肉类、鱼类、种子与各种农作物。"
    },
    {
      id: "nature",
      name: "植物与自然",
      color: "#5fd0a0",
      desc: "珊瑚、花、草、蕨、藤蔓、海带与蘑菇等自然方块。"
    },
    {
      id: "redstone",
      name: "红石与功能方块",
      color: "#ff6b6b",
      desc: "红石元件、活塞、漏斗、铁轨，以及工作台、熔炉、箱子等功能方块。"
    },
    {
      id: "building",
      name: "建筑方块",
      color: "#b9a7e8",
      desc: "石头、砖、台阶、楼梯、墙、栅栏和各类建造方块。"
    },
    {
      id: "other",
      name: "其他物品",
      color: "#9aa8b8",
      desc: "暂未归入以上分类的杂项物品。"
    }
  ];

  var CATEGORY_BY_ID = {};
  CATEGORIES.forEach(function (item, index) {
    item.index = index;
    CATEGORY_BY_ID[item.id] = item;
  });

  var RULES = [
    {
      id: "redstone",
      re: /红石(?!矿石|块)|拉杆|中继器|比较器|活塞|侦测器|观察者|发射器|投掷器|漏斗|铁轨|矿车|阳光探测器|标靶|音符盒|铜灯|避雷针|合成器|按钮|压力板|绊线钩|工作台|织布机|锻造台|制箭台|切石机|酿造台|讲台|堆肥桶|蜂箱|熔炉|高炉|烟熏炉|木桶|箱子|铁桶|酿药锅/
    },
    {
      id: "deco",
      re: /羊毛|地毯|染料|染色|混凝土|陶瓦|带釉|玻璃(?!瓶)|蜡烛|旗帜|画$|展示框|花盆|床$|告示牌|头颅|盔甲架|展示架|灯笼|火把|营火|末地烛|未地烛|饰纹陶罐|失水恶魂|南瓜灯|雕刻南瓜|铁链/
    },
    {
      id: "food",
      re: /苹果|胡萝卜|甜菜根|马铃薯|西瓜|南瓜|浆果|牛排|猪排|羊肉|鸡肉|兔肉|鳕鱼|鲑鱼|热带鱼|河豚|面包|曲奇|蛋糕|派$|小麦|种子|可可豆|紫颂果|蜂蜜瓶|鸡蛋|干海带(?!块)|糖$|腐肉/
    },
    {
      id: "wood",
      re: /原木|木头|木板|去皮|树叶|树苗|胎生苗|竹块|竹子|甘蔗|菌柄|蘑菇柄|红树根/
    },
    {
      id: "building",
      re: /台阶|楼梯|栅栏|活板门|门$|墙$|砖|石块|石头$|石砖|圆石|深板岩|花岗岩|闪长岩|安山岩|凝灰岩|方解石|玄武岩|黑石|砂岩|海晶石|紫珀|末地石|下界岩|灵魂沙|灵魂土|泥土|沙$|沙子|沙砾|冰$|浮冰|蓝冰|雪|方块|块$|柱$|瓦|平滑|磨制|切制|雕纹|苔石|泥坯|泥巴|灰化土|菌丝体|菌岩|滴水石|蛙明灯|海晶灯|荧石(?!粉)|干草捆|脚手架|梯子|铁栏杆|遮光玻璃|岩浆块|菌光体|草方块|海带块|海绵/
    },
    {
      id: "nature",
      re: /珊瑚|海泡菜|海草|海带|睡莲|仙人掌|花|蕨|草丛|灌木|蘑菇|菌|藤|垂须|垂滴叶|孢子花|苔藓|地衣|枯叶|萤火虫|紫颂花|下界疣|诡异疣|草$|杜鹃|蒲公英|虞美人|滨菊|矢车菊|铃兰|绒球葱|向日葵|丁香|玫瑰丛|牡丹|瓶子草|幽匿/
    },
    {
      id: "mineral",
      re: /矿石|锭|粒|煤|铁|金|铜|钻石|绿宝石|青金石|石英|紫水晶|紫晶芽|合金|黏土|粘土|燧石|黑曜石|末影|未影|烈焰|岩浆膏|恶魂|犰狳|墨囊|羽毛|皮革|鳞甲|潜影壳|鹦鹉螺|回响|树脂团|蜜脾|海晶|骨粉|骨头|火药|史莱姆|粘液|线$|纸|书|染料|硫黄|朱砂|风弹|旋风棒|龙息|幻翼膜|蛛眼|蜘蛛网|兔子脚|兔子皮|残骸|荧石粉|火焰弹/
    },
    { id: "other", re: /./ }
  ];

  function data() {
    return (root && root.WH_DATA) || {};
  }

  function readInventory() {
    var inv = data().inventory;
    return inv && typeof inv === "object" ? inv : {};
  }

  function readZones() {
    var zones = data().zones;
    if (Array.isArray(zones) && zones.length) return zones;
    return ZONE_ORDER.map(function (id) {
      var shelf = id.charAt(0) === "C";
      return {
        id: id,
        name: ZONE_FALLBACK[id],
        kind: shelf ? "shelf" : "aisle",
        rows: shelf ? 1 : 4,
        cols: shelf ? 9 : 44
      };
    });
  }

  function zoneById(id) {
    var wanted = String(id || "").toUpperCase();
    var zones = readZones();
    for (var i = 0; i < zones.length; i += 1) {
      if (zones[i].id === wanted) return zones[i];
    }
    return null;
  }

  function pad2(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number < 10 ? "0" + number : String(number);
  }

  function codeFor(zoneId, row, slot) {
    var zone = zoneById(zoneId);
    if (!zone) return "";
    var r = zone.kind === "shelf" ? 1 : Number(row);
    var s = Number(slot);
    if (!Number.isInteger(r) || !Number.isInteger(s)) return "";
    if (r < 1 || r > zone.rows || s < 1 || s > zone.cols) return "";
    return zone.kind === "shelf"
      ? zone.id + "-" + pad2(s)
      : zone.id + "-" + r + "-" + pad2(s);
  }

  function parseCode(value) {
    if (typeof value !== "string") return null;
    var code = value.trim().toUpperCase();
    if (!code) return null;
    var parts = code.split("-");
    if (parts.length !== 2 && parts.length !== 3) return null;
    var zone = zoneById(parts[0]);
    if (!zone) return null;
    var row;
    var slot;
    if (zone.kind === "shelf") {
      if (parts.length !== 2) return null;
      row = 1;
      slot = Number(parts[1]);
    } else {
      if (parts.length !== 3) return null;
      row = Number(parts[1]);
      slot = Number(parts[2]);
    }
    if (!Number.isInteger(row) || !Number.isInteger(slot)) return null;
    if (row < 1 || row > zone.rows || slot < 1 || slot > zone.cols) return null;
    return {
      code: code,
      zone: zone.id,
      zoneName: zone.name,
      kind: zone.kind,
      row: row,
      slot: slot
    };
  }

  function locText(value) {
    var parsed = typeof value === "string" ? parseCode(value) : value;
    if (!parsed) return "";
    if (parsed.kind === "shelf") {
      return parsed.zoneName + " · 第 " + parsed.slot + " 格";
    }
    return (
      parsed.zoneName +
      " · 第 " +
      parsed.row +
      " 排 · 第 " +
      parsed.slot +
      " 格"
    );
  }

  function allSlots() {
    var list = [];
    readZones().forEach(function (zone) {
      for (var row = 1; row <= zone.rows; row += 1) {
        if (zone.kind === "shelf") {
          for (var slot = 1; slot <= zone.cols; slot += 1) {
            list.push(codeFor(zone.id, 1, slot));
          }
          break;
        }
        for (var s = 1; s <= zone.cols; s += 1) {
          list.push(codeFor(zone.id, row, s));
        }
      }
    });
    return list;
  }

  function items() {
    var inventory = readInventory();
    var list = [];
    var zones = readZones();
    zones.forEach(function (zone) {
      var maxRow = zone.kind === "shelf" ? 1 : zone.rows;
      for (var row = 1; row <= maxRow; row += 1) {
        for (var slot = 1; slot <= zone.cols; slot += 1) {
          var code = codeFor(zone.id, row, slot);
          if (!code || !Object.prototype.hasOwnProperty.call(inventory, code)) {
            continue;
          }
          var name = String(inventory[code]);
          var category = categoryOf(name);
          list.push({
            code: code,
            name: name,
            zone: zone.id,
            zoneName: zone.name,
            kind: zone.kind,
            row: row,
            slot: slot,
            category: category.name,
            categoryId: category.id,
            categoryColor: category.color
          });
        }
      }
    });
    return list;
  }

  function zoneStats() {
    var inventory = readInventory();
    var zones = readZones().map(function (zone) {
      var total = zone.rows * zone.cols;
      var used = 0;
      for (var row = 1; row <= zone.rows; row += 1) {
        for (var slot = 1; slot <= zone.cols; slot += 1) {
          if (
            Object.prototype.hasOwnProperty.call(
              inventory,
              codeFor(zone.id, row, slot)
            )
          ) {
            used += 1;
          }
        }
      }
      return {
        id: zone.id,
        name: zone.name,
        kind: zone.kind,
        rows: zone.rows,
        cols: zone.cols,
        total: total,
        used: used,
        empty: total - used,
        rate: total ? Math.round((used / total) * 1000) / 10 : 0
      };
    });
    var total = 0;
    var used = 0;
    zones.forEach(function (zone) {
      total += zone.total;
      used += zone.used;
    });
    return {
      zones: zones,
      total: total,
      used: used,
      empty: total - used,
      rate: total ? Math.round((used / total) * 1000) / 10 : 0
    };
  }

  var TOOL_RE = /(剑|镐|斧|锹|锄|弓|箭|盾|头盔|胸甲|护腿|靴)$/;

  function categoryOf(name) {
    var text = String(name || "");
    if (TOOL_RE.test(text)) return CATEGORY_BY_ID.other;
    for (var i = 0; i < RULES.length; i += 1) {
      if (RULES[i].re.test(text)) return CATEGORY_BY_ID[RULES[i].id];
    }
    return CATEGORY_BY_ID.other;
  }

  function classify(name) {
    return categoryOf(name).name;
  }

  function categoryStats() {
    var counts = {};
    CATEGORIES.forEach(function (category) {
      counts[category.id] = 0;
    });
    var list = items();
    list.forEach(function (item) {
      counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
    });
    return CATEGORIES.map(function (category) {
      var count = counts[category.id] || 0;
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        desc: category.desc,
        count: count,
        rate: list.length ? Math.round((count / list.length) * 1000) / 10 : 0
      };
    });
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .trim();
  }

  function tokenize(query) {
    var seen = {};
    var tokens = [];
    normalize(query)
      .split(/\s+/)
      .forEach(function (token) {
        if (!token || seen[token]) return;
        seen[token] = true;
        tokens.push(token);
      });
    return tokens;
  }

  function highlight(text, tokens) {
    var value = String(text == null ? "" : text);
    if (!tokens.length) return [{ text: value, hit: false }];
    var lower = value.toLowerCase();
    var ranges = [];
    tokens.forEach(function (token) {
      if (!token) return;
      var from = 0;
      var index = lower.indexOf(token, from);
      while (index !== -1) {
        ranges.push([index, index + token.length]);
        from = index + token.length;
        if (ranges.length > 60) break;
        index = lower.indexOf(token, from);
      }
    });
    if (!ranges.length) return [{ text: value, hit: false }];
    ranges.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1];
    });
    var merged = [ranges[0]];
    for (var i = 1; i < ranges.length; i += 1) {
      var last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) {
        last[1] = Math.max(last[1], ranges[i][1]);
      } else {
        merged.push(ranges[i].slice());
      }
    }
    var segments = [];
    var cursor = 0;
    merged.forEach(function (range) {
      if (range[0] > cursor) {
        segments.push({ text: value.slice(cursor, range[0]), hit: false });
      }
      segments.push({ text: value.slice(range[0], range[1]), hit: true });
      cursor = range[1];
    });
    if (cursor < value.length) {
      segments.push({ text: value.slice(cursor), hit: false });
    }
    return segments;
  }

  function scoreItem(item, tokens, raw) {
    if (!tokens.length) return 0;
    var name = item.name.toLowerCase();
    var code = item.code.toLowerCase();
    var zone = item.zoneName.toLowerCase();
    var category = item.category.toLowerCase();
    var query = normalize(raw);
    var score = 0;
    if (name === query) score += 1000;
    else if (name.indexOf(query) === 0) score += 700;
    else if (name.indexOf(query) !== -1) score += 500;
    if (code === query) score += 900;
    else if (code.indexOf(query) === 0) score += 450;
    tokens.forEach(function (token) {
      if (name.indexOf(token) === 0) score += 60;
      else if (name.indexOf(token) !== -1) score += 40;
      if (code.indexOf(token) !== -1) score += 25;
      if (zone.indexOf(token) !== -1) score += 8;
      if (category.indexOf(token) !== -1) score += 8;
    });
    return score;
  }

  function categoryIndex(id) {
    var category = CATEGORY_BY_ID[id];
    return category ? category.index : 99;
  }

  function sortItems(list, sort) {
    var mode = sort || "name";
    return list.sort(function (a, b) {
      if (mode === "relevance") {
        if (b.score !== a.score) return b.score - a.score;
      }
      if (mode === "code") {
        var zoneDiff =
          ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone);
        if (zoneDiff) return zoneDiff;
        if (a.row !== b.row) return a.row - b.row;
        return a.slot - b.slot;
      }
      if (mode === "zone") {
        var zoneDiff2 =
          ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone);
        if (zoneDiff2) return zoneDiff2;
        if (a.row !== b.row) return a.row - b.row;
        if (a.slot !== b.slot) return a.slot - b.slot;
      }
      if (mode === "category") {
        var catDiff = categoryIndex(a.categoryId) - categoryIndex(b.categoryId);
        if (catDiff) return catDiff;
      }
      return a.name.localeCompare(b.name, "zh-Hans-CN") || a.code.localeCompare(b.code);
    });
  }

  function search(query, options) {
    var opts = options || {};
    var tokens = tokenize(query);
    var zoneFilter = String(opts.zone || "");
    var catFilter = String(opts.cat || "");
    var result = [];
    items().forEach(function (item) {
      if (zoneFilter && item.zone !== zoneFilter) return;
      if (catFilter && item.categoryId !== catFilter) return;
      var haystack = (
        item.name +
        " " +
        item.code +
        " " +
        item.zoneName +
        " " +
        item.category
      ).toLowerCase();
      var matched = tokens.every(function (token) {
        return haystack.indexOf(token) !== -1;
      });
      if (!matched) return;
      var enriched = {};
      Object.keys(item).forEach(function (key) {
        enriched[key] = item[key];
      });
      enriched.score = scoreItem(item, tokens, query);
      enriched.segments = highlight(item.name, tokens);
      result.push(enriched);
    });
    sortItems(result, opts.sort || (tokens.length ? "relevance" : "name"));
    var total = result.length;
    var offset = Math.max(0, Number(opts.offset) || 0);
    var limit =
      opts.limit === undefined ? total : Math.max(0, Number(opts.limit) || 0);
    return { total: total, items: result.slice(offset, offset + limit) };
  }

  function defaultState() {
    return {
      q: "",
      zone: "",
      cat: "",
      sort: "name",
      page: 1,
      item: ""
    };
  }

  function parseHash(hash) {
    var state = defaultState();
    var raw = String(hash == null ? "" : hash).replace(/^#/, "");
    if (!raw) return state;
    var params;
    try {
      params = new URLSearchParams(raw);
    } catch (error) {
      return state;
    }
    state.q = params.get("q") || "";
    var zone = (params.get("zone") || "").toUpperCase();
    if (zone && zoneById(zone)) {
      state.zone = zone;
    }
    var cat = params.get("cat") || "";
    if (CATEGORY_BY_ID[cat]) state.cat = cat;
    else {
      for (var i = 0; i < CATEGORIES.length; i += 1) {
        if (CATEGORIES[i].name === cat) {
          state.cat = CATEGORIES[i].id;
          break;
        }
      }
    }
    var sort = params.get("sort") || "";
    if (["name", "code", "zone", "category", "relevance"].indexOf(sort) !== -1) {
      state.sort = sort;
    }
    var page = parseInt(params.get("page") || "1", 10);
    if (Number.isFinite(page) && page > 0) state.page = page;
    var item = params.get("item") || "";
    if (parseCode(item)) state.item = parseCode(item).code;
    return state;
  }

  function buildHash(input) {
    var state = defaultState();
    if (input && typeof input === "object") {
      Object.keys(state).forEach(function (key) {
        if (input[key] !== undefined && input[key] !== null) {
          state[key] = input[key];
        }
      });
    }
    var parts = [];
    if (state.q) parts.push("q=" + encodeURIComponent(state.q));
    if (state.zone && zoneById(state.zone)) {
      parts.push("zone=" + encodeURIComponent(state.zone));
    }
    if (state.cat && CATEGORY_BY_ID[state.cat]) {
      parts.push("cat=" + encodeURIComponent(state.cat));
    }
    if (state.sort && state.sort !== "name") {
      parts.push("sort=" + encodeURIComponent(state.sort));
    }
    if (Number(state.page) > 1) {
      parts.push("page=" + Number(state.page));
    }
    var parsed = parseCode(state.item);
    if (parsed) parts.push("item=" + encodeURIComponent(parsed.code));
    return parts.length ? "#" + parts.join("&") : "#";
  }

  function storage() {
    try {
      return root && root.localStorage ? root.localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function getRecent() {
    var store = storage();
    if (!store) return [];
    try {
      var raw = store.getItem(RECENT_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list
        .map(function (code) {
          return parseCode(code);
        })
        .filter(Boolean)
        .slice(0, MAX_RECENT)
        .map(function (parsed) {
          return parsed.code;
        });
    } catch (error) {
      return [];
    }
  }

  function pushRecent(code) {
    var parsed = parseCode(code);
    if (!parsed || !Object.prototype.hasOwnProperty.call(readInventory(), parsed.code)) {
      return getRecent();
    }
    var list = getRecent().filter(function (item) {
      return item !== parsed.code;
    });
    list.unshift(parsed.code);
    list = list.slice(0, MAX_RECENT);
    var store = storage();
    if (store) {
      try {
        store.setItem(RECENT_KEY, JSON.stringify(list));
      } catch (error) {
        /* 隐私模式下忽略写入失败 */
      }
    }
    return list;
  }

  return {
    ZONE_ORDER: ZONE_ORDER,
    CATEGORIES: CATEGORIES,
    CATEGORY_BY_ID: CATEGORY_BY_ID,
    zoneById: zoneById,
    codeFor: codeFor,
    parseCode: parseCode,
    locText: locText,
    allSlots: allSlots,
    items: items,
    zoneStats: zoneStats,
    categoryStats: categoryStats,
    categoryOf: categoryOf,
    classify: classify,
    search: search,
    highlight: highlight,
    parseHash: parseHash,
    buildHash: buildHash,
    getRecent: getRecent,
    pushRecent: pushRecent,
    defaultState: defaultState
  };
});
