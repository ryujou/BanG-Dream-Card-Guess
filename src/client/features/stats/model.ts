export interface Metric {
  code: string;
  name: string;
  count: number;
}
export interface Stats {
  configured: boolean;
  pageviews: number;
  visitors: number;
  countries: Metric[];
  regions: Metric[];
}
const provinces: Record<string, string> = {
  BJ: "北京",
  TJ: "天津",
  HE: "河北",
  SX: "山西",
  NM: "内蒙古",
  LN: "辽宁",
  JL: "吉林",
  HL: "黑龙江",
  SH: "上海",
  JS: "江苏",
  ZJ: "浙江",
  AH: "安徽",
  FJ: "福建",
  JX: "江西",
  SD: "山东",
  HA: "河南",
  HB: "湖北",
  HN: "湖南",
  GD: "广东",
  GX: "广西",
  HI: "海南",
  CQ: "重庆",
  SC: "四川",
  GZ: "贵州",
  YN: "云南",
  XZ: "西藏",
  SN: "陕西",
  GS: "甘肃",
  QH: "青海",
  NX: "宁夏",
  XJ: "新疆",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
};
export function regionName(row: Metric) {
  if (row.name && row.name !== row.code) return row.name;
  const [country, region] = row.code.toUpperCase().split("-");
  if (country === "CN" && provinces[region]) return provinces[region];
  return region
    ? `${countryName({ code: country, name: country, count: 0 })} · ${region}`
    : row.name || row.code;
}

export function countryName(row: Metric) {
  if (row.name && row.name !== row.code) return row.name;
  try {
    return (
      new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(
        row.code.toUpperCase(),
      ) ||
      row.name ||
      row.code
    );
  } catch {
    return row.name || row.code;
  }
}

