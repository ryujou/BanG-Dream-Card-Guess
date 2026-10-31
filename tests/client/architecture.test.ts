import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const root = resolve("src/client");
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
const files = sources(root);
const short = (path: string) => relative(root, path).replaceAll("\\", "/");
const graph = new Map<string, string[]>();
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
      const base = resolve(dirname(file), specifier.text);
      const target = [base + ".ts", base + ".tsx"].find(existsSync);
      if (target?.startsWith(root)) imports.push(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  graph.set(file, imports);
}

test("shared code does not depend on route pages or business features; features do not depend on route pages", () => {
  const violations: string[] = [];
  for (const [source, imports] of graph) {
    const from = short(source);
    for (const target of imports) {
      const to = short(target);
      if ((/^(lib|components|motion)\//.test(from) && /^(pages|features)\//.test(to)) ||
          (from.startsWith("features/") && to.startsWith("pages/"))) violations.push(`${from} -> ${to}`);
    }
  }
  expect(violations).toEqual([]);
});

test("frontend source imports have no cycles", () => {
  const visited = new Set<string>();
  const active: string[] = [];
  function visit(file: string) {
    if (active.includes(file)) throw new Error([...active, file].map(short).join(" -> "));
    if (visited.has(file)) return;
    active.push(file);
    for (const target of graph.get(file) || []) visit(target);
    active.pop();
    visited.add(file);
  }
  for (const file of files) visit(file);
  expect(visited.size).toBe(files.length);
});

test("business models and rules do not import transport, hooks or rendering components", () => {
  const violations: string[] = [];
  for (const [source, imports] of graph) {
    if (!/\/(model|catalog|cart|[\w-]+-rules)\.ts$/.test(short(source))) continue;
    for (const target of imports) {
      if (/\.tsx$|\/use\w+\.ts$|\/lib\/api\.ts$/.test(short(target))) violations.push(`${short(source)} -> ${short(target)}`);
    }
  }
  expect(violations).toEqual([]);
});
