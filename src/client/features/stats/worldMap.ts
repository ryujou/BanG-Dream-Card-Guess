import { countryName, type Metric } from "./model";

export function colorMap(source: string, countries: Metric[]) {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = document.querySelector("svg");
  if (!svg) throw new Error("地图资源无法解析。");
  const counts = new Map(
    countries.map((country) => [country.code.toLowerCase(), country]),
  );
  const highest = Math.max(1, ...countries.map((country) => country.count));
  svg.querySelectorAll("path[id]").forEach((path) => {
    const hit = counts.get((path.getAttribute("id") || "").toLowerCase());
    path.setAttribute(
      "fill",
      hit
        ? `hsl(341 89% ${92 - Math.round((hit.count / highest) * 32)}%)`
        : "#e9edf3",
    );
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "0.5");
    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "title",
    );
    title.textContent = hit
      ? `${countryName(hit)} · ${hit.count.toLocaleString("zh-CN")}`
      : path.getAttribute("name") || path.id;
    path.appendChild(title);
  });
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "访问来源国家分布图");
  return new XMLSerializer().serializeToString(svg);
}

