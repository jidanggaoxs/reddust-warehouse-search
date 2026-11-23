#!/usr/bin/env python3
"""从原始的 minecraft_warehouse_search.html 提取仓库数据，校验并生成站点数据文件。

用法:
    python tools/build_data.py --source <原始 HTML 路径> [--out <站点根目录>]

生成:
    assets/data.js          供站点与 Node 测试使用的 window.WH_DATA
    data/inventory.csv      完整清单（UTF-8 BOM，Excel 可直接打开）

校验失败时会打印所有问题并以非零码退出，不会写入半成品。
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ZONE_ORDER = ["AL", "AR", "BL", "BR", "CL", "CR"]
ZONE_CAPACITY = {
    "AL": (4, 44),
    "AR": (4, 44),
    "BL": (4, 44),
    "BR": (4, 44),
    "CL": (1, 9),
    "CR": (1, 9),
}
AISLE_ZONES = {"AL", "AR", "BL", "BR"}
SHELF_ZONES = {"CL", "CR"}

AISLE_CODE = re.compile(r"^(AL|AR|BL|BR)-([1-4])-(0[1-9]|[1-3][0-9]|4[0-4])$")
SHELF_CODE = re.compile(r"^(CL|CR)-(0[1-9])$")

DATA_RE = re.compile(
    r"const\s+inventory=(\{.*?\}),names=(\{.*?\}),zones=\[(.*?)\];",
    re.S,
)
# 源文件的 names 是 JS 对象字面量（键没有引号），例如 {AL:"A 区 · 左侧",...}。
UNQUOTED_KEY_RE = re.compile(r"([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:")


class DataError(Exception):
    pass


def _no_duplicate_keys(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise DataError(f"JSON 对象中出现重复键: {key!r}")
        obj[key] = value
    return obj


def load_json(text: str, label: str):
    try:
        return json.loads(text, object_pairs_hook=_no_duplicate_keys)
    except DataError:
        raise
    except json.JSONDecodeError as exc:
        raise DataError(f"{label} 不是合法 JSON: {exc}") from exc


def extract(source: Path):
    try:
        html = source.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise DataError(f"找不到源文件: {source}")
    except UnicodeDecodeError as exc:
        raise DataError(f"源文件不是 UTF-8 编码: {exc}") from exc

    match = DATA_RE.search(html)
    if not match:
        raise DataError(
            "无法在源文件中定位 `const inventory={...},names={...},zones=[...];`，"
            "请确认传入的是原始的 minecraft_warehouse_search.html。"
        )

    inventory = load_json(match.group(1), "inventory")
    names_text = UNQUOTED_KEY_RE.sub(r'\1"\2":', match.group(2))
    names = load_json(names_text, "names")
    zones = load_json("[" + match.group(3) + "]", "zones")

    if not isinstance(inventory, dict) or not isinstance(names, dict):
        raise DataError("inventory / names 必须是 JSON 对象。")
    if not isinstance(zones, list) or not all(isinstance(z, str) for z in zones):
        raise DataError("zones 必须是字符串数组。")
    return inventory, names, zones


def validate(inventory, names, zones):
    errors: list[str] = []
    warnings: list[str] = []

    zone_set = set(zones)
    if len(zone_set) != len(zones):
        errors.append(f"zones 中有重复区域: {zones}")
    if zone_set != set(ZONE_ORDER):
        errors.append(
            f"区域必须是 {ZONE_ORDER}，实际为 {zones}"
        )
    for zone in ZONE_ORDER:
        if zone not in names:
            errors.append(f"names 缺少区域名: {zone}")
        elif not str(names[zone]).strip():
            errors.append(f"names 中 {zone} 的区域名为空。")
        if zone not in zone_set:
            continue

    total_slots = sum(rows * cols for rows, cols in ZONE_CAPACITY.values())
    expected_codes = set()
    for zone, (rows, cols) in ZONE_CAPACITY.items():
        for row in range(1, rows + 1):
            for slot in range(1, cols + 1):
                if zone in AISLE_ZONES:
                    expected_codes.add(f"{zone}-{row}-{slot:02d}")
                else:
                    expected_codes.add(f"{zone}-{slot:02d}")

    seen_names: dict[str, str] = {}
    codes_by_zone = {zone: 0 for zone in ZONE_ORDER}

    for raw_code, raw_name in inventory.items():
        code = str(raw_code).strip()
        name = str(raw_name).strip() if raw_name is not None else ""
        if not name:
            errors.append(f"{code}: 物品名称为空。")
            continue
        if name != str(raw_name):
            warnings.append(f"{code}: 名称首尾有空白，已去除（{raw_name!r}）。")
        if name == "空位":
            errors.append(f"{code}: 名称不能是占位符「空位」，空位应在数据中直接缺失。")

        if code in AISLE_ZONES or code.startswith(("AL-", "AR-", "BL-", "BR-")):
            m = AISLE_CODE.match(code)
            if not m:
                errors.append(f"{code}: 编码不符合 AL/AR/BL/BR 的 `区-排-格` 格式或超出 1-4 排 / 01-44 格。")
                continue
            zone = m.group(1)
            if zone not in AISLE_ZONES:
                errors.append(f"{code}: 未知区域 {zone}。")
                continue
            row, slot = int(m.group(2)), int(m.group(3))
            rows, cols = ZONE_CAPACITY[zone]
            if not (1 <= row <= rows and 1 <= slot <= cols):
                errors.append(f"{code}: 超出 {zone} 的 {rows} 排 × {cols} 格容量。")
                continue
        elif code.startswith(("CL-", "CR-")):
            m = SHELF_CODE.match(code)
            if not m:
                errors.append(f"{code}: 编码不符合 CL/CR 的 `区-格` 格式或超出 01-09 格。")
                continue
            zone = m.group(1)
            slot = int(m.group(2))
            rows, cols = ZONE_CAPACITY[zone]
            if not (1 <= slot <= cols):
                errors.append(f"{code}: 超出 {zone} 的 {cols} 格容量。")
                continue
        else:
            errors.append(f"{code}: 未知的区域前缀。")
            continue

        codes_by_zone[zone] += 1
        if code not in expected_codes:
            errors.append(f"{code}: 不在预期格位集合中。")
        if name in seen_names:
            errors.append(
                f"物品名称重复: 「{name}」同时出现在 {seen_names[name]} 和 {code}。"
            )
        else:
            seen_names[name] = code

    filled = sum(codes_by_zone.values())
    missing = sorted(expected_codes - set(inventory))
    unknown = sorted(set(inventory) - expected_codes)
    if unknown:
        errors.append(f"存在 {len(unknown)} 个不该出现的格位: {unknown[:10]}")
    if filled + len(missing) != total_slots:
        errors.append(
            f"数量不守恒: {filled} 已用 + {len(missing)} 空位 != {total_slots} 总容量。"
        )

    report = {
        "zones": len(zones),
        "filled": filled,
        "total_slots": total_slots,
        "empty": missing,
        "per_zone": codes_by_zone,
        "categories": len({name for name in inventory.values()}),
    }
    return report, errors, warnings


def build_payload(inventory, names, zones, source: Path):
    zone_entries = []
    for zone in ZONE_ORDER:
        rows, cols = ZONE_CAPACITY[zone]
        zone_entries.append(
            {
                "id": zone,
                "name": str(names[zone]),
                "kind": "aisle" if zone in AISLE_ZONES else "shelf",
                "rows": rows,
                "cols": cols,
            }
        )

    ordered = {}
    for zone in ZONE_ORDER:
        rows, cols = ZONE_CAPACITY[zone]
        for row in range(1, rows + 1):
            for slot in range(1, cols + 1):
                code = (
                    f"{zone}-{row}-{slot:02d}"
                    if zone in AISLE_ZONES
                    else f"{zone}-{slot:02d}"
                )
                if code in inventory:
                    ordered[code] = str(inventory[code]).strip()

    return {
        "source": source.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "zones": zone_entries,
        "inventory": ordered,
    }


def write_outputs(payload, out_dir: Path):
    assets = out_dir / "assets"
    data_dir = out_dir / "data"
    assets.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    data_js = assets / "data.js"
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    data_js.write_text(
        "/* 本文件由 tools/build_data.py 生成，请勿手动修改。 */\n"
        f"window.WH_DATA = {body};\n",
        encoding="utf-8",
    )

    csv_path = data_dir / "inventory.csv"
    zone_meta = {z["id"]: z for z in payload["zones"]}
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["code", "zone", "zone_name", "row", "slot", "item"])
        for code, item in payload["inventory"].items():
            parts = code.split("-")
            zone = parts[0]
            row = int(parts[1]) if len(parts) == 3 else 1
            slot = int(parts[2]) if len(parts) == 3 else int(parts[1])
            writer.writerow(
                [code, zone, zone_meta[zone]["name"], row, slot, item]
            )
    return data_js, csv_path


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="原始 HTML 文件路径")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent),
        help="站点根目录（默认是本脚本所在目录的上一级）",
    )
    args = parser.parse_args(argv)

    source = Path(args.source).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()

    try:
        inventory, names, zones = extract(source)
        report, errors, warnings = validate(inventory, names, zones)
        if errors:
            print(f"数据校验失败，共 {len(errors)} 个问题：", file=sys.stderr)
            for item in errors:
                print(f"  ✗ {item}", file=sys.stderr)
            return 1
        for item in warnings:
            print(f"  ! {item}", file=sys.stderr)
        payload = build_payload(inventory, names, zones, source)
        data_js, csv_path = write_outputs(payload, out_dir)
    except DataError as exc:
        print(f"数据校验失败: {exc}", file=sys.stderr)
        return 1

    print("数据校验通过。")
    print(f"  物品: {report['filled']} / 总格位: {report['total_slots']} / 区域: {report['zones']}")
    for zone in ZONE_ORDER:
        rows, cols = ZONE_CAPACITY[zone]
        used = report["per_zone"][zone]
        print(f"  {zone}: {used}/{rows * cols}")
    empty = report["empty"]
    print(f"  空位: {', '.join(empty) if empty else '无'}")
    print(f"  已写入: {data_js}")
    print(f"  已写入: {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
