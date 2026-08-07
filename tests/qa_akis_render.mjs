/**
 * AKIS KOSUM TAKIMI — hook'lari GERCEKTEN calisan mini React.
 *
 * NEDEN AYRI BIR DOSYA: `qa_mini_render.mjs` tek bir render icin yazilmis;
 * `useState`'i sahte (setState hicbir sey yapmiyor) ve `@babel/runtime`
 * yardimcilarini stub'liyor. PreGameBoosterModal'in "<- Back secimi
 * sifirliyor mu" sorusu ANCAK durum gercekten degisirse cevaplanabilir:
 * bas -> yeniden render et -> secim gitti mi bak. Ayrica App.js'in import
 * agaci (GameScreen -> CandyCell) `_react.default.memo` kullaniyor ve eski
 * stub'da `_interopRequireWildcard` null donduruyordu.
 *
 * Bu dosya eskisini DEGISTIRMEZ; yanina konur.
 *
 * NELERI GERCEKTEN YAPAR:
 *  - Kaynagi Metro'nun transform'uyla (babel-preset-expo) derler.
 *  - `@babel/runtime/*` yardimcilarini GERCEK pakete baglar.
 *  - `useState` / `useEffect` / `useRef` / `useMemo` / `useCallback` calisir;
 *    setState yeniden render tetikler, effect'ler deps'e gore kosar.
 *  - Prop degisimi `setProps` ile simule edilir (modalin kapanip acilmasi).
 *
 * ⚠️ KAPSAM DISI: gercek React reconciler, yerlesim, dokunma olaylari,
 * animasyon, ic ice fonksiyon bilesenlerinin KENDI hook'lari (ic bilesenler
 * BILEREK cagrilmaz; yalnizca mount edilen bilesenin govdesi kosar).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const nodeRequire = createRequire(import.meta.url);
const babel = nodeRequire('@babel/core');

/** Uygulamanin kaydettigi donanim-geri-tusu dinleyicileri. */
export const BACK_HANDLERS = [];

// --------------------------------------------------------------- host stub
function hostComponent(name) {
  const fn = () => null;
  fn.displayName = name;
  fn.toString = () => name;
  fn.__host = name;
  return fn;
}

// ⚠️ TUZAK: eski kosum takimi `{ ...RN }` ile yayiyordu. RN bir Proxy ve
// yayilma yalnizca HEDEF nesnenin kendi anahtarlarini alir -> `View`, `Text`,
// `Modal` disari HIC cikmiyor, `_reactNative.Modal` `undefined` oluyordu.
// Agacta metin yine gorunuyor (createElement `String(undefined)` yaziyor) ama
// dugumun KIMLIGI kayboluyor, yani "her Modal'in onRequestClose'u var mi" gibi
// bir soru sessizce YANLIS cevaplanabiliyordu. Proxy oldugu gibi doner.
function makeReactNativeStub() {
  const cache = new Map();
  const base = {
    __esModule: true,
    StyleSheet: {
      create: (o) => o,
      flatten: (o) => (Array.isArray(o) ? Object.assign({}, ...o.filter(Boolean)) : o || {}),
      absoluteFill: {},
      hairlineWidth: 1,
    },
    Platform: { OS: 'android', select: (o) => o.android ?? o.default },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Animated: new Proxy({}, { get: (_t, k) => hostComponent(`Animated.${String(k)}`) }),
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    // Kayitli donanim geri tusu dinleyicileri: sinav bunlari GERCEKTEN
    // cagirabilsin diye disari aciliyor (grep degil, tetikleme).
    BackHandler: {
      addEventListener: (evt, fn) => {
        BACK_HANDLERS.push({ evt, fn });
        return {
          remove() {
            const i = BACK_HANDLERS.findIndex((h) => h.fn === fn);
            if (i >= 0) BACK_HANDLERS.splice(i, 1);
          },
        };
      },
    },
  };
  const proxy = new Proxy(base, {
    get(target, key) {
      if (key === 'default') return proxy;
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (!cache.has(key)) cache.set(key, hostComponent(key));
      return cache.get(key);
    },
    has: () => true,
  });
  return proxy;
}

// ------------------------------------------------------------- hook runtime
let CURRENT = null;
let HOOK_I = 0;

function slot(init) {
  const inst = CURRENT;
  if (!inst) throw new Error('hook, render disinda cagrildi');
  const i = HOOK_I++;
  if (inst.hooks.length <= i) inst.hooks.push(init());
  return inst.hooks[i];
}

function sameDeps(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => Object.is(v, b[i]));
}

const React = {
  createElement,
  Fragment: hostComponent('Fragment'),
  memo: (c) => c,
  forwardRef: (c) => c,
  useState(init) {
    const inst = CURRENT;
    const s = slot(() => ({ v: typeof init === 'function' ? init() : init }));
    const set = (u) => {
      const nv = typeof u === 'function' ? u(s.v) : u;
      const changed = !Object.is(nv, s.v);
      s.v = nv;
      if (changed) inst.scheduleRender();
    };
    return [s.v, set];
  },
  useRef(v) {
    return slot(() => ({ current: v }));
  },
  useEffect(fn, deps) {
    const inst = CURRENT;
    const s = slot(() => ({ deps: null, ran: false, cleanup: undefined }));
    const run = !s.ran || deps === undefined || !sameDeps(s.deps, deps);
    s.deps = deps ? deps.slice() : deps;
    s.ran = true;
    if (run) {
      inst.pending.push(() => {
        if (typeof s.cleanup === 'function') s.cleanup();
        s.cleanup = fn();
      });
    }
  },
  useLayoutEffect(fn, deps) { return React.useEffect(fn, deps); },
  useCallback(f) { return f; },
  useMemo(f) { return f(); },
};

function createElement(type, props, ...children) {
  const kids = children.flat(Infinity).filter((c) => c != null && c !== false && c !== true);
  const p = { ...(props || {}) };
  if (kids.length > 0) p.children = kids.length === 1 ? kids[0] : kids;
  const name = (typeof type === 'function' && type.__host) ? type.__host
    : (typeof type === 'function' ? (type.displayName || type.name || 'anon') : String(type));
  // Ic ice fonksiyon bilesenleri BILEREK CAGRILMAZ: kendi hook'lari mount
  // edilen bilesenin hook siralamasini bozar. Prop'lar yine gorunur.
  return { kind: typeof type === 'function' && !type.__host ? 'component' : 'host', name, props: p, children: kids };
}

const jsx = (type, props) => {
  const { children, ...rest } = props || {};
  const kids = children === undefined ? [] : (Array.isArray(children) ? children : [children]);
  return createElement(type, rest, ...kids);
};
React.jsx = jsx;
React.jsxs = jsx;
React.jsxDEV = jsx;

// ------------------------------------------------------------- modul yukleyici
const CACHE = new Map();

export function loadModule(absPath) {
  const key = path.resolve(absPath);
  if (CACHE.has(key)) return CACHE.get(key);

  const kod = readFileSync(key, 'utf8');
  const { code } = babel.transformSync(kod, {
    filename: key,
    presets: [['babel-preset-expo', {}]],
    babelrc: false,
    configFile: false,
    sourceType: 'module',
  });

  const RN = makeReactNativeStub();
  const stubRequire = (spec) => {
    // Babel'in kendi calisma zamani yardimcilari GERCEK olmali; stub'lanirsa
    // `_interopRequireWildcard(require('react'))` null doner ve
    // `_react.default.memo` patlar (eski kosum takiminda oldu).
    if (spec.startsWith('@babel/runtime')) return nodeRequire(spec);
    if (spec === 'react') return { __esModule: true, default: React, ...React };
    if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') {
      return { jsx: React.jsx, jsxs: React.jsxs, jsxDEV: React.jsxDEV, Fragment: React.Fragment };
    }
    if (spec === 'react-native') return RN;
    if (spec.startsWith('.')) {
      const child = path.resolve(path.dirname(key), spec.endsWith('.js') ? spec : `${spec}.js`);
      // Yayilma DEGIL, canli exports nesnesi: babel'in getter'lari korunur.
      return loadModule(child);
    }
    return new Proxy({ __esModule: true }, {
      get: (_t, k) => (k === '__esModule' ? true : hostComponent(`${spec}.${String(k)}`)),
    });
  };

  const module = { exports: {} };
  CACHE.set(key, module.exports); // dairesel import emniyeti
  // eslint-disable-next-line no-new-func
  const fn = new Function('require', 'module', 'exports', 'globalThis', code);
  fn(stubRequire, module, module.exports, globalThis);
  CACHE.set(key, module.exports);
  return module.exports;
}

/** Bir bileseni mount eder; durum ve effect'ler GERCEKTEN calisir. */
export function mount(absPath, props = {}, exportName = 'default') {
  const mod = loadModule(absPath);
  const Component = mod[exportName];
  if (typeof Component !== 'function') {
    throw new Error(`${absPath} icinde '${exportName}' bir bilesen degil`);
  }
  const inst = {
    hooks: [],
    pending: [],
    props,
    tree: null,
    renders: 0,
    scheduleRender: () => doRender(),
  };

  function doRender() {
    if (inst.renders > 200) throw new Error('sonsuz render dongusu');
    const prevCur = CURRENT;
    const prevIdx = HOOK_I;
    CURRENT = inst;
    HOOK_I = 0;
    inst.renders += 1;
    inst.tree = Component(inst.props);
    CURRENT = prevCur;
    HOOK_I = prevIdx;

    let guard = 0;
    while (inst.pending.length > 0 && guard++ < 50) {
      const fx = inst.pending;
      inst.pending = [];
      fx.forEach((f) => f());
    }
  }

  doRender();

  return {
    get tree() { return inst.tree; },
    get renders() { return inst.renders; },
    setProps(next) {
      inst.props = { ...inst.props, ...next };
      doRender();
    },
    rerender() { doRender(); },
  };
}

/**
 * ⚠️ OLCUMU KALIBRE ET: sahte `Modal` bir host bilesendir ve `visible={false}`
 * olsa bile cocuklarini agacta TASIR. Ham `collectText` bu yuzden KAPALI
 * modallerin metnini de doner ve "Out of Lives ekranda mi" gibi bir soru
 * DAIMA "evet" cikar. Olculdu: bu yanlis olcum "App son seviyeden sonra BITTI
 * ekranini gosterir" testini duzeltme olmadan da YESIL gosteriyordu.
 * Gorunur metin icin AŞAGIDAKI fonksiyon kullanilir.
 */
export function collectVisibleText(node, acc = []) {
  if (node == null || node === false || node === true) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectVisibleText(n, acc);
    return acc;
  }
  if (typeof node === 'object') {
    if (gizliModal(node)) return acc;
    if (node.children) collectVisibleText(node.children, acc);
  }
  return acc;
}

function gizliModal(node) {
  return node.name === 'Modal' && node.props && node.props.visible === false;
}

/** Agactaki metinleri toplar (gorunurluk GOZETMEZ). */
export function collectText(node, acc = []) {
  if (node == null || node === false || node === true) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectText(n, acc);
    return acc;
  }
  if (typeof node === 'object' && node.children) collectText(node.children, acc);
  return acc;
}

/** Metnini iceren ILK GORUNUR dugumu doner. */
export function findByText(node, needle) {
  if (node == null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findByText(n, needle);
      if (hit) return hit;
    }
    return null;
  }
  if (gizliModal(node)) return null;
  const kids = node.children;
  if (kids) {
    for (const k of Array.isArray(kids) ? kids : [kids]) {
      const hit = findByText(k, needle);
      if (hit) return hit;
    }
  }
  if (collectVisibleText(node).join(' ').includes(needle)) return node;
  return null;
}

/**
 * Verilen metni tasiyan en yakin GORUNUR + DOKUNULABILIR (onPress'i olan) ata.
 * Kapali bir Modal'in icindeki dugmeye "basilamaz" — gercek cihazda da oyle.
 */
export function findPressableByText(node, needle) {
  if (node == null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findPressableByText(n, needle);
      if (hit) return hit;
    }
    return null;
  }
  if (gizliModal(node)) return null;
  const kids = node.children;
  if (kids) {
    for (const k of Array.isArray(kids) ? kids : [kids]) {
      const hit = findPressableByText(k, needle);
      if (hit) return hit;
    }
  }
  if (typeof node.props?.onPress === 'function'
      && collectVisibleText(node).join(' ').includes(needle)) {
    return node;
  }
  return null;
}

export function press(node) {
  if (!node || typeof node.props?.onPress !== 'function') {
    throw new Error('dokunulabilir dugum bulunamadi');
  }
  node.props.onPress();
}

/** Tum dugumleri duz bir diziye acar (prop denetimi icin). */
export function flattenNodes(node, acc = []) {
  if (node == null || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const n of node) flattenNodes(n, acc);
    return acc;
  }
  acc.push(node);
  const kids = node.children;
  if (kids) {
    for (const k of Array.isArray(kids) ? kids : [kids]) flattenNodes(k, acc);
  }
  return acc;
}
