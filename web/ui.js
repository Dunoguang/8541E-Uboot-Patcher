/* 8541E-Uboot-Patcher -- browser UI.  Needs tpl.js + core.js loaded first. */
(function () {
'use strict';
var C = window.UP84;
var $ = function (id) { return document.getElementById(id); };

var files = { spl: null, ub: null, tr: null };

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
  if (!d) { setBadge('b-' + which, 'idle', '未选择'); return; }
  try {
    if (which === 'spl') {
      var r = C.findSplloader(d);
      setBadge('b-spl', r.patched ? 'ok' : 'warn',
               (r.patched ? '已去保护' : '受保护') + ' @ ' + C.hexOff(r.pos));
    } else if (which === 'tr') {
      var t = C.findTrustos(d);
      setBadge('b-tr', t.patched ? 'ok' : 'warn',
               (t.patched ? '已去保护' : '受保护') + ' · ' + t.sites.length + ' sites');
    } else {
      var out = [];
      try {
        var lk = C.findUbootLock(d);
        out.push(chip(lk.patched ? 'ok' : 'warn', 'lock: ' + (lk.patched ? '已解锁' : '受保护')));
      } catch (e) { out.push(chip('err', 'lock: 无法识别')); }
      try {
        var bn = C.findBanners(d);
        var st = bn.warn.state === 'factory' ? '原厂' :
                 bn.warn.state === 'dunoguang' ? 'Dunoguang' : '已修改';
        out.push(chip(bn.warn.state === 'dunoguang' ? 'ok' : 'warn', 'banner: ' + st));
      } catch (e) { out.push(chip('err', 'banner: 无法识别')); }
      try {
        var det = C.detectUsblog(d);
        out.push(chip(det.state === 'injected' ? 'ok' : 'warn',
          'usblog: ' + (det.state === 'injected' ? '已注入' :
                        det.state === 'clean' ? '未注入' : '未知')));
      } catch (e) { out.push(chip('err', 'usblog: 不适用')); }
      $('ub-status').innerHTML = out.join('');
      setBadge('b-ub', 'ok', d.length + ' bytes');
    }
  } catch (e) {
    setBadge('b-' + which, 'err', '无法识别');
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

  if (!files.ub && !files.spl && !files.tr) { log('请先选择镜像文件'); return; }
  log('8541E-Uboot-Patcher');
  log('');

  if (files.spl && doUnlock) {
    log('== splloader (' + files.spl.length + ' bytes) ==');
    try {
      var r = C.findSplloader(files.spl);
      var splOut;
      if (r.patched) {
        splOut = files.spl;
        log('   secure-boot : already patched (kept)  [' + C.hexOff(r.pos) + ']');
      } else {
        splOut = C.patchSplloader(files.spl, r);
        log('   secure-boot : protected -> patched  [bl #0x6740 -> b #0x55dc @ ' + C.hexOff(r.pos) + ']');
      }
      var v = C.verifySplloader(splOut);
      log('   verify      : ' + (v.ok ? 'ok  (' + v.note + ')' : 'FAILED (' + v.note + ')'));
      if (!v.ok) fails++;
      log('   audit       : changed ' + C.countBytes(C.diffZones(files.spl, splOut)) + ' bytes');
      dls.push(['splloader-no-secure-boot.img', splOut]);
    } catch (e) { log('   ERROR: ' + (e.message || e)); fails++; }
  } else if (files.spl) {
    log('== splloader : 跳过（选项关闭） ==');
    dls.push(['splloader-no-secure-boot.img', files.spl]);
  }

  if (files.ub) {
    log('== uboot (' + files.ub.length + ' bytes) ==');
    var ubc = files.ub;
    try {
      if (doUnlock) {
        var lk = C.findUbootLock(ubc);
        if (lk.patched) log('   lock        : already patched (kept)  [' + C.hexOff(lk.pos) + ']');
        else {
          ubc = C.patchLockOnly(ubc, lk);
          log('   lock        : protected -> patched  [nop x3 @ ' + C.hexOff(lk.pos) + ']');
        }
      } else log('   lock        : 跳过（选项关闭）');

      if (doBanner) {
        var bn = C.findBanners(ubc);
        var wb = C.textToBytes(warnTxt, bn.warn.slot, 'warn');
        var ib = C.textToBytes(infoTxt, bn.info.slot, 'info');
        if (C.bytesEqual(bn.warn.text, wb)) log('   banner warn : ' + bn.warn.state + ' (kept)');
        else {
          ubc = C.applyText(ubc, bn.warn, wb, 'warn');
          log('   banner warn : ' + bn.warn.state + ' -> replaced  [' + wb.length + '/' + (bn.warn.slot - 1) + ' bytes]');
        }
        if (C.bytesEqual(bn.info.text, ib)) log('   banner info : ' + bn.info.state + ' (kept)');
        else {
          ubc = C.applyText(ubc, bn.info, ib, 'info');
          log('   banner info : ' + bn.info.state + ' -> replaced  [' + ib.length + '/' + (bn.info.slot - 1) + ' bytes]');
        }
      } else log('   banner      : 跳过（选项关闭）');

      var det;
      try { det = C.detectUsblog(files.ub); } catch (e2) { det = { state: 'na' }; }
      if (det.state === 'injected') {
        log('   usblog      : already injected (kept)  [TRIG ' + C.hexOff(det.TRIG) + ']');
      } else if (det.state === 'clean') {
        if (!doUsblog) log('   usblog      : clean（跳过，选项关闭）');
        else {
          var anchors = C.locate(files.ub);
          ubc = C.buildUsblog(ubc, anchors, C.rd32(ubc, 0x30));
          log('   usblog      : clean -> injected  [TRIG ' + C.hexOff(anchors.TRIG) +
              ', PUTS ' + C.hexOff(anchors.PUTS) + ', dead ' + C.hexOff(anchors.FLAG) +
              '..' + C.hexOff(anchors.DEAD_END) + ']');
          var uv = C.verifyUsblog(ubc, anchors, C.rd32(ubc, 0x30));
          log('   verify      : ' + (uv.bad ? 'FAILED (' + uv.bad + ')' : 'ok - image looks correct'));
          if (uv.bad) fails++;
        }
      } else {
        log('   usblog      : 不适用（未找到注入链）');
      }
      log('   audit       : changed ' + C.countBytes(C.diffZones(files.ub, ubc)) + ' bytes');
      dls.push(['uboot-unlock-bootloader-usblog.img', ubc]);
    } catch (e) { log('   ERROR: ' + (e.message || e)); fails++; }
  }

  if (files.tr && doUnlock) {
    log('== trustos (' + files.tr.length + ' bytes) ==');
    try {
      var tr = C.findTrustos(files.tr);
      var trOut;
      if (tr.patched) {
        trOut = files.tr;
        log('   avb returns : already patched (kept)  [' + tr.sites.length + ' sites]');
      } else {
        trOut = C.patchTrustos(files.tr, tr);
        log('   avb returns : protected -> patched  [' + tr.sites.map(C.hexOff).join(', ') + ']');
      }
      var v2 = C.verifyTrustos(trOut, tr.sites.length);
      log('   verify      : ' + (v2.ok ? 'ok  (' + v2.note + ')' : 'FAILED (' + v2.note + ')'));
      if (!v2.ok) fails++;
      log('   audit       : changed ' + C.countBytes(C.diffZones(files.tr, trOut)) + ' bytes');
      dls.push(['trustos-no-avb.img', trOut]);
    } catch (e) { log('   ERROR: ' + (e.message || e)); fails++; }
  } else if (files.tr) {
    log('== trustos : 跳过（选项关闭） ==');
    dls.push(['trustos-no-avb.img', files.tr]);
  }

  log('');
  log(fails === 0 ? 'ALL CHECKS PASSED' : (fails + ' CHECK(S) FAILED'));

  var box = $('downloads');
  box.innerHTML = '';
  for (var i = 0; i < dls.length; i++) {
    (function (name, bytes) {
      var row = document.createElement('div');
      row.className = 'dl-row';
      var btn = document.createElement('button');
      btn.textContent = '下载 ' + name;
      btn.addEventListener('click', function () { download(name, bytes); });
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = bytes.length + ' bytes · md5 ' + C.md5(bytes);
      row.appendChild(btn);
      row.appendChild(meta);
      box.appendChild(row);
    })(dls[i][0], dls[i][1]);
  }
  if (dls.length > 1) {
    var all = document.createElement('button');
    all.className = 'ghost';
    all.textContent = '全部下载';
    all.addEventListener('click', function () {
      dls.forEach(function (item, k) {
        setTimeout(function () { download(item[0], item[1]); }, k * 400);
      });
    });
    box.appendChild(all);
  }
  $('dl-card').hidden = dls.length === 0;
  $('dl-card').scrollIntoView({ behavior: 'smooth' });
}

function init() {
  ['spl', 'ub', 'tr'].forEach(function (w) {
    $('f-' + w).addEventListener('change', function () { readInto(w); });
  });
  $('go').addEventListener('click', function () {
    var btn = $('go');
    btn.disabled = true;
    btn.textContent = '处理中…';
    setTimeout(function () {
      try { processAll(); }
      catch (e) { log('ERROR: ' + (e.message || e)); }
      btn.disabled = false;
      btn.textContent = '处理';
    }, 40);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
