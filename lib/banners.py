"""Robust banner access for SL8541E u-boot images.

Text-independent anchors -- the two banner slots have stable neighbours in
every known build, whatever the current text says (factory / vendor /
third-party rewrites).  That is what makes the banners re-editable
("second edit") on already-modified images.

  warn slot : starts right after  b"info failed!\\n\\x00"
              ends right before  b"pass_chip_uid_to_tos"
  info slot : ends right before  b"charger\\x00"; length is measured back
              to the previous NUL (its content conventionally starts with
              0x0A)

Text search is kept only as a fallback.
"""

WARN_ANCHOR = b"info failed!\n\x00"
WARN_TAIL = b"pass_chip_uid_to_tos"
INFO_TAIL = b"charger\x00"
INFO_SLOT = 36

FACTORY_WARN = b"WARNNING: LOCK FLAG IS : UNLOCK, SKIP VERIFY!!!\n"
FACTORY_INFO = b"\n   INFO: LOCK FLAG IS : UNLOCK!!!\n"
DUNOGUANG_WARN = b"QQ:3981750101\nBoot Format OK, Kernel Started...\n"
DUNOGUANG_INFO = b"SPRD U-Boot - Patch By Dunoguang  \n"


class BannerError(Exception):
    pass


def find_warn(d):
    off = 0
    while True:
        p = d.find(WARN_ANCHOR, off)
        if p < 0:
            break
        w = p + len(WARN_ANCHOR)
        pcp = d.find(WARN_TAIL, w, w + 128)
        if pcp >= 0 and 4 <= pcp - w <= 64:
            end = d.find(b"\x00", w)
            if w <= end < pcp:
                return {'start': w, 'slot': pcp - w,
                        'text': bytes(d[w:end]), 'anchor': 'neighbour'}
        off = p + 1
    s = d.find(b"WARNNING: LOCK FLAG IS")
    if s < 0:
        s = d.find(b"WARNNING")
    if s >= 0:
        end = d.find(b"\x00", s)
        if end > s:
            return {'start': s, 'slot': end - s + 1,
                    'text': bytes(d[s:end]), 'anchor': 'text'}
    raise BannerError('warn banner slot not found')


def find_info(d):
    cands = []
    off = 0
    while True:
        cp = d.find(INFO_TAIL, off)
        if cp < 0:
            break
        s = cp - INFO_SLOT
        if s >= 1 and d[cp - 1] == 0 and d[s - 1] == 0:
            cands.append((s, cp, d[s] == 0x0A))
        off = cp + 1
    if cands:
        pref = [c for c in cands if c[2]]
        if len(pref) == 1:
            s, cp, _ = pref[0]
        elif not pref and len(cands) == 1:
            s, cp, _ = cands[0]
        else:
            raise BannerError('info slot ambiguous (%d candidates, %d pref)'
                              % (len(cands), len(pref)))
        end = d.find(b"\x00", s)
        if end < 0 or end > cp - 1:
            end = cp - 1
        return {'start': s, 'slot': cp - s,
                'text': bytes(d[s:end]), 'anchor': 'neighbour'}
    p = d.find(b"INFO: LOCK FLAG IS")
    if p >= 4 and d[p - 4:p] == b"\n   ":
        p -= 4
    if p >= 0:
        end = d.find(b"\x00", p)
        if end > p:
            return {'start': p, 'slot': end - p + 1,
                    'text': bytes(d[p:end]), 'anchor': 'text'}
    raise BannerError('info banner slot not found')


def state(text, factory, dunoguang):
    if text == factory:
        return 'factory'
    if text == dunoguang:
        return 'dunoguang'
    return 'modified'


def find_banners(d):
    warn = find_warn(d)
    info = find_info(d)
    warn['state'] = state(warn['text'], FACTORY_WARN, DUNOGUANG_WARN)
    info['state'] = state(info['text'], FACTORY_INFO, DUNOGUANG_INFO)
    return {'warn': warn, 'info': info}


def apply_text(d, slot, text_bytes, flag):
    cap = slot['slot'] - 1
    if len(text_bytes) > cap:
        raise BannerError('%s text is %d bytes, but this slot holds at most '
                          '%d (+1 NUL); shorten by %d' %
                          (flag, len(text_bytes), cap, len(text_bytes) - cap))
    b = bytearray(d)
    s = slot['start']
    b[s:s + slot['slot']] = text_bytes + b"\x00" * (slot['slot'] - len(text_bytes))
    return b
