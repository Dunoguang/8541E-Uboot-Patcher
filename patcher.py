#!/usr/bin/env python3
"""8541E-Uboot-Patcher -- one-shot full patch for SL8541E-class watches.

Three functions in one run:

  1. unlock  splloader secure-boot check / uboot lock gate / trustos AVB
  2. usblog  live USB-console injection into the u-boot image
  3. banner  replace both u-boot banners (default: the Dunoguang set)

State-aware: already-unlocked, already-injected and already-modified
banners are detected and the matching step is skipped; banners stay
re-editable whatever text they currently hold.

usage:
  patcher.py <splloader> <uboot> <trustos> [--outdir DIR]
             [--warn TEXT] [--info TEXT] [--verbose]
             [--no-unlock] [--no-usblog] [--no-banner]

writes (into <outdir>, default: <uboot dir>/patched/):

  splloader-no-secure-boot.img
  uboot-unlock-bootloader-usblog.img
  trustos-no-avb.img
"""
import argparse
import hashlib
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import banners as BAN                                    # noqa: E402
from lib.unlockauto import finder as UF, builder as UBU           # noqa: E402
from lib.unlockauto import verify as UV, audit as UA              # noqa: E402
from lib.usblogauto import finder as SF, builder as SB            # noqa: E402

NL = chr(10)
DEF_WARN = 'QQ:3981750101' + NL + 'Boot Format OK, Kernel Started...' + NL
DEF_INFO = 'SPRD U-Boot - Patch By Dunoguang  ' + NL


def md5(b):
    return hashlib.md5(b).hexdigest()


def load(p):
    with open(p, 'rb') as f:
        return f.read()


def d30_of(d):
    return struct.unpack_from('<I', d, 0x30)[0]


def run(args):
    quiet = (lambda *a, **k: None)
    log = print if args.verbose else quiet

    spl = load(args.splloader)
    ub = load(args.uboot)
    tr = load(args.trustos)
    fails = 0

    print('8541E-Uboot-Patcher')
    print()
    print('== splloader (%d bytes)  %s ==' % (len(spl), os.path.basename(args.splloader)))
    spl_out = spl
    spl_loc = None
    if not args.no_unlock:
        try:
            spl_loc = UF.find_splloader(spl)
        except UF.LocateError as e:
            print('   ERROR: %s' % e)
            return 2
        if spl_loc['patched']:
            print('   secure-boot : already patched (kept)  [b #0x55dc @ 0x%06x]' % spl_loc['pos'])
        else:
            print('   secure-boot : protected -> patched  [bl #0x6740 -> b #0x55dc @ 0x%06x]' % spl_loc['pos'])
            spl_out = bytes(UBU.patch_splloader(spl, spl_loc))
    else:
        print('   secure-boot : skipped (--no-unlock)')

    print()
    print('== trustos (%d bytes)  %s ==' % (len(tr), os.path.basename(args.trustos)))
    tr_out = tr
    tr_loc = None
    if not args.no_unlock:
        try:
            tr_loc = UF.find_trustos(tr)
        except UF.LocateError as e:
            print('   ERROR: %s' % e)
            return 2
        if tr_loc['patched']:
            print('   avb returns : already patched (kept)  [%d sites]' % len(tr_loc['sites']))
        else:
            print('   avb returns : protected -> patched  [%s]'
                  % ', '.join('0x%06x' % q for q in tr_loc['sites']))
            tr_out = bytes(UBU.patch_trustos(tr, tr_loc))
    else:
        print('   avb returns : skipped (--no-unlock)')

    print()
    print('== uboot (%d bytes)  %s ==' % (len(ub), os.path.basename(args.uboot)))
    ubc = ub
    lk = None
    if not args.no_unlock:
        try:
            lk = UF.find_uboot_lock(ub)
        except UF.LocateError as e:
            print('   lock        : ERROR %s' % e)
            return 2
        if lk['patched']:
            print('   lock        : already patched (kept)  [nop x3 @ 0x%06x]' % lk['pos'])
        else:
            print('   lock        : protected -> patched  [nop x3 @ 0x%06x]' % lk['pos'])
            ubc = bytes(UBU.patch_uboot(ubc, lk, None, None, None))
    else:
        print('   lock        : skipped (--no-unlock)')

    try:
        bn = BAN.find_banners(ub)
    except BAN.BannerError as e:
        print('   banners     : ERROR %s' % e)
        return 2
    wb = ib = None
    if not args.no_banner:
        w_arg = DEF_WARN if args.warn is None else args.warn
        i_arg = DEF_INFO if args.info is None else args.info
        try:
            wb = UBU.text_to_bytes(w_arg, bn['warn']['slot'], '--warn')
            ib = UBU.text_to_bytes(i_arg, bn['info']['slot'], '--info')
        except UBU.BuildError as e:
            print('   banners     : ERROR %s' % e)
            return 2
        if bn['warn']['text'] == wb:
            print('   banner warn : %-9s (kept, text matches)' % bn['warn']['state'])
        else:
            print('   banner warn : %-9s -> replaced  [%d/%d bytes]'
                  % (bn['warn']['state'], len(wb), bn['warn']['slot'] - 1))
            ubc = bytes(BAN.apply_text(ubc, bn['warn'], wb, '--warn'))
        if bn['info']['text'] == ib:
            print('   banner info : %-9s (kept, text matches)' % bn['info']['state'])
        else:
            print('   banner info : %-9s -> replaced  [%d/%d bytes]'
                  % (bn['info']['state'], len(ib), bn['info']['slot'] - 1))
            ubc = bytes(BAN.apply_text(ubc, bn['info'], ib, '--info'))
    else:
        print('   banner warn : %-9s (skipped; --no-banner)' % bn['warn']['state'])
        print('   banner info : %-9s (skipped; --no-banner)' % bn['info']['state'])

    anchors = None
    det = None
    ub_state = 'na'
    try:
        det = SF.detect(ub)
        ub_state = det['state']
    except SF.FindError as e:
        ub_state = 'na'
        print('   usblog      : not applicable (%s)' % e)
    if ub_state == 'injected':
        print('   usblog      : already injected (kept)  [TRIG 0x%06x]' % det['TRIG'])
    elif ub_state == 'clean':
        if args.no_usblog:
            print('   usblog      : clean (skipped; --no-usblog)')
        else:
            try:
                anchors = SF.locate(ub, log=log)
            except SF.FindError as e:
                print('   usblog      : locate failed (%s)' % e)
                return 2
            print('   usblog      : clean -> injected  [TRIG 0x%06x, PUTS 0x%06x, dead 0x%06x..0x%06x]'
                  % (anchors['TRIG'], anchors['PUTS'], anchors['FLAG'], anchors['DEAD_END']))
            ubc = bytes(SB.build(ubc, anchors, d30_of(ubc), log=log))
    elif ub_state == 'unknown':
        print('   usblog      : UNKNOWN gate state (RET1=%#x, FORCE=%#x)'
              % (det['RET1_word'], det['FORCE_word']))
        fails += 1

    outdir = args.outdir or os.path.join(os.path.dirname(os.path.abspath(args.uboot)), 'patched')
    os.makedirs(outdir, exist_ok=True)
    outs = [
        ('splloader', os.path.join(outdir, 'splloader-no-secure-boot.img'), spl_out),
        ('uboot', os.path.join(outdir, 'uboot-unlock-bootloader-usblog.img'), ubc),
        ('trustos', os.path.join(outdir, 'trustos-no-avb.img'), tr_out),
    ]
    print()
    print('written:')
    for _, p, data in outs:
        open(p, 'wb').write(data)
        print('   %-38s %8d bytes  md5 %s' % (os.path.basename(p), len(data), md5(data)))

    print()
    print('verify:')
    if spl_loc is not None:
        ok, note = UV.verify_splloader(spl_out)
    else:
        ok, note = True, 'skipped'
    fails += 0 if ok else 1
    print('   splloader  %s  (%s)' % ('ok' if ok else 'FAILED', note))

    ok_u = True
    v_notes = []
    if lk is not None:
        try:
            lk2 = UF.find_uboot_lock(ubc)
            if not lk2['patched']:
                ok_u = False
                v_notes.append('lock not patched')
            else:
                v_notes.append('lock nop x3')
        except UF.LocateError as e:
            ok_u = False
            v_notes.append('lock reloc failed: %s' % e)
    if wb is not None:
        bn2 = BAN.find_banners(ubc)
        if bn2['warn']['text'] != wb or bn2['info']['text'] != ib:
            ok_u = False
            v_notes.append('banner mismatch after write')
        else:
            v_notes.append('banners ok')
    try:
        det2 = SF.detect(ubc)
        if det2['state'] == 'injected':
            v_notes.append('usblog injected')
        elif anchors is not None:
            ok_u = False
            v_notes.append('usblog NOT injected after build')
        else:
            v_notes.append('usblog %s' % det2['state'])
    except SF.FindError:
        v_notes.append('usblog n/a')
    fails += 0 if ok_u else 1
    print('   uboot      %s  (%s)' % ('ok' if ok_u else 'FAILED', '; '.join(v_notes)))

    if tr_loc is not None:
        ok, note = UV.verify_trustos(tr_out, len(tr_loc['sites']))
    else:
        ok, note = True, 'skipped'
    fails += 0 if ok else 1
    print('   trustos    %s  (%s)' % ('ok' if ok else 'FAILED', note))

    print('audit:')
    if spl_loc is not None:
        a_ok, zz, outside = UA.audit(spl, spl_out, [[spl_loc['pos'], spl_loc['pos'] + 4]])
        fails += 0 if a_ok else 1
        print('   splloader  changed %d bytes, outside %d' % (UA.count_bytes(zz), outside))
    ub_zones = []
    if lk is not None:
        ub_zones.append([lk['pos'], lk['pos'] + 12])
    ub_zones.append([bn['warn']['start'], bn['warn']['start'] + bn['warn']['slot']])
    ub_zones.append([bn['info']['start'], bn['info']['start'] + bn['info']['slot']])
    if anchors is not None:
        for key in ('PUTS', 'RET1', 'FORCE_PORT', 'TRIG', 'PUMP_CALL'):
            ub_zones.append([anchors[key], anchors[key] + 4])
        ub_zones.append([anchors['FLAG'], anchors['DEAD_END'] + 4])
    a_ok, zz, outside = UA.audit(ub, ubc, ub_zones)
    fails += 0 if a_ok else 1
    print('   uboot      changed %d bytes, outside %d' % (UA.count_bytes(zz), outside))
    if tr_loc is not None:
        a_ok, zz, outside = UA.audit(tr, tr_out, [[q, q + 4] for q in tr_loc['sites']])
        fails += 0 if a_ok else 1
        print('   trustos    changed %d bytes, outside %d' % (UA.count_bytes(zz), outside))

    print()
    if fails == 0:
        print('ALL CHECKS PASSED')
        return 0
    print('%d CHECK(S) FAILED' % fails)
    return 1


def main():
    ap = argparse.ArgumentParser(
        prog='patcher.py',
        description='8541E-Uboot-Patcher: unlock + usblog + banner, state-aware')
    ap.add_argument('splloader')
    ap.add_argument('uboot')
    ap.add_argument('trustos')
    ap.add_argument('--outdir')
    ap.add_argument('--warn', help='warn banner text (default: the Dunoguang set)')
    ap.add_argument('--info', help='info banner text (default: the Dunoguang set)')
    ap.add_argument('--verbose', action='store_true', help='show full anchor/build logs')
    ap.add_argument('--no-unlock', action='store_true')
    ap.add_argument('--no-usblog', action='store_true')
    ap.add_argument('--no-banner', action='store_true')
    args = ap.parse_args()
    return run(args)


if __name__ == '__main__':
    sys.exit(main())
