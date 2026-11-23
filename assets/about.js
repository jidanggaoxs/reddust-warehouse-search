(function () {
  "use strict";

  if (!window.WH || !window.WH_DATA) return;
  var WH = window.WH;
  var UI = window.UI;
  var doc = document;

  function make(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function statCard(value, unit, label) {
    var card = make("div", "info-card");
    var strong = make("strong", "", String(value));
    if (unit) {
      var small = make("small", "", " " + unit);
      small.style.fontSize = "0.72rem";
      small.style.color = "var(--muted)";
      strong.appendChild(small);
    }
    card.appendChild(strong);
    card.appendChild(make("span", "", label));
    return card;
  }

  var stats = WH.zoneStats();
  var statHost = doc.getElementById("about-stats");
  if (statHost) {
    var rate = UI && UI.fmtRate ? UI.fmtRate(stats.rate) : stats.rate + "%";
    [
      [stats.used, "件", "物品"],
      [stats.total, "个", "格位"],
      [rate, "", "占用率"],
      [stats.empty, "个", "空位"],
      [stats.zones.length, "个", "区域"],
      [WH.categoryStats().length, "类", "分类"]
    ].forEach(function (row) {
      statHost.appendChild(statCard(row[0], row[1], row[2]));
    });
  }

  var generated = doc.getElementById("generated-at");
  if (generated && window.WH_DATA && window.WH_DATA.generatedAt) {
    var date = new Date(window.WH_DATA.generatedAt);
    if (!isNaN(date.getTime())) {
      generated.textContent = "数据快照生成于 " + date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }

  var zoneRows = doc.getElementById("zone-rows");
  if (zoneRows) {
    stats.zones.forEach(function (zone) {
      var tr = doc.createElement("tr");
      var name = doc.createElement("td");
      name.textContent = zone.name;
      var kind = doc.createElement("td");
      kind.textContent = zone.kind === "aisle" ? "货架 · " + zone.rows + " 排 × " + zone.cols + " 格" : "柜子 · 单排 " + zone.cols + " 格";
      var capacity = doc.createElement("td");
      capacity.textContent = zone.used + " / " + zone.total;
      var rateCell = doc.createElement("td");
      rateCell.textContent = (UI && UI.fmtRate ? UI.fmtRate(zone.rate) : zone.rate + "%");
      tr.appendChild(name);
      tr.appendChild(kind);
      tr.appendChild(capacity);
      tr.appendChild(rateCell);
      zoneRows.appendChild(tr);
    });
  }

  var catRows = doc.getElementById("cat-rows");
  if (catRows) {
    WH.categoryStats().forEach(function (category) {
      var tr = doc.createElement("tr");

      var name = doc.createElement("td");
      var dot = make("span", "dot");
      dot.style.setProperty("--cat-color", category.color);
      name.appendChild(dot);
      name.appendChild(doc.createTextNode(category.name));

      var desc = doc.createElement("td");
      desc.textContent = category.desc;

      var count = doc.createElement("td");
      count.textContent = category.count + " 件";

      tr.appendChild(name);
      tr.appendChild(desc);
      tr.appendChild(count);
      catRows.appendChild(tr);
    });
  }
})();
