#!/usr/bin/env python3
"""Four-case regression for 8541E-Uboot-Patcher (byte-exact where known)."""

import hashlib
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
U = '/root/github/8541e_unlock_work'
OUT = os.path.join(HERE, 'cases-out')

CASES = [
    ('m9u', [U + '/m9u/splloader.img', U + '/m9u/uboot.img', U + '/m9u/trustos.img'],
     '1380040a3aa38e4c844cde0a4b09f55a'),
    ('ai3', [U + '/ai3-watch/splloader_has_secure_boot.bin',
             U + '/ai3-watch/patched/uboot-unlock-bootloader.img',
             U + '/ai3-watch/trustos_has_avb.bin'],
     '21d7b220a891695647005fd73a161e28'),
    ('dw99', [U + '/m9u/splloader.img',
              '/root/usblog-patch-transplant-dw99/uboot-unlock-bootloader.img',
              U + '/m9u/trustos.img'],
     '60b245aa1686310290dc95db61353237'),
]
SPL_MD5 = 'a9f360909ed33d200eff0874588a4c93'
TR_MD5 = '4b7a605e410a4c239ae36250dcc08213'


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def main():
    fails = 0
    for name, args, ub_md5 in CASES:
        outdir = os.path.join(OUT, name)
        cmd = [sys.executable, os.path.join(ROOT, 'patcher.py')] + args + ['--outdir', outdir]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print('%-11s FAILED (exit %d)' % (name, r.returncode))
            print(r.stdout[-1500:])
            fails += 1
            continue
        got = (md5(os.path.join(outdir, 'splloader-no-secure-boot.img')),
               md5(os.path.join(outdir, 'uboot-unlock-bootloader-usblog.img')),
               md5(os.path.join(outdir, 'trustos-no-avb.img')))
        ok = got == (SPL_MD5, ub_md5, TR_MD5)
        print('%-11s %s   uboot %s' % (name, 'OK' if ok else 'MISMATCH', got[1]))
        fails += 0 if ok else 1

    src = os.path.join(OUT, 'm9u')
    idem = os.path.join(OUT, 'm9u-idem')
    cmd = [sys.executable, os.path.join(ROOT, 'patcher.py'),
           os.path.join(src, 'splloader-no-secure-boot.img'),
           os.path.join(src, 'uboot-unlock-bootloader-usblog.img'),
           os.path.join(src, 'trustos-no-avb.img'), '--outdir', idem]
    r = subprocess.run(cmd, capture_output=True, text=True)
    names = ('splloader-no-secure-boot.img', 'uboot-unlock-bootloader-usblog.img', 'trustos-no-avb.img')
    same = r.returncode == 0 and all(md5(os.path.join(src, f)) == md5(os.path.join(idem, f)) for f in names)
    print('%-11s %s' % ('idempotent', 'OK' if same else 'FAILED'))
    fails += 0 if same else 1
    print()
    print('regress:', 'PASS' if fails == 0 else 'FAIL (%d)' % fails)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
