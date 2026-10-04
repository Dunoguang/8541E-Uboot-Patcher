# 8541E-Uboot-Patcher

One-shot full patch for UNISOC/Spreadtrum **SL8541E**-class watches
(same device family as the uboot-usblog / unlock-auto projects).

Three functions in one run:

| # | function | what it does |
|---|----------|--------------|
| 1 | unlock   | splloader secure-boot check disabled (`bl #0x6740 -> b #0x55dc`); uboot lock gate -> NOP x3; trustos both AVB returns -> `mov w0,#0` |
| 2 | usblog   | injects the live USB-console patch into the uboot image (same design as uboot-usblog 0.0.1) |
| 3 | banner   | replaces the two u-boot banners (default: the Dunoguang set) |

All three are state-aware and idempotent:

| state | detection | action |
|-------|-----------|--------|
| already unlocked | patched forms recognised (`b #0x55dc` / NOP gate / `mov w0,#0`) | kept |
| already injected | gate shows `mov w19,#0` + `b +0x38` | kept |
| banner factory / dunoguang / modified | text compare | replaced only when needed |

**Banners stay re-editable.**  The two slots are located by stable
neighbours (`info failed!...` .. `pass_chip_uid_to_tos` for warn;
`charger` - 36 bytes for info), not by their text, so a third-party
rewrite can always be replaced, and the result can be edited again any
number of times.

## Usage

    patcher.py <splloader> <uboot> <trustos> [--outdir DIR]
               [--warn TEXT] [--info TEXT] [--verbose]
               [--no-unlock] [--no-usblog] [--no-banner]

writes (default dir = the uboot directory + `/patched/`):

    splloader-no-secure-boot.img
    uboot-unlock-bootloader-usblog.img
    trustos-no-avb.img

Default banner texts (the Dunoguang set):

    warn : QQ:3981750101 / Boot Format OK, Kernel Started...   (48 bytes)
    info : SPRD U-Boot - Patch By Dunoguang                    (35 bytes)

In --warn / --info a literal backslash-n becomes a newline; oversized
text is rejected before anything is written.  `--verbose` turns on the
full anchor-location / injection logs.

## Web version (`web/`)

A fully client-side port of the same toolchain -- open `web/index.html`
in any modern browser (double-click is fine: no server, no CDN, no
external references; the files never leave the machine):

- drop in any subset of the three images (uboot alone works),
- each file is analysed on the spot (lock / banner / usblog states for
  uboot, secure-boot / AVB states for the others),
- tick the functions you want (all three are on by default) and press
  the button,
- download the results; every product shows its md5 next to the button,
- switch the whole interface between 中文 / English / Português from the
  top-right corner (the choice is remembered).

The browser core (`web/core.js` + `web/tpl.js`) is a line-by-line port
of the python engines and was verified byte-exact: `node web/test_node.js`
re-runs the same four-case matrix as `tests/run_cases.py` (m9u full run,
ai3 two-step, dw99 YC image, idempotent re-run) and must print
`regress: PASS`.

Interface strings live in `web/i18n.js` (zh / en / pt, 57 keys each);
`node web/check_i18n.js` verifies that every key used by the HTML and
the UI code exists in all three languages and that the dictionaries
stay in sync (must print `I18N CHECK PASSED`).

## Test matrix (2026-10-02, all green)

| case | input | result |
|------|-------|--------|
| m9u original | protected / factory / clean | full run -> uboot `1380040a…` (byte-identical to the hand-made 3-in-1) |
| ai3 two-step | unlocked + dunoguang + clean | inject only -> uboot `21d7b220…` (byte-identical to the hand-made 3-in-1) |
| idempotent | m9u product | all kept, 0 bytes changed, md5 unchanged |
| dw99 | YC unlock + YC banner | lock kept, banner modified -> replaced, inject -> `60b245aa…` |

`python3 tests/run_cases.py` re-runs the matrix (byte-exact where known).

## Architecture

    patcher.py              CLI entry
    lib/banners.py          robust banner access (neighbour anchors + states)
    lib/unlockauto/         the unlock engine (splloader / uboot / trustos)
    lib/usblogauto/         the usblog injection engine (+ detect() probe)
    lib/profiles/           masked word templates used by the usblog finder

The two engines are drop-in copies of the standalone projects; the only
addition is the injection-aware `detect()` probe in
`lib/usblogauto/finder.py`.

## Provenance

Built on unlock-auto and usblog-auto (which itself pins the four legacy
uboot-usblog generators byte-exactly).  Pure python, no dependencies.
