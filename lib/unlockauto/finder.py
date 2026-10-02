"""Automatic locators for the three unlock patch sites and the two banners.

Byte-level evidence only (mirrors the uboot-usblog auto/ philosophy):

  splloader   bl #0x6740 call site  <- unique 'bl +0x1280' byte pattern,
                                       triple-anchored by the 'bl back'
                                       instruction right before it and the
                                       'mov x1,#0xfe00' right after it.
  uboot lock  str wzr,[x1,#2200]    <- five-instruction gate pattern
                                       (cbz w0 / str wzr / b / mov w0,#1 /
                                       str w0), all cross-checked.
  trustos     'mov sp,x29; mov w0,w20' pair <- exactly twice in every known
                                       build; the patch site is the second
                                       word of the pair.

Banners are located by their text and measured to the NUL terminator;
their ADRP+ADD reference sites are reported as cross-checks.
"""

import struct
from . import aarch64 as A


class LocateError(Exception):
    pass


# ---------------- splloader ----------------
SPL_OLD = bytes.fromhex('a0040094')    # bl  #0x6740 (secure-boot check call)
SPL_NEW = bytes.fromhex('47000014')    # b   #0x55dc (skip the check chain)
SPL_PREV = bytes.fromhex('b9ffff97')   # bl back (target 0x53a0), directly before
SPL_NEXT = bytes.fromhex('01c09fd2')   # mov x1, #0xfe00 (0xd29fc001 LE), directly after
SPL_SPIN = bytes.fromhex('00000014')   # b . (fail spin), at site + 0x118


def find_splloader(d):
    good = []
    for p in A.find_all(d, SPL_OLD):
        if p < 8 or p + 8 > len(d):
            continue
        if bytes(d[p-4:p]) != SPL_PREV:
            continue
        if bytes(d[p+4:p+8]) != SPL_NEXT:
            continue
        good.append(p)
    if len(good) == 1:
        p = good[0]
        spin = p + 0x118
        spin_ok = (spin + 4 <= len(d)) and bytes(d[spin:spin+4]) == SPL_SPIN
        return {'pos': p, 'patched': False, 'spin_ok': spin_ok}
    for p in A.find_all(d, SPL_NEW):
        if p >= 8 and bytes(d[p-4:p]) == SPL_PREV and bytes(d[p+4:p+8]) == SPL_NEXT:
            return {'pos': p, 'patched': True, 'spin_ok': None}
    raise LocateError('splloader secure-boot call not found '
                      '(%d raw hits, %d contextual)' % (len(A.find_all(d, SPL_OLD)), len(good)))


# ---------------- uboot lock gate ----------------
UB_STRWZR = bytes.fromhex('3f9808b9')  # str wzr, [x1, #2200]
UB_MOV1 = 0x52800020                   # mov w0, #1
UB_STRW0 = 0xB9089820                  # str w0, [x1, #2200]
UB_PATCHED = (A.NOP_BYTES * 3 + struct.pack('<I', UB_MOV1) + struct.pack('<I', UB_STRW0))


def find_uboot_lock(d):
    good = []
    for h in A.find_all(d, UB_STRWZR):
        if h < 8 or h + 0x10 > len(d):
            continue
        w_cbz = A.rd32(d, h - 4)
        if not A.is_cbz_w0(w_cbz):
            continue
        if (h - 4) + (A.cbz_imm19(w_cbz) << 2) != h + 8:
            continue
        w_b = A.rd32(d, h + 4)
        if not A.is_b(w_b) or A.branch_target(w_b, h + 4) != h + 0x10:
            continue
        if A.rd32(d, h + 8) != UB_MOV1:
            continue
        if A.rd32(d, h + 0xC) != UB_STRW0:
            continue
        good.append(h)
    if len(good) == 1:
        return {'pos': good[0] - 4, 'patched': False}
    if len(good) > 1:
        raise LocateError('uboot lock gate ambiguous: %d candidates at %s'
                          % (len(good), [hex(x) for x in good[:6]]))
    hits = A.find_all(d, UB_PATCHED)
    if len(hits) == 1:
        return {'pos': hits[0], 'patched': True}
    raise LocateError('uboot lock gate not found (raw str-wzr hits: %d, patched hits: %d)'
                      % (len(A.find_all(d, UB_STRWZR)), len(hits)))


# ---------------- trustos avb returns ----------------
TR_PAIR = bytes.fromhex('bf030091e003142a')    # mov sp,x29 ; mov w0,w20
TR_NEXT = bytes.fromhex('f35341a9')            # ldp x19,x20,[sp,#16]
TR_NEW = bytes.fromhex('00008052')             # mov w0,#0
TR_PATCHED_PAIR = bytes.fromhex('bf030091') + TR_NEW


def find_trustos(d):
    good = []
    for p in A.find_all(d, TR_PAIR):
        q = p + 4
        if q + 8 > len(d):
            continue
        if bytes(d[q+4:q+8]) != TR_NEXT:
            continue
        good.append(q)
    if good:
        return {'sites': good, 'patched': False}
    sites = [p + 4 for p in A.find_all(d, TR_PATCHED_PAIR)]
    if sites:
        return {'sites': sites, 'patched': True}
    raise LocateError('trustos avb returns not found (raw pair hits: %d)'
                      % len(A.find_all(d, TR_PAIR)))


# ---------------- banners ----------------
BANNER_WARN = b'WARNNING: LOCK FLAG IS'
BANNER_INFO = b'INFO: LOCK FLAG IS'
REF_BASE = 0x9EFFFE00


def _banner_at(d, needle, back4=False):
    p = d.find(needle)
    while p >= 0:
        start = p
        if back4 and p >= 4 and bytes(d[p-4:p]) == b'\n   ':
            start = p - 4
        end = d.find(b'\x00', p)
        if end > start:
            return {'start': start, 'text': bytes(d[start:end]),
                    'slot': end - start + 1}
        p = d.find(needle, p + 1)
    return None


def find_banners(d):
    warn = _banner_at(d, BANNER_WARN)
    info = _banner_at(d, BANNER_INFO, back4=True)
    if warn is None or info is None:
        raise LocateError('banner strings not found (warn=%s info=%s)'
                          % (warn is not None, info is not None))
    warn['refs'] = scan_refs(d, warn['start'])
    info['refs'] = scan_refs(d, info['start'])
    return {'warn': warn, 'info': info}


def scan_refs(d, target):
    """ADRP+ADD references to a file offset (uboot VA = file + 0x9EFFFE00)."""
    out = []
    pend = {}
    for i in range(0, len(d) - 3, 4):
        w = A.rd32(d, i)
        if A.is_adrp(w):
            immlo = (w >> 29) & 3
            immhi = (w >> 5) & 0x7FFFF
            imm = A.sign((immhi << 2) | immlo, 21)
            page = ((i + REF_BASE) & ~0xFFF) + (imm << 12)
            pend[w & 0x1F] = (i, page)
        elif A.is_addimm(w):
            rn = (w >> 5) & 0x1F
            th = pend.get(rn)
            if th and 0 <= (i - th[0]) <= 16:
                imm12 = (w >> 10) & 0xFFF
                tf = th[1] + imm12 - REF_BASE
                if abs(tf - target) <= 4:
                    out.append((i, tf))
    return out
