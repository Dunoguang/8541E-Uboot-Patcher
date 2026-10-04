/* check_i18n.js -- verifies every i18n key used in index.html / ui.js exists in zh/en/pt */
var fs = require('fs');
var WEB = __dirname;
var src = fs.readFileSync(WEB + '/i18n.js', 'utf8');

global.document = { readyState: 'complete', documentElement: {}, querySelectorAll: function () { return []; }, getElementById: function () { return null; }, addEventListener: function () {} };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.navigator = { language: 'zh' };
global.window = global;
global.CustomEvent = function () {};
eval(src);

var I = I18N;
var bad = 0;

var used = {};
function collect(file, re, tag) {
  var s = fs.readFileSync(file, 'utf8');
  var m;
  while ((m = re.exec(s))) used[m[1]] = tag;
}
collect(WEB + '/index.html', /data-i18n="([a-z0-9_]+)"/g, 'html');
collect(WEB + '/ui.js', /\bT\('([a-z0-9_]+)'/g, 'ui');

var langs = ['zh', 'en', 'pt'];
Object.keys(used).sort().forEach(function (k) {
  langs.forEach(function (l) {
    I.setLang(l);
    if (I.t(k) === k) { console.log('MISSING [' + l + '] ' + k + ' <' + used[k] + '>'); bad++; }
  });
});

function keysOf(lang) {
  var m = src.match(new RegExp('dict\\.' + lang + ' = \\{([\\s\\S]*?)\\n\\};'));
  if (!m) return [];
  var out = [];
  var re = /[,{\n]\s*([a-z][a-z0-9_]*):\s*'/g, mm;
  while ((mm = re.exec(m[1]))) out.push(mm[1]);
  return out;
}
var kz = keysOf('zh'), ke = keysOf('en'), kp = keysOf('pt');
console.log('dict key counts: zh=' + kz.length + ' en=' + ke.length + ' pt=' + kp.length);
function diffOnly(a, b, an, bn) {
  var sb = {}; b.forEach(function (k) { sb[k] = 1; });
  a.forEach(function (k) { if (!sb[k]) { console.log('ONLY IN ' + an + ': ' + k); bad++; } });
}
diffOnly(kz, ke, 'zh', 'en'); diffOnly(ke, kz, 'en', 'zh');
diffOnly(kz, kp, 'zh', 'pt'); diffOnly(kp, kz, 'pt', 'zh');

I.setLang('zh'); console.log('sample zh:', I.t('l_hdr', { what: 'uboot', n: 123, unit: I.t('unit_bytes') }));
I.setLang('en'); console.log('sample en:', I.t('l_hdr', { what: 'uboot', n: 123, unit: I.t('unit_bytes') }));
I.setLang('pt'); console.log('sample pt:', I.t('l_hdr', { what: 'uboot', n: 123, unit: I.t('unit_bytes') }));

console.log('used keys: ' + Object.keys(used).length);
console.log(bad === 0 ? 'I18N CHECK PASSED' : 'I18N CHECK FAILED: ' + bad);
process.exit(bad === 0 ? 0 : 1);
