import fs from 'fs';
import postcss from 'postcss';
import { execSync } from 'child_process';

const cssContent = fs.readFileSync('src/client/styles/legacy.css', 'utf-8');
const root = postcss.parse(cssContent);

const classNames = new Set();
root.walkRules(rule => {
  const matches = rule.selector.match(/\.[a-zA-Z0-9_-]+/g);
  if (matches) {
    matches.forEach(m => classNames.add(m.substring(1)));
  }
});

const unused = [];
for (const cls of classNames) {
  try {
    // Search in src/ and public/
    // exclude the css files themselves
    execSync(`git grep -q "\\b${cls}\\b" -- "src/*" "public/*" ":!src/client/styles/*"`);
  } catch (e) {
    unused.push(cls);
  }
}

console.log('Unused classes in legacy.css:');
console.log(unused.join('\n'));
