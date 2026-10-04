/* 8541E-Uboot-Patcher Web -- i18n (zh / en / pt).  Load before ui.js. */
var I18N = (function () {
'use strict';

var STORE_KEY = 'ubp-lang';
var FALLBACK = 'en';

var dict = {};

dict.zh = {
  /* ---- static ---- */
  sub: 'SL8541e 手表三合一：去保护（splloader / uboot / trustos）＋ usblog 实时日志注入 ＋ 横幅替换。全程本地处理，文件不上传。',
  step1: '选择镜像', step2: '选项', step3: '执行', step4: '下载',
  opt: '可选', req: '必需', none: '未选择',
  opt_unlock: '去保护 — splloader secure boot / uboot lock / trustos AVB',
  opt_usblog: 'usblog 注入 — uboot USB 实时日志',
  opt_banner: '替换横幅',
  lbl_warn: 'warn 横幅（≤48 字节；输入里的 \\n 会转义为换行）',
  lbl_info: 'info 横幅（≤35 字节）',
  btn_go: '处理', btn_go_ing: '处理中…',
  footer: 'MIT © 2026 Dunoguang · 8541E-Uboot-Patcher',
  lang_label: '语言',

  /* ---- status ---- */
  st_patched: '已去保护', st_protected: '受保护', st_unlocked: '已解锁',
  st_factory: '原厂', st_modified: '已修改', st_unknown: '无法识别',
  st_injected: '已注入', st_clean: '未注入', st_na: '不适用',
  n_sites: '· {n} 处',
  unit_bytes: '字节',

  /* ---- log ---- */
  need_files: '请先选择镜像文件',
  skip_opt: '跳过（选项关闭）',
  l_hdr: '== {what} ({n} {unit}) ==',
  l_skip_hdr: '== {what} : {skip} ==',
  l_spl_keep: '   secure-boot : 已修补（保留）  [{off}]',
  l_spl_patch: '   secure-boot : 受保护 -> 已修补  [bl #0x6740 -> b #0x55dc @ {off}]',
  l_verify_ok: '   verify      : 通过  ({note})',
  l_verify_fail: '   verify      : 失败 ({note})',
  l_us_verify_ok: '   verify      : 通过 - 镜像正确',
  l_audit: '   audit       : 改动 {n} {unit}',
  l_err: '   ERROR: {msg}',
  l_lock_keep: '   lock        : 已修补（保留）  [{off}]',
  l_lock_patch: '   lock        : 受保护 -> 已修补  [nop x3 @ {off}]',
  l_lock_skip: '   lock        : {skip}',
  l_ban_keep: '   banner {which} : {state}（保留）',
  l_ban_repl: '   banner {which} : {state} -> 已替换  [{n}/{slot} {unit}]',
  l_ban_skip: '   banner      : {skip}',
  l_us_keep: '   usblog      : 已注入（保留）  [TRIG {off}]',
  l_us_clean_skip: '   usblog      : clean（{skip}）',
  l_us_inject: '   usblog      : clean -> 已注入  [TRIG {trig}, PUTS {puts}, dead {f}..{e}]',
  l_us_na: '   usblog      : 不适用（未找到注入链）',
  l_tr_keep: '   avb returns : 已修补（保留）  [{n} 处]',
  l_tr_patch: '   avb returns : 受保护 -> 已修补  [{sites}]',
  l_tr_skip: '== trustos : {skip} ==',
  all_ok: '全部检查通过',
  all_fail: '{n} 项检查失败',

  /* ---- downloads ---- */
  dl_btn: '下载 {name}',
  dl_all: '全部下载',
  dl_meta: '{n} {unit} · md5 {md5}'
};

dict.en = {
  /* ---- static ---- */
  sub: 'SL8541e watch all-in-one toolkit: unlock (splloader / uboot / trustos) + usblog live USB log injection + banner replacement. Everything is processed locally — files are never uploaded.',
  step1: 'Select images', step2: 'Options', step3: 'Run', step4: 'Download',
  opt: 'optional', req: 'required', none: 'not selected',
  opt_unlock: 'Unlock — splloader secure boot / uboot lock / trustos AVB',
  opt_usblog: 'usblog injection — uboot live USB log',
  opt_banner: 'Replace banner',
  lbl_warn: 'warn banner (≤48 bytes; \\n in the input is escaped as a newline)',
  lbl_info: 'info banner (≤35 bytes)',
  btn_go: 'Process', btn_go_ing: 'Processing…',
  footer: 'MIT © 2026 Dunoguang · 8541E-Uboot-Patcher',
  lang_label: 'Language',

  /* ---- status ---- */
  st_patched: 'unprotected', st_protected: 'protected', st_unlocked: 'unlocked',
  st_factory: 'factory', st_modified: 'modified', st_unknown: 'unrecognized',
  st_injected: 'injected', st_clean: 'not injected', st_na: 'not applicable',
  n_sites: '· {n} sites',
  unit_bytes: 'bytes',

  /* ---- log ---- */
  need_files: 'Please select image file(s) first',
  skip_opt: 'skipped (option disabled)',
  l_hdr: '== {what} ({n} {unit}) ==',
  l_skip_hdr: '== {what} : {skip} ==',
  l_spl_keep: '   secure-boot : already patched (kept)  [{off}]',
  l_spl_patch: '   secure-boot : protected -> patched  [bl #0x6740 -> b #0x55dc @ {off}]',
  l_verify_ok: '   verify      : ok  ({note})',
  l_verify_fail: '   verify      : FAILED ({note})',
  l_us_verify_ok: '   verify      : ok - image looks correct',
  l_audit: '   audit       : changed {n} {unit}',
  l_err: '   ERROR: {msg}',
  l_lock_keep: '   lock        : already patched (kept)  [{off}]',
  l_lock_patch: '   lock        : protected -> patched  [nop x3 @ {off}]',
  l_lock_skip: '   lock        : {skip}',
  l_ban_keep: '   banner {which} : {state} (kept)',
  l_ban_repl: '   banner {which} : {state} -> replaced  [{n}/{slot} {unit}]',
  l_ban_skip: '   banner      : {skip}',
  l_us_keep: '   usblog      : already injected (kept)  [TRIG {off}]',
  l_us_clean_skip: '   usblog      : clean ({skip})',
  l_us_inject: '   usblog      : clean -> injected  [TRIG {trig}, PUTS {puts}, dead {f}..{e}]',
  l_us_na: '   usblog      : not applicable (injection chain not found)',
  l_tr_keep: '   avb returns : already patched (kept)  [{n} sites]',
  l_tr_patch: '   avb returns : protected -> patched  [{sites}]',
  l_tr_skip: '== trustos : {skip} ==',
  all_ok: 'ALL CHECKS PASSED',
  all_fail: '{n} CHECK(S) FAILED',

  /* ---- downloads ---- */
  dl_btn: 'Download {name}',
  dl_all: 'Download all',
  dl_meta: '{n} {unit} · md5 {md5}'
};

dict.pt = {
  /* ---- static ---- */
  sub: 'Ferramenta tudo-em-um para smartwatch SL8541e: desproteção (splloader / uboot / trustos) + injeção de log USB em tempo real (usblog) + troca de banner. Tudo processado localmente — nenhum arquivo é enviado.',
  step1: 'Selecionar imagens', step2: 'Opções', step3: 'Executar', step4: 'Download',
  opt: 'opcional', req: 'obrigatório', none: 'não selecionado',
  opt_unlock: 'Desproteger — splloader secure boot / uboot lock / trustos AVB',
  opt_usblog: 'Injeção usblog — log USB em tempo real do uboot',
  opt_banner: 'Substituir banner',
  lbl_warn: 'banner warn (≤48 bytes; \\n no texto vira quebra de linha)',
  lbl_info: 'banner info (≤35 bytes)',
  btn_go: 'Processar', btn_go_ing: 'Processando…',
  footer: 'MIT © 2026 Dunoguang · 8541E-Uboot-Patcher',
  lang_label: 'Idioma',

  /* ---- status ---- */
  st_patched: 'desprotegido', st_protected: 'protegido', st_unlocked: 'desbloqueado',
  st_factory: 'original', st_modified: 'modificado', st_unknown: 'não reconhecido',
  st_injected: 'injetado', st_clean: 'não injetado', st_na: 'não aplicável',
  n_sites: '· {n} locais',
  unit_bytes: 'bytes',

  /* ---- log ---- */
  need_files: 'Selecione primeiro os arquivos de imagem',
  skip_opt: 'ignorado (opção desativada)',
  l_hdr: '== {what} ({n} {unit}) ==',
  l_skip_hdr: '== {what} : {skip} ==',
  l_spl_keep: '   secure-boot : já corrigido (mantido)  [{off}]',
  l_spl_patch: '   secure-boot : protegido -> corrigido  [bl #0x6740 -> b #0x55dc @ {off}]',
  l_verify_ok: '   verify      : ok  ({note})',
  l_verify_fail: '   verify      : FALHOU ({note})',
  l_us_verify_ok: '   verify      : ok - imagem correta',
  l_audit: '   audit       : {n} {unit} alterados',
  l_err: '   ERROR: {msg}',
  l_lock_keep: '   lock        : já corrigido (mantido)  [{off}]',
  l_lock_patch: '   lock        : protegido -> corrigido  [nop x3 @ {off}]',
  l_lock_skip: '   lock        : {skip}',
  l_ban_keep: '   banner {which} : {state} (mantido)',
  l_ban_repl: '   banner {which} : {state} -> substituído  [{n}/{slot} {unit}]',
  l_ban_skip: '   banner      : {skip}',
  l_us_keep: '   usblog      : já injetado (mantido)  [TRIG {off}]',
  l_us_clean_skip: '   usblog      : clean ({skip})',
  l_us_inject: '   usblog      : clean -> injetado  [TRIG {trig}, PUTS {puts}, dead {f}..{e}]',
  l_us_na: '   usblog      : não aplicável (cadeia de injeção não encontrada)',
  l_tr_keep: '   avb returns : já corrigido (mantido)  [{n} locais]',
  l_tr_patch: '   avb returns : protegido -> corrigido  [{sites}]',
  l_tr_skip: '== trustos : {skip} ==',
  all_ok: 'TODAS AS VERIFICAÇÕES PASSARAM',
  all_fail: '{n} verificação(ões) falhou(ram)',

  /* ---- downloads ---- */
  dl_btn: 'Baixar {name}',
  dl_all: 'Baixar tudo',
  dl_meta: '{n} {unit} · md5 {md5}'
};

/* ---------- engine ---------- */

function read() {
  try {
    var s = localStorage.getItem(STORE_KEY);
    if (s && dict[s]) return s;
  } catch (e) {}
  var n = '';
  try { n = (navigator.language || '').toLowerCase(); } catch (e) {}
  if (n.indexOf('zh') === 0) return 'zh';
  if (n.indexOf('pt') === 0) return 'pt';
  if (n.indexOf('en') === 0) return 'en';
  return 'zh';
}

var lang = read();

function t(key, vars) {
  var s = (dict[lang] && dict[lang][key]) || dict[FALLBACK][key] || key;
  if (vars) {
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      }
    }
  }
  return s;
}

function apply() {
  var nodes = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
  }
  var phs = document.querySelectorAll('[data-i18n-ph]');
  for (var j = 0; j < phs.length; j++) {
    phs[j].setAttribute('placeholder', t(phs[j].getAttribute('data-i18n-ph')));
  }
  document.documentElement.lang =
    lang === 'zh' ? 'zh-CN' : (lang === 'pt' ? 'pt-BR' : 'en');
  var sel = document.getElementById('lang');
  if (sel) { sel.value = lang; sel.title = t('lang_label'); }
}

function setLang(l) {
  if (!dict[l]) return;
  lang = l;
  try { localStorage.setItem(STORE_KEY, l); } catch (e) {}
  apply();
  try {
    window.dispatchEvent(new CustomEvent('ubp-langchange', { detail: { lang: l } }));
  } catch (e) {}
}

function bind() {
  var sel = document.getElementById('lang');
  if (!sel) return;
  sel.value = lang;
  sel.addEventListener('change', function () { setLang(sel.value); });
}

function init() { bind(); apply(); }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

return {
  t: t,
  apply: apply,
  setLang: setLang,
  getLang: function () { return lang; },
  langs: ['zh', 'en', 'pt']
};

})();
