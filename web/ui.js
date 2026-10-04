/* 8541E-Uboot-Patcher -- browser UI.  Needs tpl.js + core.js + i18n.js loaded first. */
(function () {
'use strict';
var C = window.UP84;
var $ = function (id) { return document.getElementById(id); };
var T = function (key, vars) { return window.I18N.t(key, vars); };

var files = { spl: null, ub: null, tr: null };
var lastDls = null;

function log(msg) {
  var el = $('log');
  el.textContent += (el.textContent ? '\n' : '') + msg;
  el.scrollTop = el.scrollHeight;
}
function clearLog() { $('log').textContent = ''; }
function setBadge(id, cls, text) {
  var el = $(id);
  el.className = 'badge ' + cls;
  el.textContent = text;
}
function chip(cls, text) {
  return '<span class="chip ' + cls + '">' + text + '</span>';
}
function stateLabel(s) {
  if (s === 'factory') return T('st_factory');
  if (s === 'modified') return T('st_modified');
  return s;
}

function readInto(which) {
  var f = $('f-' + which).files && $('f-' + which).files[0];
  if (!f) { files[which] = null; analyze(which); return; }
  f.arrayBuffer().then(function (buf) {
    files[which] = new Uint8Array(buf);
    analyze(which);
  });
}

function analyze(which) {
  if (which === 'ub') $('ub-status').innerHTML = '';
  var d = files[which];
  if (!d) { setBadge('b-' + which, 'idle', T('none')); return; }
  try {
    if (which === 'spl') {
      var r = C.findSplloader(d);
      setBadge('b-spl', r.patched ? 'ok' : 'warn',
               (r.patched ? T('st_patched') : T('st_protected')) + ' @ ' + C.hexOff(r.pos));
    } else if (which === 'tr') {
      var t2 = C.findTrustos(d);
      setBadge('b-tr', t2.patched ? 'ok' : 'warn',
               (t2.patched ? T('st_patched') : T('st_protected')) + ' ' + T('n_sites', { n: t2.sites.length }));
    } else {
      var out = [];
      try {
        var lk = C.findUbootLock(d);
        out.push(chip(lk.patched ? 'ok' : 'warn', 'lock: ' + (lk.patched ? T('st_unlocked') : T('st_protected'))));
      } catch (e) { out.push(chip('err', 'lock: ' + T('st_unknown'))); }
      try {
        var bn = C.findBanners(d);
        out.push(chip(bn.warn.state === 'dunoguang' ? 'ok' : 'warn', 'banner: ' + stateLabel(bn.warn.state)));
      } catch (e) { out.push(chip('err', 'banner: ' + T('st_unknown'))); }
      try {
        var det = C.detectUsblog(d);
        out.push(chip(det.state === 'injected' ? 'ok' : 'warn',
          'usblog: ' + (det.state === 'injected' ? T('st_injected') :
                        det.state === 'clean' ? T('st_clean') : T('st_na'))));
      } catch (e) { out.push(chip('err', 'usblog: ' + T('st_na'))); }
      $('ub-status').innerHTML = out.join('');
      setBadge('b-ub', 'ok', d.length + ' ' + T('unit_bytes'));
    }
  } catch (e) {
    setBadge('b-' + which, 'err', T('st_unknown'));
  }
}

function download(name, bytes) {
  var blob = new Blob([bytes], { type: 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

function processAll() {
  clearLog();
  var doUnlock = $('o-unlock').checked;
  var doUsblog = $('o-usblog').checked;
  var doBanner = $('o-banner').checked;
  var warnTxt = $('t-warn').value;
  var infoTxt = $('t-info').value;
  var dls = [];
  var fails = 0;
  var UB = T('unit_bytes');

  if (!files.ub && !files.spl && !files.tr) { log(T('need_files')); return; }
  log('8541E-Uboot-Patcher');
  log('');

  if (files.spl && doUnlock) {
    log(T('l_hdr', { what: 'splloader', n: files.spl.length, unit: UB }));
    try {
      var r = C.findSplloader(files.spl);
      var splOut;
      if (r.patched) {
        splOut = files.spl;
        log(T('l_spl_keep', { off: C.hexOff(r.pos) }));
      } else {
        splOut = C.patchSplloader(files.spl, r);
        log(T('l_spl_patch', { off: C.hexOff(r.pos) }));
      }
      var v = C.verifySplloader(splOut);
      log(v.ok ? T('l_verify_ok', { note: v.note }) : T('l_verify_fail', { note: v.note }));
      if (!v.ok) fails++;
      log(T('l_audit', { n: C.countBytes(C.diffZones(files.spl, splOut)), unit: UB }));
      dls.push(['splloader-no-secure-boot.img', splOut]);
    } catch (e) { log(T('l_err', { msg: (e.message || e) })); fails++; }
  } else if (files.spl) {
    log(T('l_skip_hdr', { what: 'splloader', skip: T('skip_opt') }));
    dls.push(['splloader-no-secure-boot.img', files.spl]);
  }

  if (files.ub) {
    log(T('l_hdr', { what: 'uboot', n: files.ub.length, unit: UB }));
    var ubc = files.ub;
    try {
      if (doUnlock) {
        var lk = C.findUbootLock(ubc);
        if (lk.patched) log(T('l_lock_keep', { off: C.hexOff(lk.pos) }));
        else {
          ubc = C.patchLockOnly(ubc, lk);
          log(T('l_lock_patch', { off: C.hexOff(lk.pos) }));
        }
      } else log(T('l_lock_skip', { skip: T('skip_opt') }));

      if (doBanner) {
        var bn = C.findBanners(ubc);
        var wb = C.textToBytes(warnTxt, bn.warn.slot, 'warn');
        var ib = C.textToBytes(infoTxt, bn.info.slot, 'info');
        if (C.bytesEqual(bn.warn.text, wb)) log(T('l_ban_keep', { which: 'warn', state: stateLabel(bn.warn.state) }));
        else {
          ubc = C.applyText(ubc, bn.warn, wb, 'warn');
          log(T('l_ban_repl', { which: 'warn', state: stateLabel(bn.warn.state), n: wb.length, slot: bn.warn.slot - 1, unit: UB }));
        }
        if (C.bytesEqual(bn.info.text, ib)) log(T('l_ban_keep', { which: 'info', state: stateLabel(bn.info.state) }));
        else {
          ubc = C.applyText(ubc, bn.info, ib, 'info');
          log(T('l_ban_repl', { which: 'info', state: stateLabel(bn.info.state), n: ib.length, slot: bn.info.slot - 1, unit: UB }));
        }
      } else log(T('l_ban_skip', { skip: T('skip_opt') }));

      var det;
      try { det = C.detectUsblog(files.ub); } catch (e2) { det = { state: 'na' }; }
      if (det.state === 'injected') {
        log(T('l_us_keep', { off: C.hexOff(det.TRIG) }));
      } else if (det.state === 'clean') {
        if (!doUsblog) log(T('l_us_clean_skip', { skip: T('skip_opt') }));
        else {
          var anchors = C.locate(files.ub);
          ubc = C.buildUsblog(ubc, anchors, C.rd32(ubc, 0x30));
          log(T('l_us_inject', {
            trig: C.hexOff(anchors.TRIG), puts: C.hexOff(anchors.PUTS),
            f: C.hexOff(anchors.FLAG), e: C.hexOff(anchors.DEAD_END)
          }));
          var uv = C.verifyUsblog(ubc, anchors, C.rd32(ubc, 0x30));
          log(uv.bad ? T('l_verify_fail', { note: uv.bad }) : T('l_us_verify_ok'));
          if (uv.bad) fails++;
        }
      } else {
        log(T('l_us_na'));
      }
      log(T('l_audit', { n: C.countBytes(C.diffZones(files.ub, ubc)), unit: UB }));
      dls.push(['uboot-unlock-bootloader-usblog.img', ubc]);
    } catch (e) { log(T('l_err', { msg: (e.message || e) })); fails++; }
  }

  if (files.tr && doUnlock) {
    log(T('l_hdr', { what: 'trustos', n: files.tr.length, unit: UB }));
    try {
      var tr = C.findTrustos(files.tr);
      var trOut;
      if (tr.patched) {
        trOut = files.tr;
        log(T('l_tr_keep', { n: tr.sites.length }));
      } else {
        trOut = C.patchTrustos(files.tr, tr);
        log(T('l_tr_patch', { sites: tr.sites.map(C.hexOff).join(', ') }));
      }
      var v2 = C.verifyTrustos(trOut, tr.sites.length);
      log(v2.ok ? T('l_verify_ok', { note: v2.note }) : T('l_verify_fail', { note: v2.note }));
      if (!v2.ok) fails++;
      log(T('l_audit', { n: C.countBytes(C.diffZones(files.tr, trOut)), unit: UB }));
      dls.push(['trustos-no-avb.img', trOut]);
    } catch (e) { log(T('l_err', { msg: (e.message || e) })); fails++; }
  } else if (files.tr) {
    log(T('l_tr_skip', { skip: T('skip_opt') }));
    dls.push(['trustos-no-avb.img', files.tr]);
  }

  log('');
  log(fails === 0 ? T('all_ok') : T('all_fail', { n: fails }));

  renderDls(dls);
  $('dl-card').scrollIntoView({ behavior: 'smooth' });
}

function renderDls(dls) {
  lastDls = dls;
  var box = $('downloads');
  box.innerHTML = '';
  for (var i = 0; i < dls.length; i++) {
    (function (name, bytes) {
      var row = document.createElement('div');
      row.className = 'dl-row';
      var btn = document.createElement('button');
      btn.textContent = T('dl_btn', { name: name });
      btn.addEventListener('click', function () { download(name, bytes); });
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = T('dl_meta', { n: bytes.length, unit: T('unit_bytes'), md5: C.md5(bytes) });
      row.appendChild(btn);
      row.appendChild(meta);
      box.appendChild(row);
    })(dls[i][0], dls[i][1]);
  }
  if (dls.length > 1) {
    var all = document.createElement('button');
    all.className = 'ghost';
    all.textContent = T('dl_all');
    all.addEventListener('click', function () {
      dls.forEach(function (item, k) {
        setTimeout(function () { download(item[0], item[1]); }, k * 400);
      });
    });
    box.appendChild(all);
  }
  $('dl-card').hidden = dls.length === 0;
}

function init() {
  ['spl', 'ub', 'tr'].forEach(function (w) {
    $('f-' + w).addEventListener('change', function () { readInto(w); });
  });
  $('go').addEventListener('click', function () {
    var btn = $('go');
    btn.disabled = true;
    btn.textContent = T('btn_go_ing');
    setTimeout(function () {
      try { processAll(); }
      catch (e) { log(T('l_err', { msg: (e.message || e) })); }
      btn.disabled = false;
      btn.textContent = T('btn_go');
    }, 40);
  });

  window.addEventListener('ubp-langchange', function () {
    ['spl', 'ub', 'tr'].forEach(function (w) {
      if (files[w]) analyze(w);
      else setBadge('b-' + w, 'idle', T('none'));
    });
    if (lastDls && lastDls.length) renderDls(lastDls);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
