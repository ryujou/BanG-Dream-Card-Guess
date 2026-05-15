import fs from 'fs';
import postcss from 'postcss';
import { execSync } from 'child_process';

const cssContent = fs.readFileSync('src/client/styles/legacy.css', 'utf-8');
const root = postcss.parse(cssContent);

const unusedClasses = [
  'home-shell',
  'home-hero',
  'home-copy',
  'home-intro',
  'home-actions',
  'home-community',
  'home-icon-grid',
  'home-icon',
  'home-join',
  'home-announcement',
  'home-marquee',
  'is-danger',
  'error-state',
  'is-visible',
  'health-panel',
  'icon-button',
  'answer-row',
  'community-content',
  'community-section',
  'social-grid',
  'social-card',
  'photo-grid',
  'marquee-content',
  'footer-logo',
  'community-admin-header',
  'json-editor-container',
  'je-header',
  'json-editor-btntype-toggle',
  'admin-actions',
  'upload-group',
  'save-group',
  'result-title',
  'is-win',
  'is-lose'
];

root.walkRules(rule => {
  const matches = rule.selector.match(/\.[a-zA-Z0-9_-]+/g);
  if (matches) {
    const hasUnused = matches.some(m => unusedClasses.includes(m.substring(1)));
    // if ALL selectors in this rule are unused, remove the rule
    // actually, if ANY is unused and the selector relies on it, we can remove it.
    // To be safe, let's just remove the rule if it contains the unused class
    if (hasUnused) {
      rule.remove();
    }
  }
});

// Also remove empty at-rules (like media queries)
root.walkAtRules(atRule => {
  if (atRule.nodes && atRule.nodes.length === 0) {
    atRule.remove();
  }
});

fs.writeFileSync('src/client/styles/legacy.css', root.toString());
console.log('Removed unused CSS!');
