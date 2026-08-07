/**
 * MINI RENDERER — "kaynakta grep" degil, BILESENI GERCEKTEN CALISTIRIR.
 *
 * NEDEN VAR: DailyQuestsModal'in cokmesi (`q.progress.toLocaleString()`)
 * yalnizca QuestRow'un GOVDESI calisinca ortaya cikar. React elemanlari
 * tembeldir: `<QuestRow q={...} />` yazmak QuestRow'u CAGIRMAZ. Kaynakta
 * desen aramak da cokmeyi kanitlamaz.
 *
 * Bu yardimci dosyayi Metro'nun kullandigi transform'la (babel-preset-expo)
 * CJS'e cevirir, `react` / `react-native` / `expo-*` yerine sahte modul verir
 * ve fonksiyon bilesenlerini ANINDA cagiran bir createElement kullanir ->
 * tum agac derinlemesine GERCEKTEN calisir. Bir alt bilesen atarsa buradan
 * gercek bir istisna gelir.
 *
 * ⚠️ KAPSAM: yalnizca render govdesi. Yerlesim, dokunma, animasyon, gercek
 * React reconciler davranisi BU SINAVIN DISINDA.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

/** Her sey icin gecerli sahte "host bilesen" ureten proxy. */
function hostComponent(name) {
  const fn = () => null;
  fn.displayName = name;
  fn.toString = () => name;
  fn.__host = name;
  return fn;
}

function makeReactNativeStub() {
  const cache = new Map();
  const base = {
    StyleSheet: {
      create: (o) => o,
      flatten: (o) => (Array.isArray(o) ? Object.assign({}, ...o.filter(Boolean)) : o || {}),
      absoluteFill: {},
      hairlineWidth: 1,
    },
    Platform: { OS: 'ios', select: (o) => o.ios ?? o.default },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Animated: new Proxy({}, { get: (_t, k) => hostComponent(`Animated.${String(k)}`) }),
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (!cache.has(key)) cache.set(key, hostComponent(key));
      return cache.get(key);
    },
    has: () => true,
  });
}

/**
 * Fonksiyon bilesenlerini ANINDA cagiran createElement.
 * Donen deger duz bir agac; `flatten(tree)` ile metinleri toplayabilirsin.
 */
function makeReact() {
  const createElement = (type, props, ...children) => {
    const kids = children.flat(Infinity).filter((c) => c != null && c !== false && c !== true);
    const p = { ...(props || {}) };
    if (kids.length > 0) p.children = kids.length === 1 ? kids[0] : kids;
    if (typeof type === 'function' && !type.__host) {
      return { kind: 'component', name: type.name || 'anon', out: type(p) };
    }
    return { kind: 'host', name: type?.__host || String(type), props: p, children: kids };
  };
  const jsx = (type, props) => {
    const { children, ...rest } = props || {};
    const kids = children === undefined ? [] : (Array.isArray(children) ? children : [children]);
    return createElement(type, rest, ...kids);
  };
  return {
    createElement,
    Fragment: hostComponent('Fragment'),
    jsx,
    jsxs: jsx,
    jsxDEV: jsx,
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useRef: (v) => ({ current: v }),
    useCallback: (f) => f,
    useMemo: (f) => f(),
  };
}

/** Agactaki tum metin dugumlerini toplar. */
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
  if (typeof node === 'object') {
    if (node.kind === 'component') return collectText(node.out, acc);
    // `children` ile `props.children` AYNI diziyi gosterir; birini gez.
    if (node.children) collectText(node.children, acc);
    else if (node.props && node.props.children) collectText(node.props.children, acc);
  }
  return acc;
}

/**
 * Bir kaynak dosyayi Metro transform'uyla derleyip sahte modullerle calistirir.
 * `default` disa acilan bileseni doner.
 */
export function loadComponent(absPath) {
  const kod = readFileSync(absPath, 'utf8');
  const { code } = babel.transformSync(kod, {
    filename: absPath,
    presets: [['babel-preset-expo', {}]],
    babelrc: false,
    configFile: false,
    sourceType: 'module',
  });

  const React = makeReact();
  const RN = makeReactNativeStub();
  const stubRequire = (spec) => {
    if (spec === 'react') return { __esModule: true, default: React, ...React };
    if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') {
      return { jsx: React.jsx, jsxs: React.jsxs, jsxDEV: React.jsxDEV, Fragment: React.Fragment };
    }
    if (spec === 'react-native') return { __esModule: true, default: RN, ...RN };
    if (spec.startsWith('expo-') || spec.startsWith('@expo')) {
      return new Proxy({ __esModule: true }, {
        get: (_t, k) => (k === '__esModule' ? true : hostComponent(String(k))),
      });
    }
    if (spec.startsWith('.')) {
      // Kardes kaynak dosyalari da ayni sekilde yuklenir.
      const child = path.resolve(path.dirname(absPath), spec.endsWith('.js') ? spec : `${spec}.js`);
      return { __esModule: true, ...loadComponentModule(child) };
    }
    return new Proxy({ __esModule: true }, { get: () => hostComponent(spec) });
  };

  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const fn = new Function('require', 'module', 'exports', 'globalThis', code);
  fn(stubRequire, module, module.exports, globalThis);
  return module.exports;
}

function loadComponentModule(absPath) {
  return loadComponent(absPath);
}

/** Bileseni verilen proplarla DERINLEMESINE calistirir; atarsa istisna gelir. */
export function renderDeep(Component, props) {
  const React = makeReact();
  return React.createElement(Component, props);
}
