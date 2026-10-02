"""Patch application: turn located anchors into unlocked images."""

from . import finder, aarch64 as A


class BuildError(Exception):
    pass


def unescape(s):
    """Resolve \\n \\r \\t \\\\ escapes (command-line friendly)."""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            n = s[i + 1]
            if n == 'n':
                out.append('\n'); i += 2; continue
            if n == 'r':
                out.append('\r'); i += 2; continue
            if n == 't':
                out.append('\t'); i += 2; continue
            if n == '\\':
                out.append('\\'); i += 2; continue
        out.append(c)
        i += 1
    return ''.join(out)


def text_to_bytes(s, slot, flag):
    """Resolve escapes, encode utf-8, enforce the slot limit."""
    t = unescape(s)
    b = t.encode('utf-8')
    if len(b) > slot - 1:
        raise BuildError('%s text is %d bytes, but the slot holds at most %d '
                         '(+1 terminator); shorten by %d byte(s)'
                         % (flag, len(b), slot - 1, len(b) - (slot - 1)))
    return b


def patch_splloader(d, loc):
    b = bytearray(d)
    b[loc['pos']:loc['pos'] + 4] = finder.SPL_NEW
    return b


def patch_uboot(d, lock, banners, warn_txt, info_txt):
    b = bytearray(d)
    p = lock['pos']
    b[p:p + 12] = A.NOP_BYTES * 3
    if warn_txt is not None:
        wb = text_to_bytes(warn_txt, banners['warn']['slot'], '--warn')
        s, slot = banners['warn']['start'], banners['warn']['slot']
        b[s:s + slot] = wb + b'\x00' * (slot - len(wb))
    if info_txt is not None:
        ib = text_to_bytes(info_txt, banners['info']['slot'], '--info')
        s, slot = banners['info']['start'], banners['info']['slot']
        b[s:s + slot] = ib + b'\x00' * (slot - len(ib))
    return b


def patch_trustos(d, res):
    b = bytearray(d)
    for q in res['sites']:
        b[q:q + 4] = finder.TR_NEW
    return b
