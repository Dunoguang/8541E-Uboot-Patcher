"""Post-build verification: re-locate anchors on the product."""

from . import finder


def _banner_ok(d, ban, txt_bytes):
    s = ban['start']
    return bytes(d[s:s + len(txt_bytes)]) == txt_bytes


def verify_splloader(d):
    try:
        loc = finder.find_splloader(d)
    except finder.LocateError as e:
        return False, str(e)
    if not loc['patched']:
        return False, 'site not patched'
    return True, 'site 0x%06x -> b #0x55dc' % loc['pos']


def verify_uboot(d, banners=None, warn_bytes=None, info_bytes=None):
    try:
        lock = finder.find_uboot_lock(d)
    except finder.LocateError as e:
        return False, str(e)
    if not lock['patched']:
        return False, 'lock gate not patched'
    notes = ['lock 0x%06x -> nop x3' % lock['pos']]
    if banners is not None and warn_bytes is not None:
        if not _banner_ok(d, banners['warn'], warn_bytes):
            return False, 'warn banner mismatch'
        notes.append('warn banner ok')
    if banners is not None and info_bytes is not None:
        if not _banner_ok(d, banners['info'], info_bytes):
            return False, 'info banner mismatch'
        notes.append('info banner ok')
    return True, '; '.join(notes)


def verify_trustos(d, expect_sites):
    try:
        res = finder.find_trustos(d)
    except finder.LocateError as e:
        return False, str(e)
    if not res['patched']:
        return False, 'sites not patched'
    if len(res['sites']) != expect_sites:
        return False, 'site count %d != %d' % (len(res['sites']), expect_sites)
    return True, '%d sites -> mov w0,#0' % len(res['sites'])
