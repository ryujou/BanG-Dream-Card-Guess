import fs from 'fs';
import postcss from 'postcss';

const cssContent = fs.readFileSync('src/web/styles.css', 'utf-8');

const baseRules = [];
const layoutRules = [];
const gameRules = [];
const settingsRules = [];
const qrRules = [];
const scoresRules = [];
const miniGamesRules = [];
const legacyRules = [];

function categorizeSelector(selector) {
  if (selector.includes('.qr-') || selector.includes('.wifi-')) return qrRules;
  if (selector.includes('.scores-') || selector.includes('.score-') || selector.includes('.queue-')) return scoresRules;
  if (selector.includes('.settings-') || selector.includes('.setting-')) return settingsRules;
  if (selector.includes('.note-shooter') || selector.includes('.bang-klotski') || selector.includes('.stopwatch')) return miniGamesRules;
  if (selector.includes('.stage') || selector.includes('.crop-') || selector.includes('.reveal-') || selector.includes('.answer-') || selector.includes('.team-')) return gameRules;
  if (selector.includes('.shell') || selector.includes('.topbar') || selector.includes('.panel') || selector.includes('.scoreboard')) return layoutRules;
  if (selector.includes('.linktree-') || selector.includes('.member-') || selector.includes('.event-')) return layoutRules;
  if (selector.match(/^[a-z]/) || selector.includes(':root') || selector.includes('*')) return baseRules;
  
  return legacyRules;
}

const root = postcss.parse(cssContent);

root.nodes.forEach(node => {
  if (node.type === 'rule') {
    const list = categorizeSelector(node.selector);
    list.push(node);
  } else if (node.type === 'atrule' && node.name === 'media') {
    // Check its children
    const firstChild = node.nodes[0];
    if (firstChild && firstChild.type === 'rule') {
      const list = categorizeSelector(firstChild.selector);
      list.push(node);
    } else {
      layoutRules.push(node);
    }
  } else if (node.type === 'atrule' && node.name === 'keyframes') {
     // Put in base or game
     if (node.params.includes('skeleton')) gameRules.push(node);
     else baseRules.push(node);
  } else {
    baseRules.push(node);
  }
});

fs.writeFileSync('src/client/styles/base.css', baseRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/layout.css', layoutRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/game.css', gameRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/settings.css', settingsRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/qr.css', qrRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/scores.css', scoresRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/mini-games.css', miniGamesRules.map(n => n.toString()).join('\n\n'));
fs.writeFileSync('src/client/styles/legacy.css', legacyRules.map(n => n.toString()).join('\n\n'));

console.log('CSS split done!');
