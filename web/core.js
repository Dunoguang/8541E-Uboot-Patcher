/* 8541E-Uboot-Patcher -- browser core.  Pure JS, zero external references.
 * Ports lib/{unlockauto,usblogauto,banners}.py + patcher.py.
 * Loaded by index.html as a plain script; require()d by the node tests.
 */
(function (root) {
'use strict';
var UP = (typeof module !== 'undefined' && module.exports)
       ? module.exports
       : (root.UP84 = root.UP84 || {});

/* ---------------------------------------------------------------- util */
function u32(x) { return x >>> 0; }

function rd32(d, off) {
  return ((d[off] | (d[off + 1] << 8) | (d[off + 2] << 16) | (d[off + 3] << 24)) >>> 0);
}

function wr32(d, off, w) {
  d[off] = w & 255;
  d[off + 1] = (w >>> 8) & 255;
  d[off + 2] = (w >>> 16) & 255;
  d[off + 3] = (w >>> 24) & 255;
}

function findAll(d, pat) {
  var out = [], m = pat.length, n = d.length - m;
  for (var i = 0; i <= n; i++) {
    var k = 0;
    while (k < m && d[i + k] === pat[k]) k++;
    if (k === m) out.push(i);
  }
  return out;
}

function eqAt(d, off, pat) {
  for (var i = 0; i < pat.length; i++) if (d[off + i] !== pat[i]) return false;
  return true;
}

function fromHex(s) {
  var a = new Uint8Array(s.length >> 1);
  for (var i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
  return a;
}

function sign(v, bits) {
  var m = 1 << (bits - 1);
  return (v & m) ? v - (m << 1) : v;
}

function hex8(w) { return ('0000000' + u32(w).toString(16)).slice(-8); }
function hexOff(n) { return '0x' + u32(n).toString(16); }

/* ----------------------------------------------------------------- md5 */
var MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
  0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
  0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
  0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
  0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
  0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
var MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

function md5(bytes) {
  var n = bytes.length;
  var padded = new Uint8Array((((n + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[n] = 0x80;
  var dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, u32(n << 3), true);
  dv.setUint32(padded.length - 4, Math.floor(n / 0x20000000) >>> 0, true);
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  var M = new Uint32Array(16);
  for (var off = 0; off < padded.length; off += 64) {
    for (var i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    var A = a0, B = b0, C = c0, D = d0;
    for (var j = 0; j < 64; j++) {
      var F, g;
      if (j < 16)      { F = (B & C) | (~B & D);       g = j; }
      else if (j < 32) { F = (D & B) | (~D & C);       g = (5 * j + 1) & 15; }
      else if (j < 48) { F = B ^ C ^ D;                g = (3 * j + 5) & 15; }
      else             { F = C ^ (B | ~D);             g = (7 * j) & 15; }
      F = (F + A + MD5_K[j] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << MD5_S[j]) | (F >>> (32 - MD5_S[j])))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  var out = new Uint8Array(16);
  var dv2 = new DataView(out.buffer);
  dv2.setUint32(0, a0 >>> 0, true);  dv2.setUint32(4, b0 >>> 0, true);
  dv2.setUint32(8, c0 >>> 0, true);  dv2.setUint32(12, d0 >>> 0, true);
  var s = '';
  for (var k = 0; k < 16; k++) s += ('0' + out[k].toString(16)).slice(-2);
  return s;
}

/* ------------------------------------------------------------ aarch64 */
var NOP_BYTES = fromHex('1f2003d5');
var NOP_WORD = 0xd503201f;

function isBl(w)     { return u32(w & 0xfc000000) === 0x94000000; }
function isB(w)      { return u32(w & 0xfc000000) === 0x14000000; }
function isAdrp(w)   { return u32(w & 0x9f000000) === 0x90000000; }
function isAddimm(w) { var t = u32(w & 0x7f000000); return t === 0x11000000 || t === 0x91000000; }
function isCbzW0(w)  { return u32(w & 0x7f00001f) === 0x34000000; }
function isNop(w)    { return u32(w) === NOP_WORD; }

function branchTargetW(w, pc) { return pc + (sign(w & 0x03ffffff, 26) << 2); }
function cbzImm19(w) { return sign((w >>> 5) & 0x7ffff, 19); }

function fmtW(w) {
  if (isNop(w)) return 'nop';
  if (isBl(w)) return 'bl';
  if (isB(w)) return 'b';
  if (isAdrp(w)) return 'adrp';
  if (isCbzW0(w)) return 'cbz w0';
  return hex8(w);
}

/* encoders (bit-for-bit identical to the legacy generators) */
function b_(src, dst)  { return u32(0x14000000 | ((((dst - src) >> 2) & 0x3ffffff))); }
function bl_(src, dst) { return u32(0x94000000 | ((((dst - src) >> 2) & 0x3ffffff))); }

function adrp(rd, pc, target) {
  var off = ((target & ~0xfff) - (pc & ~0xfff)) | 0;
  var imm = (off >> 12) & 0x1fffff;
  return u32(0x90000000 | (((imm & 3) << 29) >>> 0) | (((imm >>> 2) << 5) >>> 0) | rd);
}

function addImm(rd, rn, imm) { return u32(0x91000000 | (((imm & 0xfff) << 10) >>> 0) | (rn << 5) | rd); }
function addX(rd, rn, rm)    { return u32(0x8b000000 | (rm << 16) | (rn << 5) | rd); }
function subX(rd, rn, rm)    { return u32(0xcb000000 | (rm << 16) | (rn << 5) | rd); }
function cmpX(rn, rm)        { return u32(0xeb000000 | (rm << 16) | (rn << 5) | 31); }
function subsWImm(rd, rn, imm) { return u32(0x71000000 | (((imm & 0xfff) << 10) >>> 0) | (rn << 5) | rd); }
function subsImmX(rd, rn, imm) { return u32(0xf1000000 | (((imm & 0xfff) << 10) >>> 0) | (rn << 5) | rd); }
function orrX(rd, rn, rm)    { return u32(0xaa000000 | (rm << 16) | (rn << 5) | rd); }
function movzW(rd, imm16)    { return u32(0x52800000 | ((imm16 & 0xffff) << 5) | rd); }
function movzX(rd, imm16)    { return u32(0xd2800000 | ((imm16 & 0xffff) << 5) | rd); }
function ldrWImm(rt, rn, i)  { return u32(0xb9400000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function ldrXImm(rt, rn, i)  { return u32(0xf9400000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function strWImm(rt, rn, i)  { return u32(0xb9000000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function strXImm(rt, rn, i)  { return u32(0xf9000000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function ldrbImm(rt, rn, i)  { return u32(0x39400000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function strbImm(rt, rn, i)  { return u32(0x39000000 | (((i & 0xfff) << 10) >>> 0) | (rn << 5) | rt); }
function cbzW(rt, delta)     { return u32(0x34000000 | (((delta & 0x7ffff) << 5) >>> 0) | rt); }
function cbzX(rt, delta)     { return u32(0xb4000000 | (((delta & 0x7ffff) << 5) >>> 0) | rt); }
function cbnzW(rt, delta)    { return u32(0x35000000 | (((delta & 0x7ffff) << 5) >>> 0) | rt); }
function bNe(delta)          { return u32(0x54000000 | (((delta & 0x7ffff) << 5) >>> 0) | 0x1); }
function bCond(delta, cond)  { return u32(0x54000000 | (((delta & 0x7ffff) << 5) >>> 0) | cond); }
function movX(rd, rm)        { return orrX(rd, 31, rm); }

/* decoders */
function signExt(v, bits) {
  var m = 1 << (bits - 1);
  return (v & m) ? v - (m << 1) : v;
}

function blTarget(d, off, base) {
  var v = rd32(d, off);
  if ((v >>> 26) !== 0x25) return null;
  return base + off + signExt(v & 0x3ffffff, 26) * 4;
}

function decPair(d, off, base) {
  var w1 = rd32(d, off);
  if (u32(w1 & 0x9f000000) !== 0x90000000) return null;
  var w2 = rd32(d, off + 4);
  if (u32(w2 & 0xff800000) !== 0x91000000) return null;
  if ((w1 & 0x1f) !== ((w2 >>> 5) & 0x1f)) return null;
  var sh = (w2 >>> 22) & 3;
  if (sh !== 0 && sh !== 1) return null;
  var immlo = (w1 >>> 29) & 3;
  var immhi = (w1 >>> 5) & 0x7ffff;
  var imm = signExt((immhi << 2) | immlo, 21);
  var pc = off + base;
  var addimm = (w2 >>> 10) & 0xfff;
  if (sh === 1) addimm *= 4096;
  return u32(((pc & ~0xfff) + (imm * 4096)) + addimm);
}

function branchTarget(d, off, base) {
  var v = rd32(d, off);
  var t = u32(v & 0xfc000000);
  if (t === 0x14000000 || t === 0x94000000)
    return base + off + signExt(v & 0x3ffffff, 26) * 4;
  t = u32(v & 0x7e000000);
  if (t === 0x34000000 || t === 0x35000000)
    return base + off + signExt((v >>> 5) & 0x7ffff, 19) * 4;
  if (u32(v & 0xff000010) === 0x54000000)
    return base + off + signExt((v >>> 5) & 0x7ffff, 19) * 4;
  if (t === 0x36000000 || t === 0x37000000)
    return base + off + signExt((v >>> 5) & 0x3fff, 14) * 4;
  return null;
}

function isWild(v) {
  var t = u32(v & 0xfc000000);
  if (t === 0x14000000 || t === 0x94000000) return true;
  t = u32(v & 0x7e000000);
  if (t === 0x34000000 || t === 0x35000000) return true;
  if (u32(v & 0xff000010) === 0x54000000) return true;
  if (t === 0x36000000 || t === 0x37000000) return true;
  t = u32(v & 0x9f000000);
  if (t === 0x10000000 || t === 0x90000000) return true;
  if (u32(v & 0x3b000000) === 0x18000000) return true;
  return false;
}

/* --------------------------------------------------------------- export */
UP.u32 = u32; UP.rd32 = rd32; UP.wr32 = wr32; UP.findAll = findAll;
UP.eqAt = eqAt; UP.fromHex = fromHex; UP.sign = sign;
UP.hex8 = hex8; UP.hexOff = hexOff; UP.md5 = md5;
UP.NOP_BYTES = NOP_BYTES; UP.NOP_WORD = NOP_WORD;
UP.isBl = isBl; UP.isB = isB; UP.isAdrp = isAdrp; UP.isAddimm = isAddimm;
UP.isCbzW0 = isCbzW0; UP.isNop = isNop;
UP.branchTargetW = branchTargetW; UP.cbzImm19 = cbzImm19; UP.fmtW = fmtW;
UP.b_ = b_; UP.bl_ = bl_; UP.adrp = adrp; UP.addImm = addImm; UP.addX = addX;
UP.subX = subX; UP.cmpX = cmpX; UP.subsWImm = subsWImm; UP.subsImmX = subsImmX;
UP.orrX = orrX; UP.movzW = movzW; UP.movzX = movzX; UP.ldrWImm = ldrWImm;
UP.ldrXImm = ldrXImm; UP.strWImm = strWImm; UP.strXImm = strXImm;
UP.ldrbImm = ldrbImm; UP.strbImm = strbImm; UP.cbzW = cbzW; UP.cbzX = cbzX;
UP.cbnzW = cbnzW; UP.bNe = bNe; UP.bCond = bCond; UP.movX = movX;
UP.signExt = signExt; UP.blTarget = blTarget; UP.decPair = decPair;
UP.branchTarget = branchTarget; UP.isWild = isWild;

})(typeof self !== 'undefined' ? self : this);

/* ================================================== part 2: unlock engine */
(function (root) {
'use strict';
var UP = (typeof module !== 'undefined' && module.exports)
       ? module.exports
       : (root.UP84 = root.UP84 || {});
var u32 = UP.u32, rd32 = UP.rd32, findAll = UP.findAll, eqAt = UP.eqAt,
    fromHex = UP.fromHex, isB = UP.isB, isCbzW0 = UP.isCbzW0,
    cbzImm19 = UP.cbzImm19, branchTargetW = UP.branchTargetW,
    hexOff = UP.hexOff, NOP_BYTES = UP.NOP_BYTES;

function LocateError(msg) { this.message = msg; }
LocateError.prototype = Object.create(Error.prototype);
LocateError.prototype.name = 'LocateError';

/* ---------------- splloader ---------------- */
var SPL_OLD = fromHex('a0040094');    /* bl  #0x6740 (secure-boot check)  */
var SPL_NEW = fromHex('47000014');    /* b   #0x55dc (skip the chain)     */
var SPL_PREV = fromHex('b9ffff97');   /* bl  back, directly before        */
var SPL_NEXT = fromHex('01c09fd2');   /* mov x1, #0xfe00, directly after  */
var SPL_SPIN = fromHex('00000014');   /* b . (fail spin), site + 0x118    */

function findSplloader(d) {
  var good = [], hits = findAll(d, SPL_OLD), i, p;
  for (i = 0; i < hits.length; i++) {
    p = hits[i];
    if (p < 8 || p + 8 > d.length) continue;
    if (!eqAt(d, p - 4, SPL_PREV)) continue;
    if (!eqAt(d, p + 4, SPL_NEXT)) continue;
    good.push(p);
  }
  if (good.length === 1) {
    var q = good[0], spin = q + 0x118;
    return { pos: q, patched: false,
             spinOk: (spin + 4 <= d.length) && eqAt(d, spin, SPL_SPIN) };
  }
  var hits2 = findAll(d, SPL_NEW);
  for (i = 0; i < hits2.length; i++) {
    p = hits2[i];
    if (p >= 8 && eqAt(d, p - 4, SPL_PREV) && eqAt(d, p + 4, SPL_NEXT))
      return { pos: p, patched: true, spinOk: null };
  }
  throw new LocateError('splloader secure-boot call not found (' +
                        hits.length + ' raw hits, ' + good.length + ' contextual)');
}

/* ---------------- uboot lock gate ---------------- */
var UB_STRWZR = fromHex('3f9808b9');   /* str wzr, [x1, #2200]        */
var UB_MOV1 = 0x52800020, UB_STRW0 = 0xb9089820;

function findUbootLock(d) {
  var good = [], hits = findAll(d, UB_STRWZR), i, h;
  for (i = 0; i < hits.length; i++) {
    h = hits[i];
    if (h < 8 || h + 0x10 > d.length) continue;
    var wCbz = rd32(d, h - 4);
    if (!isCbzW0(wCbz)) continue;
    if ((h - 4) + cbzImm19(wCbz) * 4 !== h + 8) continue;
    var wB = rd32(d, h + 4);
    if (!isB(wB) || branchTargetW(wB, h + 4) !== h + 0x10) continue;
    if (rd32(d, h + 8) !== UB_MOV1) continue;
    if (rd32(d, h + 12) !== UB_STRW0) continue;
    good.push(h);
  }
  if (good.length === 1) return { pos: good[0] - 4, patched: false };
  if (good.length > 1)
    throw new LocateError('uboot lock gate ambiguous: ' + good.length + ' candidates');
  var pat = new Uint8Array(20);
  pat.set(NOP_BYTES, 0); pat.set(NOP_BYTES, 4); pat.set(NOP_BYTES, 8);
  UP.wr32(pat, 12, UB_MOV1); UP.wr32(pat, 16, UB_STRW0);
  var hits2 = findAll(d, pat);
  if (hits2.length === 1) return { pos: hits2[0], patched: true };
  throw new LocateError('uboot lock gate not found (raw str-wzr hits: ' +
                        hits.length + ', patched hits: ' + hits2.length + ')');
}

/* ---------------- trustos avb returns ---------------- */
var TR_PAIR = fromHex('bf030091e003142a');       /* mov sp,x29; mov w0,w20  */
var TR_NEXT = fromHex('f35341a9');               /* ldp x19,x20,[sp,#16]    */
var TR_NEW = fromHex('00008052');                /* mov w0,#0               */
var TR_PATCHED_PAIR = fromHex('bf03009100008052');

function findTrustos(d) {
  var good = [], hits = findAll(d, TR_PAIR), i;
  for (i = 0; i < hits.length; i++) {
    var q = hits[i] + 4;
    if (q + 8 > d.length) continue;
    if (!eqAt(d, q + 4, TR_NEXT)) continue;
    good.push(q);
  }
  if (good.length) return { sites: good, patched: false };
  var hits2 = findAll(d, TR_PATCHED_PAIR);
  if (hits2.length)
    return { sites: hits2.map(function (p) { return p + 4; }), patched: true };
  throw new LocateError('trustos avb returns not found (raw pair hits: ' + hits.length + ')');
}

/* ---------------- patch application ---------------- */
function patchSplloader(d, loc) {
  var b = d.slice();
  b.set(SPL_NEW, loc.pos);
  return b;
}
function patchLockOnly(d, lock) {
  var b = d.slice();
  b.set(NOP_BYTES, lock.pos);
  b.set(NOP_BYTES, lock.pos + 4);
  b.set(NOP_BYTES, lock.pos + 8);
  return b;
}
function patchTrustos(d, res) {
  var b = d.slice();
  for (var i = 0; i < res.sites.length; i++) b.set(TR_NEW, res.sites[i]);
  return b;
}

/* ---------------- verify ---------------- */
function verifySplloader(d) {
  try {
    var loc = findSplloader(d);
    if (!loc.patched) return { ok: false, note: 'site not patched' };
    return { ok: true, note: 'site ' + hexOff(loc.pos) + ' -> b #0x55dc' };
  } catch (e) { return { ok: false, note: String(e.message || e) }; }
}
function verifyUbootLock(d) {
  try {
    var lock = findUbootLock(d);
    if (!lock.patched) return { ok: false, note: 'lock gate not patched' };
    return { ok: true, note: 'lock ' + hexOff(lock.pos) + ' -> nop x3' };
  } catch (e) { return { ok: false, note: String(e.message || e) }; }
}
function verifyTrustos(d, expectSites) {
  try {
    var res = findTrustos(d);
    if (!res.patched) return { ok: false, note: 'sites not patched' };
    if (res.sites.length !== expectSites)
      return { ok: false, note: 'site count ' + res.sites.length + ' != ' + expectSites };
    return { ok: true, note: res.sites.length + ' sites -> mov w0,#0' };
  } catch (e) { return { ok: false, note: String(e.message || e) }; }
}

/* ---------------- diff audit ---------------- */
function diffZones(a, b) {
  var zones = [];
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      var last = zones.length ? zones[zones.length - 1] : null;
      if (last && i <= last[1]) last[1] = i + 1;
      else zones.push([i, i + 1]);
    }
  }
  return zones;
}
function auditZones(base, prod, allowed) {
  var zones = diffZones(base, prod), outside = 0, i, j;
  for (i = 0; i < zones.length; i++) {
    var s = zones[i][0], e = zones[i][1], ok = false;
    for (j = 0; j < allowed.length; j++) {
      if (s >= allowed[j][0] && e <= allowed[j][1]) { ok = true; break; }
    }
    if (!ok) outside += e - s;
  }
  return { ok: outside === 0, zones: zones, outside: outside };
}
function countBytes(zones) {
  var n = 0;
  for (var i = 0; i < zones.length; i++) n += zones[i][1] - zones[i][0];
  return n;
}

UP.LocateError = LocateError;
UP.findSplloader = findSplloader;
UP.findUbootLock = findUbootLock;
UP.findTrustos = findTrustos;
UP.patchSplloader = patchSplloader;
UP.patchLockOnly = patchLockOnly;
UP.patchTrustos = patchTrustos;
UP.verifySplloader = verifySplloader;
UP.verifyUbootLock = verifyUbootLock;
UP.verifyTrustos = verifyTrustos;
UP.diffZones = diffZones;
UP.auditZones = auditZones;
UP.countBytes = countBytes;

})(typeof self !== 'undefined' ? self : this);

/* ================================================== part 3: banners */
(function (root) {
'use strict';
var UP = (typeof module !== 'undefined' && module.exports)
       ? module.exports
       : (root.UP84 = root.UP84 || {});

var enc = function (s) { return new TextEncoder().encode(s); };
var NL = String.fromCharCode(10);
var NUL = String.fromCharCode(0);
var BS = String.fromCharCode(92);

var WARN_ANCHOR = enc('info failed!' + NL + NUL);
var WARN_TAIL = enc('pass_chip_uid_to_tos');
var INFO_TAIL = enc('charger' + NUL);
var INFO_SLOT = 36;

var FACTORY_WARN = enc('WARNNING: LOCK FLAG IS : UNLOCK, SKIP VERIFY!!!' + NL);
var FACTORY_INFO = enc(NL + '   INFO: LOCK FLAG IS : UNLOCK!!!' + NL);
var DUNOGUANG_WARN = enc('QQ:3981750101' + NL + 'Boot Format OK, Kernel Started...' + NL);
var DUNOGUANG_INFO = enc('SPRD U-Boot - Patch By Dunoguang  ' + NL);

function BannerError(msg) { this.message = msg; }
BannerError.prototype = Object.create(Error.prototype);
BannerError.prototype.name = 'BannerError';

function findSub(hay, needle, from, to) {
  from = from || 0;
  to = (to === undefined) ? hay.length : to;
  var limit = Math.min(to, hay.length) - needle.length;
  outer: for (var i = from; i <= limit; i++) {
    for (var j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
function firstZero(hay, from, to) {
  to = (to === undefined) ? hay.length : to;
  for (var i = from; i < to; i++) if (hay[i] === 0) return i;
  return -1;
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function findWarn(d) {
  var off = 0;
  for (;;) {
    var p = findSub(d, WARN_ANCHOR, off);
    if (p < 0) break;
    var w = p + WARN_ANCHOR.length;
    var pcp = findSub(d, WARN_TAIL, w, w + 128);
    if (pcp >= 0 && pcp - w >= 4 && pcp - w <= 64) {
      var end = firstZero(d, w, pcp);
      if (end >= 0) {
        return { start: w, slot: pcp - w, text: d.slice(w, end), anchor: 'neighbour' };
      }
    }
    off = p + 1;
  }
  var s = findSub(d, enc('WARNNING: LOCK FLAG IS'), 0);
  if (s < 0) s = findSub(d, enc('WARNNING'), 0);
  if (s >= 0) {
    var e2 = firstZero(d, s, d.length);
    if (e2 > s) return { start: s, slot: e2 - s + 1, text: d.slice(s, e2), anchor: 'text' };
  }
  throw new BannerError('warn banner slot not found');
}

function findInfo(d) {
  var cands = [], off = 0;
  for (;;) {
    var cp = findSub(d, INFO_TAIL, off);
    if (cp < 0) break;
    var s = cp - INFO_SLOT;
    if (s >= 1 && d[cp - 1] === 0 && d[s - 1] === 0) {
      cands.push({ s: s, cp: cp, pref: d[s] === 0x0a });
    }
    off = cp + 1;
  }
  if (cands.length) {
    var pref = cands.filter(function (c) { return c.pref; });
    var use = null;
    if (pref.length === 1) use = pref[0];
    else if (!pref.length && cands.length === 1) use = cands[0];
    if (!use)
      throw new BannerError('info slot ambiguous (' + cands.length +
                            ' candidates, ' + pref.length + ' pref)');
    var end = firstZero(d, use.s, use.cp);
    if (end < 0 || end > use.cp - 1) end = use.cp - 1;
    return { start: use.s, slot: use.cp - use.s,
             text: d.slice(use.s, end), anchor: 'neighbour' };
  }
  var p = findSub(d, enc('INFO: LOCK FLAG IS'), 0);
  if (p >= 4 && findSub(d, enc(NL + '   '), p - 4) === p - 4) p -= 4;
  if (p >= 0) {
    var e2 = firstZero(d, p, d.length);
    if (e2 > p) return { start: p, slot: e2 - p + 1, text: d.slice(p, e2), anchor: 'text' };
  }
  throw new BannerError('info banner slot not found');
}

function stateOf(text, factory, dunoguang) {
  if (bytesEqual(text, factory)) return 'factory';
  if (bytesEqual(text, dunoguang)) return 'dunoguang';
  return 'modified';
}

function findBanners(d) {
  var warn = findWarn(d), info = findInfo(d);
  warn.state = stateOf(warn.text, FACTORY_WARN, DUNOGUANG_WARN);
  info.state = stateOf(info.text, FACTORY_INFO, DUNOGUANG_INFO);
  return { warn: warn, info: info };
}

function unescapeText(s) {
  var out = '', i = 0;
  while (i < s.length) {
    var c = s[i];
    if (c === BS && i + 1 < s.length) {
      var n = s[i + 1];
      if (n === 'n') { out += NL; i += 2; continue; }
      if (n === 'r') { out += String.fromCharCode(13); i += 2; continue; }
      if (n === 't') { out += String.fromCharCode(9); i += 2; continue; }
      if (n === BS) { out += BS; i += 2; continue; }
    }
    out += c; i += 1;
  }
  return out;
}

function textToBytes(s, slotSize, flag) {
  var b = enc(unescapeText(s));
  if (b.length > slotSize - 1)
    throw new BannerError(flag + ' text is ' + b.length + ' bytes, but this slot ' +
                          'holds at most ' + (slotSize - 1) + ' (+1 NUL); shorten by ' +
                          (b.length - (slotSize - 1)) + ' byte(s)');
  return b;
}

function applyText(d, slot, textBytes, flag) {
  var cap = slot.slot - 1;
  if (textBytes.length > cap)
    throw new BannerError(flag + ' text is ' + textBytes.length + ' bytes, but this slot ' +
                          'holds at most ' + cap + ' (+1 NUL); shorten by ' +
                          (textBytes.length - cap) + ' byte(s)');
  var b = d.slice();
  b.fill(0, slot.start, slot.start + slot.slot);
  b.set(textBytes, slot.start);
  return b;
}

UP.BannerError = BannerError;
UP.enc = enc;
UP.findSub = findSub;
UP.bytesEqual = bytesEqual;
UP.findWarn = findWarn;
UP.findInfo = findInfo;
UP.findBanners = findBanners;
UP.stateOf = stateOf;
UP.unescapeText = unescapeText;
UP.textToBytes = textToBytes;
UP.applyText = applyText;
UP.FACTORY_WARN = FACTORY_WARN;
UP.FACTORY_INFO = FACTORY_INFO;
UP.DUNOGUANG_WARN = DUNOGUANG_WARN;
UP.DUNOGUANG_INFO = DUNOGUANG_INFO;

})(typeof self !== 'undefined' ? self : this);

/* ================================================== part 4: usblog finder */
(function (root) {
'use strict';
var UP = (typeof module !== 'undefined' && module.exports)
       ? module.exports
       : (root.UP84 = root.UP84 || {});
var rd32 = UP.rd32, hexOff = UP.hexOff, decPair = UP.decPair,
    branchTarget = UP.branchTarget, isWild = UP.isWild, blTarget = UP.blTarget,
    findSub = UP.findSub, enc = UP.enc;

var BASE = 0x9efffe00;
var DEAD_SIZE = 0x2a4;
var DEAD_LAYOUT = [
  ['FLAG', 0], ['S1', 4], ['LOG', 0x18], ['HOOK', 0x68], ['PUMP', 0x8c],
  ['GATE_WAIT', 0xcc], ['S2', 0x11c], ['LOG2', 0x14c], ['DEAD_END', DEAD_SIZE]
];
var RIGID = [['RET1', -4], ['FORCE_PORT', -0x48], ['PUMP_CALL', 0x188], ['REPLY', 0x154]];

function FindError(msg) { this.message = msg; }
FindError.prototype = Object.create(Error.prototype);
FindError.prototype.name = 'FindError';

var TEMPLATES = null;
function setTemplates(t) { TEMPLATES = t; }
function getTemplates() {
  if (TEMPLATES) return TEMPLATES;
  if (UP.TEMPLATES) { TEMPLATES = UP.TEMPLATES; return TEMPLATES; }
  var r = (typeof self !== 'undefined') ? self : globalThis;
  if (r.TEMPLATES_DW99) { TEMPLATES = r.TEMPLATES_DW99; return TEMPLATES; }
  throw new FindError('usblog templates are not loaded');
}

function templateCandidates(d, blk, topn) {
  topn = topn || 8;
  var off0 = parseInt(blk.off, 16);
  var pat = blk.hex.trim().split(/\s+/).map(function (x) { return parseInt(x, 16); });
  var n = pat.length;
  var runs = [], i = 0;
  while (i < n) {
    if (!isWild(pat[i])) {
      var j = i;
      while (j < n && !isWild(pat[j])) j++;
      if (j - i >= 3) runs.push([i, j]);
      i = j;
    } else i++;
  }
  var votes = {};
  for (var r = 0; r < runs.length; r++) {
    var i0 = runs[r][0], j0 = runs[r][1];
    var seg = new Uint8Array((j0 - i0) * 4);
    for (var t = 0; t < j0 - i0; t++) UP.wr32(seg, t * 4, pat[i0 + t]);
    var start = 0;
    for (;;) {
      var k = findSub(d, seg, start);
      if (k < 0) break;
      if (k % 4 === 0) {
        var delta = k - off0 - 4 * i0;
        votes[delta] = (votes[delta] || 0) + (j0 - i0);
      }
      start = k + 4;
    }
  }
  var arr = [];
  for (var key in votes) arr.push([parseInt(key, 10), votes[key]]);
  arr.sort(function (a, b) { return b[1] - a[1]; });
  var out = [];
  for (var q = 0; q < Math.min(topn, arr.length); q++) {
    var delta2 = arr[q][0], sup = arr[q][1];
    var s0 = off0 + delta2;
    if (s0 < 0 || s0 + 4 * n > d.length) continue;
    var sc = 0, tot = 0;
    for (var k2 = 0; k2 < n; k2++) {
      if (isWild(pat[k2])) continue;
      tot += 1;
      if (rd32(d, s0 + 4 * k2) === pat[k2]) sc += 1;
    }
    out.push({ off: s0, delta: delta2, support: sup, score: sc, tot: tot,
               frac: tot ? sc / tot : 0 });
  }
  return out;
}

function scanRefs(d) {
  var brs = [];
  for (var o = 0x200; o < d.length - 4; o += 4) {
    var t = branchTarget(d, o, BASE);
    if (t !== null) brs.push([o, t]);
  }
  var ptrs = {};
  for (var o2 = 0x200; o2 < d.length - 8; o2++) {
    var lo = (d[o2] | (d[o2 + 1] << 8) | (d[o2 + 2] << 16) | (d[o2 + 3] << 24)) >>> 0;
    if (lo < 0x9e000000 || lo >= 0xa0000000) continue;
    var hi = (d[o2 + 4] | (d[o2 + 5] << 8) | (d[o2 + 6] << 16) | (d[o2 + 7] << 24)) >>> 0;
    if (hi === 0) ptrs[lo] = true;
  }
  return [brs, ptrs];
}

function deadZoneClean(brs, ptrs, loOff, size) {
  size = (size === undefined) ? DEAD_SIZE + 4 : size;
  var lo = loOff + BASE, hi = loOff + BASE + size;
  for (var i = 0; i < brs.length; i++) {
    var o = brs[i][0], t = brs[i][1];
    if (t >= lo && t < hi && !(o + BASE >= lo && o + BASE < hi))
      return { ok: false, why: 'branch ' + hexOff(o) + ' -> ' + hexOff(t) };
  }
  for (var key in ptrs) {
    var v = parseInt(key, 10);
    if (v >= lo && v < hi) return { ok: false, why: 'ptr ' + hexOff(v) };
  }
  return { ok: true, why: '' };
}

function locate(d, log) {
  log = log || function () {};
  var t = getTemplates();
  var res = {};

  /* 1. TRIG via the console string */
  var sstr = enc(t.string_anchor);
  var s = findSub(d, sstr, 0);
  if (s < 0) throw new FindError('anchor string not found: ' + t.string_anchor);
  var sva = s + BASE;
  var sites = [], cands = [];
  for (var o = 0x200; o < d.length - 8; o += 4)
    if (decPair(d, o, BASE) === sva) sites.push(o);
  for (var si = 0; si < sites.length; si++)
    for (var k = 4; k < 0x40; k += 4)
      if ((rd32(d, sites[si] + k) >>> 26) === 0x25) { cands.push(sites[si] + k); break; }
  var good = [];
  for (var ci = 0; ci < cands.length; ci++) {
    var c = cands[ci];
    var ok1 = c >= 4 && rd32(d, c - 4) === 0x52800033;
    var ok2 = c >= 0x48 && rd32(d, c - 0x48) === 0x350001c0;
    good.push([c, ok1, ok2]);
  }
  var sel = good.filter(function (g) { return g[1] && g[2]; });
  if (sel.length !== 1)
    throw new FindError('TRIG not unique (' + sel.length + '/' + good.length + ' pass)');
  var TRIG = sel[0][0];
  res.TRIG = TRIG;
  log('  TRIG        ' + hexOff(TRIG));

  /* 2. rigid deltas */
  for (var ri = 0; ri < RIGID.length; ri++) res[RIGID[ri][0]] = TRIG + RIGID[ri][1];
  if (rd32(d, res.RET1) !== 0x52800033)
    throw new FindError('RET1 at ' + hexOff(res.RET1) + ' is not mov w19,#1');
  if (rd32(d, res.FORCE_PORT) !== 0x350001c0)
    throw new FindError('FORCE_PORT at ' + hexOff(res.FORCE_PORT) + ' is not cbnz w0,+0x38');
  if ((rd32(d, res.PUMP_CALL) >>> 26) !== 0x25)
    throw new FindError('PUMP_CALL at ' + hexOff(res.PUMP_CALL) + ' is not a bl');

  /* 3. bl-target chain */
  res.PRINTF = blTarget(d, TRIG, BASE);
  res.STOCK_PUMP = blTarget(d, res.PUMP_CALL, BASE);
  if (res.PRINTF === null || res.STOCK_PUMP === null)
    throw new FindError('bl decode failed at TRIG/PUMP_CALL');

  /* 4. FLAG_TX / PORTFLAG */
  var spFile = res.STOCK_PUMP - BASE;
  var refs = [];
  for (var k3 = 0; k3 < 0x80; k3 += 4) {
    var v = decPair(d, spFile + k3, BASE);
    if (v !== null) refs.push(v);
  }
  refs = Array.from(new Set(refs)).sort(function (a, b) { return a - b; });
  var pairs = [];
  for (var i2 = 0; i2 < refs.length - 1; i2++)
    if (refs[i2 + 1] - refs[i2] === 0x80) pairs.push([refs[i2], refs[i2 + 1]]);
  if (pairs.length !== 1)
    throw new FindError('pump ref pattern not unique (' + pairs.length + ' pairs)');
  res.FLAG_TX = pairs[0][0];
  res.PORTFLAG = pairs[0][0] + 0x78;

  /* 5. code templates */
  function pick(name, fracMin, extra) {
    var cs = templateCandidates(d, t.blocks[name]);
    for (var i = 0; i < cs.length; i++)
      if (cs[i].frac >= fracMin && (!extra || extra(cs[i].off))) return cs[i];
    throw new FindError(name + ': no candidate passed (frac>=' + fracMin + ')');
  }
  var puts = pick('puts', 0.85, function (o) { return rd32(d, o) === 0xa9bf7bfd; });
  res.PUTS = puts.off;
  res.PUTS_BODY = puts.off + 4;
  var gt = pick('gettimer', 0.9);
  res.GETTIMER = gt.off + BASE;
  var irq = pick('irq', 0.8);
  res.IRQ = irq.off + BASE;
  var rpcs = templateCandidates(d, t.blocks.reply);
  var rpRel = (t.blocks.reply.anchor_rel !== undefined) ? t.blocks.reply.anchor_rel : 0x14;
  var rpHit = rpcs.filter(function (c2) { return c2.off + rpRel === res.REPLY; });
  if (!rpHit.length)
    throw new FindError('reply template does not confirm REPLY=' + hexOff(res.REPLY));

  /* 6. dead zone */
  var sr = scanRefs(d);
  var brs = sr[0], ptrs = sr[1];
  var dead = null;
  var dcands = templateCandidates(d, t.blocks.dead, 12);
  for (var di = 0; di < dcands.length; di++) {
    var oo = dcands[di].off;
    if (oo + DEAD_SIZE + 4 > d.length) continue;
    var retOk = rd32(d, oo + DEAD_SIZE) === 0xd65f03c0;
    var clean = deadZoneClean(brs, ptrs, oo);
    if (clean.ok && retOk) { dead = dcands[di]; break; }
  }
  if (!dead) throw new FindError('dead zone not found');
  var FLAG = dead.off;
  for (var li = 0; li < DEAD_LAYOUT.length; li++)
    res[DEAD_LAYOUT[li][0]] = FLAG + DEAD_LAYOUT[li][1];
  res.HOOK_BL = res.HOOK + 0x0c;
  log('  dead zone   ' + hexOff(FLAG) + '..' + hexOff(res.DEAD_END));
  return res;
}

function detectUsblog(d) {
  var t = getTemplates();
  var sstr = enc(t.string_anchor);
  var s = findSub(d, sstr, 0);
  if (s < 0) throw new FindError('anchor string not found: ' + t.string_anchor);
  var sva = s + BASE;
  var sites = [], cands = [];
  for (var o = 0x200; o < d.length - 8; o += 4)
    if (decPair(d, o, BASE) === sva) sites.push(o);
  for (var si = 0; si < sites.length; si++)
    for (var k = 4; k < 0x40; k += 4)
      if ((rd32(d, sites[si] + k) >>> 26) === 0x25) { cands.push(sites[si] + k); break; }
  var good = [];
  for (var ci = 0; ci < cands.length; ci++) {
    var c = cands[ci];
    if (c < 0x48 || c + 4 > d.length) continue;
    var w1 = rd32(d, c - 4), w2 = rd32(d, c - 0x48);
    var ok1 = w1 === 0x52800033 || w1 === 0x52800013;
    var ok2 = w2 === 0x350001c0 || w2 === 0x1400000e;
    if (ok1 && ok2) good.push([c, w1, w2]);
  }
  if (good.length !== 1)
    throw new FindError('TRIG probe not unique (' + good.length + ' of ' +
                        cands.length + ' candidates)');
  var c2 = good[0][0], w1b = good[0][1], w2b = good[0][2];
  var state = (w1b === 0x52800033 && w2b === 0x350001c0) ? 'clean'
            : (w1b === 0x52800013 && w2b === 0x1400000e) ? 'injected' : 'unknown';
  return { state: state, TRIG: c2, RET1_word: w1b, FORCE_word: w2b };
}

UP.FindError = FindError;
UP.setTemplates = setTemplates;
UP.getTemplates = getTemplates;
UP.templateCandidates = templateCandidates;
UP.scanRefs = scanRefs;
UP.deadZoneClean = deadZoneClean;
UP.locate = locate;
UP.detectUsblog = detectUsblog;

})(typeof self !== 'undefined' ? self : this);

/* ================================================== part 5: usblog builder + verify */
(function (root) {
'use strict';
var UP = (typeof module !== 'undefined' && module.exports)
       ? module.exports
       : (root.UP84 = root.UP84 || {});
var u32 = UP.u32, rd32 = UP.rd32, wr32 = UP.wr32, hexOff = UP.hexOff,
    bl_ = UP.bl_, b_ = UP.b_, adrp = UP.adrp, addImm = UP.addImm, addX = UP.addX,
    subX = UP.subX, cmpX = UP.cmpX, subsWImm = UP.subsWImm, subsImmX = UP.subsImmX,
    movzW = UP.movzW, movzX = UP.movzX, ldrWImm = UP.ldrWImm, ldrXImm = UP.ldrXImm,
    strXImm = UP.strXImm, ldrbImm = UP.ldrbImm, strbImm = UP.strbImm,
    cbzW = UP.cbzW, cbzX = UP.cbzX, cbnzW = UP.cbnzW, bNe = UP.bNe,
    bCond = UP.bCond, movX = UP.movX, decPair = UP.decPair,
    branchTarget = UP.branchTarget;

var BASE = 0x9efffe00;
var CHUNK = 63;
var BUDGET = 10000;
var WAIT_MS = 20000;

function BuildError(msg) { this.message = msg; }
BuildError.prototype = Object.create(Error.prototype);
BuildError.prototype.name = 'BuildError';

function va(f) { return BASE + f; }

function s1Code(a) {
  return [adrp(1, va(a.S1), va(a.FLAG)),
          addImm(1, 1, va(a.FLAG) & 0xfff),
          0xd2800022, 0x39000022, b_(va(a.S1 + 0x10), a.PRINTF)];
}

function logCode(a) {
  var LOG = a.LOG;
  return [0xa9bd7bfd, 0x910003fd, 0xf9000be0,
          adrp(1, va(LOG + 0x0c), va(a.FLAG)),
          addImm(1, 1, va(a.FLAG) & 0xfff),
          0x39400021, cbzW(1, 12),
          0x3900003f, 0xd2800001,
          0x38616802, cbzW(2, 3),
          0x91000421, b_(va(LOG + 0x30), va(LOG + 0x24)),
          bl_(va(LOG + 0x34), va(a.REPLY)),
          adrp(1, va(LOG + 0x3c), va(a.FLAG)),
          addImm(1, 1, va(a.FLAG) & 0xfff),
          0xd2800022, 0x39000022, 0xa8c37bfd, 0xd65f03c0];
}

function hookCode(a) {
  return [0xa9bf7bfd, 0xa9be7bfd, 0xf9000be0,
          bl_(va(a.HOOK + 0x0c), va(a.LOG)),
          0xf9400be0, 0xa8c27bfd, b_(va(a.HOOK + 0x18), va(a.PUTS_BODY))];
}

function pumpCode(a) {
  var LOOP = 6, DONE = 11, PUMP = a.PUMP;
  return [0xa9be7bfd, 0x910003fd, 0xa90153f3,
          adrp(19, va(PUMP + 3 * 4), a.FLAG_TX & ~0xfff),
          addImm(19, 19, a.FLAG_TX & 0xfff),
          movzW(20, BUDGET),
          ldrWImm(0, 19, 0),
          cbnzW(0, DONE - 7),
          bl_(va(PUMP + 8 * 4), a.IRQ),
          subsWImm(20, 20, 1),
          bNe(LOOP - 10),
          strWImm31_0(19),
          0xa94153f3, 0xa8c27bfd, 0xd65f03c0];
}
function strWImm31_0(rn) { return u32(0xb9000000 | (rn << 5) | 31); }

function gateWaitCode(a) {
  var LO = 9, DONE = 16, GATE_WAIT = a.GATE_WAIT;
  return [0xa9bd7bfd, 0x910003fd, 0xa90153f3, 0xf90013f5,
          adrp(20, va(GATE_WAIT + 4 * 4), a.PORTFLAG & ~0xfff),
          addImm(20, 20, a.PORTFLAG & 0xfff),
          movzX(21, WAIT_MS),
          bl_(va(GATE_WAIT + 7 * 4), a.GETTIMER),
          movX(19, 0),
          ldrWImm(0, 20, 0),
          cbnzW(0, DONE - 10),
          bl_(va(GATE_WAIT + 11 * 4), a.IRQ),
          bl_(va(GATE_WAIT + 12 * 4), a.GETTIMER),
          subX(0, 0, 19),
          cmpX(0, 21),
          bCond(LO - 15, 3),
          0xa94153f3, 0xf94013f5, 0xa8c37bfd, 0xd65f03c0];
}

function s2Code(a) {
  var S2 = a.S2;
  return [0xa9be7bfd, 0x910003fd, 0xf9000be0,
          bl_(va(S2 + 3 * 4), va(a.GATE_WAIT)),
          0xf9400be0, 0xa8c27bfd,
          adrp(1, va(S2 + 6 * 4), va(a.FLAG) & ~0xfff),
          addImm(1, 1, va(a.FLAG) & 0xfff),
          0xd2800022,
          strbImm(2, 1, 0),
          b_(va(S2 + 10 * 4), a.PRINTF)];
}

function log2Code(a) {
  var EPI = 34, STRLEN = 14, STRLEN_DONE = 19, SEND = 20, SEND_DONE = 32;
  var USE_REM = 25, HAVE = 26;
  var LOG2 = a.LOG2;
  function V(k) { return va(LOG2 + k * 4); }
  return [0xa9bc7bfd, 0x910003fd, 0xa90153f3, 0xa9025bf5,
          strXImm(23, 31, 0x30 / 8),
          adrp(1, V(5), va(a.FLAG)),
          addImm(1, 1, va(a.FLAG) & 0xfff),
          ldrbImm(2, 1, 0),
          cbzW(2, EPI - 8),
          strbImm(31, 1, 0),
          movX(23, 1),
          movX(22, 0),
          movX(19, 0),
          0xd2800014,
          ldrbImm(2, 19, 0),
          cbzW(2, STRLEN_DONE - 15),
          addImm(19, 19, 1),
          addImm(20, 20, 1),
          b_(V(18), V(STRLEN)),
          movX(19, 22),
          cbzX(20, SEND_DONE - 20),
          movzX(21, CHUNK),
          subsImmX(31, 20, CHUNK),
          bCond(USE_REM - 23, 9),
          b_(V(24), V(HAVE)),
          movX(21, 20),
          movX(0, 19),
          movX(1, 21),
          bl_(V(28), va(a.REPLY)),
          addX(19, 19, 21),
          subX(20, 20, 21),
          b_(V(31), V(SEND)),
          0xd2800022,
          strbImm(2, 23, 0),
          ldrXImm(23, 31, 0x30 / 8),
          0xa9425bf5, 0xa94153f3, 0xa8c47bfd, 0xd65f03c0];
}

function put(d, off, words) {
  for (var i = 0; i < words.length; i++) wr32(d, off + i * 4, words[i]);
}

function buildUsblog(baseBytes, a, dhtb30) {
  var d = baseBytes.slice();
  if (rd32(d, 0x30) !== dhtb30)
    throw new BuildError('[0x30] mismatch');
  if (rd32(d, a.PUTS) !== 0xa9bf7bfd)
    throw new BuildError('puts prologue @' + hexOff(a.PUTS));
  if (rd32(d, a.TRIG) !== bl_(va(a.TRIG), a.PRINTF))
    throw new BuildError('TRIG @' + hexOff(a.TRIG) + ' is not bl PRINTF');
  if (rd32(d, a.PUMP_CALL) !== bl_(va(a.PUMP_CALL), a.STOCK_PUMP))
    throw new BuildError('PUMP_CALL @' + hexOff(a.PUMP_CALL) + ' is not bl STOCK_PUMP');
  if (rd32(d, a.RET1) !== 0x52800033)
    throw new BuildError('RET1 @' + hexOff(a.RET1) + ' is not mov w19,#1');
  if (rd32(d, a.FORCE_PORT) !== 0x350001c0)
    throw new BuildError('FORCE_PORT @' + hexOff(a.FORCE_PORT) + ' is not cbnz w0,+0x38');

  wr32(d, a.FLAG, 0);
  put(d, a.S1, s1Code(a));
  put(d, a.LOG, logCode(a));
  put(d, a.HOOK, hookCode(a));
  wr32(d, a.PUTS, b_(va(a.PUTS), va(a.HOOK)));
  wr32(d, a.TRIG, bl_(va(a.TRIG), va(a.S1)));

  put(d, a.PUMP, pumpCode(a));
  wr32(d, a.PUMP_CALL, bl_(va(a.PUMP_CALL), va(a.PUMP)));
  wr32(d, a.RET1, 0x52800013);
  wr32(d, a.FORCE_PORT, 0x1400000e);

  put(d, a.GATE_WAIT, gateWaitCode(a));
  put(d, a.S2, s2Code(a));
  wr32(d, a.TRIG, bl_(va(a.TRIG), va(a.S2)));

  if (d[a.FLAG] !== 0)
    throw new BuildError('gate byte is not zero');
  if (rd32(d, a.HOOK_BL) !== bl_(va(a.HOOK_BL), va(a.LOG)))
    throw new BuildError('HOOK_BL @' + hexOff(a.HOOK_BL) + ' is not bl LOG');
  put(d, a.LOG2, log2Code(a));
  wr32(d, a.HOOK_BL, bl_(va(a.HOOK_BL), va(a.LOG2)));
  if (a.LOG2 + log2Code(a).length * 4 > a.DEAD_END)
    throw new BuildError('injected code overruns the dead function');
  return d;
}

/* ---- verify (disassembly walk) ---- */
var BLOCK_SPEC = [['bounded pump', 'PUMP', 15], ['usb_gate_wait', 'GATE_WAIT', 20],
                  ['trigger stub S2', 'S2', 11], ['log fn LOG2', 'LOG2', 39],
                  ['puts hook', 'HOOK', 7]];
var GATE_ADDS = [['S1', 4], ['LOG', 0x10], ['LOG', 0x3c], ['S2', 0x1c], ['LOG2', 0x18]];

function v2f(v) { return (v - 0x9f000000) + 0x200; }

function verifyUsblog(d, a, dhtb30, expectedLen, expectedMd5) {
  var bad = 0, lines = [];
  function log(s) { lines.push(s); }
  function check(ok, msg) {
    log((ok ? 'ok   ' : 'FAIL ') + msg);
    if (!ok) bad += 1;
  }
  var hash = UP.md5(d);
  log(d.length + ' bytes   md5 ' + hash);
  check(rd32(d, 0x30) === dhtb30, '[0x30] == ' + hexOff(dhtb30));
  if (expectedLen !== undefined && expectedLen !== null)
    check(d.length === expectedLen, 'length == ' + expectedLen);
  if (expectedMd5) check(hash === expectedMd5, 'md5 == ' + expectedMd5);

  check(rd32(d, a.PUTS) === b_(va(a.PUTS), va(a.HOOK)), 'puts entry -> hook');
  check(rd32(d, a.TRIG) === bl_(va(a.TRIG), va(a.S2)), 'TRIG -> S2');
  check(rd32(d, a.PUMP_CALL) === bl_(va(a.PUMP_CALL), va(a.PUMP)), 'PUMP_CALL -> bounded pump');
  check(rd32(d, a.RET1) === 0x52800013, 'RET1 = mov w19,#0');
  check(rd32(d, a.FORCE_PORT) === 0x1400000e, 'FORCE_PORT = b +0x38');
  check(rd32(d, a.HOOK_BL) === bl_(va(a.HOOK_BL), va(a.LOG2)), 'HOOK_BL -> LOG2');

  var want = va(a.FLAG) & 0xfff;
  log('  gate address in every adrp/add pair must be ' + hexOff(want) + ' (VA low 12 bits)');
  for (var gi = 0; gi < GATE_ADDS.length; gi++) {
    var off = a[GATE_ADDS[gi][0]] + GATE_ADDS[gi][1];
    var w = rd32(d, off);
    var imm = (w >>> 10) & 0xfff;
    check(u32(w & 0xffc00000) === 0x91000000 && imm === want,
          GATE_ADDS[gi][0] + '+' + hexOff(GATE_ADDS[gi][1]) + ' add ...' + hexOff(imm));
  }
  check(d[a.FLAG] === 0, 'gate byte is zero');

  log('  disassembly walk');
  for (var bi = 0; bi < BLOCK_SPEC.length; bi++) {
    var name = BLOCK_SPEC[bi][0], key = BLOCK_SPEC[bi][1], n = BLOCK_SPEC[bi][2];
    var boff = a[key], bend = boff + n * 4;
    if (bend > a.DEAD_END) { check(false, name + ' overruns the dead function'); continue; }
    log('  --- ' + name + ' @ file ' + hexOff(boff) + ' ---');
    var k = 0;
    while (k < n) {
      var ioff = boff + k * 4;
      var tt = branchTarget(d, ioff, BASE);
      if (tt === null && k + 1 < n) {
        var pt = decPair(d, ioff, BASE);
        if (pt !== null) {
          check(pt === va(a.FLAG) || pt === a.FLAG_TX || pt === a.PORTFLAG,
                hexOff(va(ioff)) + ' adrp/add -> ' + hexOff(pt));
          k += 2;
          continue;
        }
      }
      if (tt !== null) {
        var inside = (va(a.FLAG) <= tt && tt < va(a.DEAD_END) + 4) ||
                     tt === a.PRINTF || tt === a.GETTIMER || tt === a.IRQ ||
                     tt === va(a.PUTS_BODY) || v2f(tt) === a.REPLY;
        check(inside, hexOff(va(ioff)) + ' branch -> file ' + hexOff(v2f(tt)));
      }
      k += 1;
    }
  }
  log(bad ? 'FAILURES: ' + bad : 'OK - image looks correct');
  return { bad: bad, lines: lines };
}

UP.va = va;
UP.CHUNK = CHUNK; UP.BUDGET = BUDGET; UP.WAIT_MS = WAIT_MS;
UP.buildUsblog = buildUsblog;
UP.verifyUsblog = verifyUsblog;

})(typeof self !== 'undefined' ? self : this);
