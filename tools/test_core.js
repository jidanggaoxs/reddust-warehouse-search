/* 核心逻辑测试：node tools/test_core.js */
"use strict";

const assert = require("node:assert/strict");

global.window = {};
require("../assets/data.js");
global.WH_DATA = global.window.WH_DATA;
const WH = require("../assets/core.js");

let checks = 0;
function ok(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}
function eq(actual, expected, message) {
  checks += 1;
  assert.deepEqual(actual, expected, message);
}

// ---------- 数据完整性 ----------
const inv = global.WH_DATA.inventory;
const entries = Object.entries(inv);
eq(entries.length, 721, "物品数量应为 721");
eq(new Set(entries.map(([, name]) => name)).size, 721, "物品名称应唯一");
eq(global.WH_DATA.zones.length, 6, "区域数量应为 6");

const stats = WH.zoneStats();
eq(stats.total, 722, "总格位应为 722");
eq(stats.used, 721, "已用格位应为 721");
eq(stats.empty, 1, "空位应为 1");
eq(stats.zones.map((z) => z.id), ["AL", "AR", "BL", "BR", "CL", "CR"], "区域顺序");
eq(stats.zones.find((z) => z.id === "AL").total, 176, "AL 容量");
eq(stats.zones.find((z) => z.id === "CL").total, 9, "CL 容量");
eq(stats.zones.find((z) => z.id === "BR").used, 175, "BR 已用");
eq(stats.zones.find((z) => z.id === "BR").empty, 1, "BR 空位");

const slots = WH.allSlots();
eq(slots.length, 722, "allSlots 数量");
eq(new Set(slots).size, 722, "allSlots 唯一");
ok(!Object.prototype.hasOwnProperty.call(inv, "BR-4-44"), "BR-4-44 应为空位");
eq(stats.zones.find((z) => z.id === "AL").name, "A 区 · 左侧", "区域名");

// ---------- 坐标 ----------
eq(WH.codeFor("AL", 2, 13), "AL-2-13", "codeFor 货架");
eq(WH.codeFor("CL", 1, 7), "CL-07", "codeFor 柜子");
eq(WH.codeFor("AL", 5, 1), "", "codeFor 越界排");
eq(WH.codeFor("AL", 1, 45), "", "codeFor 越界格");
eq(WH.codeFor("ZZ", 1, 1), "", "codeFor 未知区域");

const parsed = WH.parseCode("al-2-13");
eq(parsed.code, "AL-2-13", "parseCode 归一化");
eq(parsed.row, 2, "parseCode 排");
eq(parsed.slot, 13, "parseCode 格");
eq(parsed.kind, "aisle", "parseCode 类型");
eq(WH.parseCode("CL-07").kind, "shelf", "柜子类型");
eq(WH.parseCode("CL-07").slot, 7, "柜子格");
eq(WH.parseCode("AL-2-45"), null, "越界编码");
eq(WH.parseCode("AL-0-01"), null, "0 排");
eq(WH.parseCode("XX-1-01"), null, "未知区域编码");
eq(WH.parseCode("AL-2"), null, "缺少格");
eq(WH.parseCode("CL-1-07"), null, "柜子多段编码");

eq(WH.locText("AL-2-13"), "A 区 · 左侧 · 第 2 排 · 第 13 格", "货架位置文本");
eq(WH.locText("CL-07"), "C 区 · 左侧 · 第 7 格", "柜子位置文本");
eq(WH.locText("bad"), "", "非法位置文本");

// ---------- 分类 ----------
eq(WH.classify("羊毛"), "染色与装饰", "羊毛分类");
eq(WH.classify("钻石"), "矿物与材料", "钻石分类");
eq(WH.classify("橡木楼梯"), "建筑方块", "楼梯分类");
eq(WH.classify("苹果"), "食物与农作物", "苹果分类");
eq(WH.classify("红珊瑚"), "植物与自然", "珊瑚分类");
eq(WH.classify("红石火把"), "红石与功能方块", "红石火把分类");
eq(WH.classify("钻石剑"), "其他物品", "工具分类");
const catStats = WH.categoryStats();
eq(catStats.length, 8, "分类数量");
eq(catStats.reduce((sum, c) => sum + c.count, 0), 721, "分类计数总和");
ok(catStats.every((c) => c.count > 0), "每个分类均非空");

// ---------- 搜索 ----------
const diamonds = WH.search("钻石");
ok(diamonds.total > 0, "钻石有结果");
ok(diamonds.items.some((item) => item.code === "BL-3-08"), "钻石包含 BL-3-08");

const exact = WH.search("BL-3-08");
eq(exact.items[0].code, "BL-3-08", "编码精确命中排第一");

const codeQuery = WH.search("AL-2-13");
ok(codeQuery.items.some((item) => item.code === "AL-2-13"), "编码查询");

const multi = WH.search("钻石 矿物");
ok(multi.total > 0 && multi.items.every((item) => item.category === "矿物与材料"), "多词 AND");
eq(WH.search("钻石 羊毛").total, 0, "无交集多词");

const filtered = WH.search("", { zone: "CL", limit: 100 });
eq(filtered.total, 9, "CL 区筛选");
const foodCount = WH.categoryStats().find((category) => category.id === "food").count;
eq(WH.search("", { cat: "food" }).total, foodCount, "分类筛选");

const page = WH.search("", { limit: 10, offset: 10 });
eq(page.items.length, 10, "分页长度");

const highlight = WH.highlight("钻石块", ["钻石"]);
eq(highlight.map((part) => part.text).join(""), "钻石块", "高亮拼接");
ok(highlight.some((part) => part.hit && part.text === "钻石"), "高亮命中");

// ---------- URL 状态 ----------
const state = { q: "钻石", zone: "BL", cat: "mineral", sort: "code", page: 3, item: "BL-3-08" };
const hash = WH.buildHash(state);
const roundtrip = WH.parseHash(hash);
eq(roundtrip.q, "钻石", "hash q");
eq(roundtrip.zone, "BL", "hash zone");
eq(roundtrip.cat, "mineral", "hash cat");
eq(roundtrip.sort, "code", "hash sort");
eq(roundtrip.page, 3, "hash page");
eq(roundtrip.item, "BL-3-08", "hash item");

const bad = WH.parseHash("#zone=ZZ&cat=nope&sort=hack&page=0&item=AL-2-45");
eq(bad.zone, "", "非法 zone 忽略");
eq(bad.cat, "", "非法 cat 忽略");
eq(bad.sort, "name", "非法 sort 忽略");
eq(bad.page, 1, "非法 page 忽略");
eq(bad.item, "", "非法 item 忽略");

// ---------- 平面图：分组 / 排 / 位置说法 ----------
global.window = global; // schematic.js 挂在 window 上，Node 里让两者同一对象
require("../assets/schematic.js");
const SCH = global.WH.schematic;

eq(SCH.zones.length, 6, "平面图区域数应为 6");
eq(SCH.groupRange(0, 44), [1, 11], "第 1 组 01–11");
eq(SCH.groupRange(1, 44), [12, 22], "第 2 组 12–22");
eq(SCH.groupRange(2, 44), [23, 33], "第 3 组 23–33");
eq(SCH.groupRange(3, 44), [34, 44], "第 4 组 34–44");

eq(SCH.groupOf(1), 0, "第 1 格属第 1 组");
eq(SCH.groupOf(11), 0, "第 11 格属第 1 组");
eq(SCH.groupOf(12), 1, "第 12 格属第 2 组");
eq(SCH.groupOf(44), 3, "第 44 格属第 4 组");

const pBL = SCH.payloadFor("BL-3-08");
eq(pBL.row, 3, "BL-3-08 排号");
eq(pBL.slot, 8, "BL-3-08 格号");
eq(pBL.range, [1, 11], "BL-3-08 组区间");
eq(SCH.posText(pBL), "BL · 第 3 排 · 第 8 格（1–11 组）", "BL-3-08 位置说法");

eq(SCH.payloadFor("BR-3-16").range, [12, 22], "BR-3-16 在第 2 组");
const pAL = SCH.payloadFor("AL-4-44");
eq(pAL.row, 4, "AL-4-44 排号");
eq(pAL.range, [34, 44], "AL-4-44 在第 4 组");

eq(SCH.payloadFor("AL-2-45"), null, "越界格返回 null");
eq(SCH.payloadFor("AL-5-01"), null, "越界排返回 null");
eq(SCH.payloadFor("ZZ-1-01"), null, "未知区域返回 null");

const pC = SCH.payloadForShelf("CL-07");
eq(pC.slot, 7, "柜区第 7 格");
eq(SCH.posText(pC), "CL · 第 7 格", "柜区位置说法");
eq(SCH.payloadFor("CL-99"), null, "柜区越界格返回 null");

// ---------- 最近查看 ----------
const memory = {};
global.localStorage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  },
  setItem(key, value) {
    memory[key] = String(value);
  }
};
WH.pushRecent("AL-2-13");
WH.pushRecent("CL-07");
WH.pushRecent("AL-2-13");
eq(WH.getRecent().slice(0, 2), ["AL-2-13", "CL-07"], "最近查看去重并前置");
for (const code of ["AL-1-01", "AL-1-02", "AL-1-03", "AL-1-04", "AL-1-05", "AL-1-06"]) {
  WH.pushRecent(code);
}
ok(WH.getRecent().length <= 8, "最近查看最多 8 条");
WH.pushRecent("XX-1-01");
ok(!WH.getRecent().includes("XX-1-01"), "非法编码不进入最近查看");
delete global.localStorage;

console.log(`全部通过：${checks} 项断言，721 件物品，722 个格位。`);
