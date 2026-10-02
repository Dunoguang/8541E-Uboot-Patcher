"""AArch64 helpers for the unlock toolchain (pure python, no deps)."""

import struct

U32 = struct.Struct('<I')
NOP_BYTES = bytes.fromhex('1f2003d5')
NOP_WORD = 0xD503201F


def rd32(d, off):
    return U32.unpack_from(d, off)[0]


def wr32(d, off, w):
    U32.pack_into(d, off, w & 0xFFFFFFFF)


def find_all(data, pat):
    out = []
    i = data.find(pat)
    while i >= 0:
        out.append(i)
        i = data.find(pat, i + 1)
    return out


def sign(v, bits):
    if v & (1 << (bits - 1)):
        v -= (1 << bits)
    return v


def is_bl(w):
    return (w & 0xFC000000) == 0x94000000


def is_b(w):
    return (w & 0xFC000000) == 0x14000000


def is_adrp(w):
    return (w & 0x9F000000) == 0x90000000


def is_addimm(w):
    return (w & 0x7F000000) in (0x11000000, 0x91000000)


def is_cbz_w0(w):
    return (w & 0x7F00001F) == 0x34000000


def is_nop(w):
    return w == NOP_WORD


def branch_target(w, pc):
    return pc + (sign(w & 0x03FFFFFF, 26) << 2)


def cbz_imm19(w):
    return sign((w >> 5) & 0x7FFFF, 19)


def fmt(w):
    """Short mnemonic for reports (best effort)."""
    if is_nop(w):
        return 'nop'
    if is_bl(w):
        return 'bl'
    if is_b(w):
        return 'b'
    if is_adrp(w):
        return 'adrp'
    if is_cbz_w0(w):
        return 'cbz w0'
    return '0x%08x' % w
