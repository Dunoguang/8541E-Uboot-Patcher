#!/usr/bin/env node
/* Node regression for the web core -- mirrors ../tests/run_cases.py. */
'use strict';
globalThis.TEMPLATES_DW99 = require('./tpl.js').TEMPLATES_DW99;
const C = require('./core.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NL = String.fromCharCode(10);
const DEF_WARN = 'QQ:3981750101' + NL + 'Boot Format OK, Kernel Started...' + NL;
const DEF_INFO = 'SPRD U-Boot - Patch By Dunoguang  ' + NL;
const U = '/root/github/8541e_unlock_work';
const SPL_MD5 = 'a9f360909ed33d200eff0874588a4c93';
const TR_MD5 = '4b7a605e410a4c239ae36250dcc08213';

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? 'ok  ' : 'FAIL') + '  ' + name + (extra ? '   ' + extra : ''));
  if (!cond) fails += 1;
}
const load = (p) => new Uint8Array(fs.readFileSync(p));

function processAll(spl, tr, ub) {
  let splOut = spl, trOut = tr, ubc = ub;
  let anchors = null, det;
  const sl = C.findSplloader(spl);
  if (sl.patched === false) splOut = C.patchSplloader(spl, sl);
  const tl = C.findTrustos(tr);
  if (tl.patched === false) trOut = C.patchTrustos(tr, tl);
  try { det = C.detectUsblog(ub); } catch (e) { det = { state: 'na' }; }
  const lk = C.findUbootLock(ubc);
  if (lk.patched === false) ubc = C.patchLockOnly(ubc, lk);
  const bn = C.findBanners(ubc);
  if (!C.bytesEqual(bn.warn.text, C.DUNOGUANG_WARN))
    ubc = C.applyText(ubc, bn.warn, C.textToBytes(DEF_WARN, bn.warn.slot, '--warn'), '--warn');
  if (!C.bytesEqual(bn.info.text, C.DUNOGUANG_INFO))
    ubc = C.applyText(ubc, bn.info, C.textToBytes(DEF_INFO, bn.info.slot, '--info'), '--info');
  if (det.state === 'clean') {
    anchors = C.locate(ub);
    ubc = C.buildUsblog(ubc, anchors, C.rd32(ubc, 0x30));
    const v = C.verifyUsblog(ubc, anchors, C.rd32(ubc, 0x30));
    check('usblog verify failures', v.bad === 0, 'bad=' + v.bad);
  } else {
    check('usblog state', det.state === 'injected', det.state);
  }
  return { spl: splOut, ub: ubc, tr: trOut, det: det };
}

function runSet(name, splPath, ubPath, trPath, ubExpect) {
  const r = processAll(load(splPath), load(trPath), load(ubPath));
  const s = C.md5(r.spl), u = C.md5(r.ub), t = C.md5(r.tr);
  check(name + ' spl', s === SPL_MD5, s);
  check(name + ' uboot', u === ubExpect, u);
  check(name + ' trustos', t === TR_MD5, t);
  return r;
}

console.log('== case 1: m9u original ==');
const r1 = runSet('m9u    ', U + '/m9u/splloader.img', U + '/m9u/uboot.img',
                  U + '/m9u/trustos.img', '1380040a3aa38e4c844cde0a4b09f55a');
console.log('== case 2: ai3 two-step (unlocked + dunoguang banner) ==');
runSet('ai3    ', U + '/ai3-watch/splloader_has_secure_boot.bin',
       U + '/ai3-watch/patched/uboot-unlock-bootloader.img',
       U + '/ai3-watch/trustos_has_avb.bin', '21d7b220a891695647005fd73a161e28');
console.log('== case 3: dw99 (YC unlock + YC banner) ==');
runSet('dw99   ', U + '/m9u/splloader.img',
       '/root/usblog-patch-transplant-dw99/uboot-unlock-bootloader.img',
       U + '/m9u/trustos.img', '60b245aa1686310290dc95db61353237');

console.log('== case 4: idempotent re-run on the m9u products ==');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up84-'));
fs.writeFileSync(path.join(dir, 'spl.img'), r1.spl);
fs.writeFileSync(path.join(dir, 'ub.img'), r1.ub);
fs.writeFileSync(path.join(dir, 'tr.img'), r1.tr);
const r1b = runSet('idem   ', path.join(dir, 'spl.img'), path.join(dir, 'ub.img'),
                   path.join(dir, 'tr.img'), '1380040a3aa38e4c844cde0a4b09f55a');
check('re-detect still injected', C.detectUsblog(r1b.ub).state === 'injected');

console.log('');
console.log('regress:', fails === 0 ? 'PASS' : ('FAIL (' + fails + ')'));
process.exit(fails ? 1 : 0);
