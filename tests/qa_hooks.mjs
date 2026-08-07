// Loader hooks: (1) alias AsyncStorage to the in-memory stub,
// (2) add the .js extension that RN's bundler adds but node ESM does not.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const STUB = pathToFileURL(path.join(import.meta.dirname, 'qa_asyncstorage_stub.mjs')).href;
// Depo koku — uzanti ekleme YALNIZCA bu agacin KENDI kaynak dosyalarina uygulanir.
const KOK = pathToFileURL(path.join(import.meta.dirname, '..')).href.replace(/\/?$/, '/');

// ⚠️ Bu hook ayni surecte calisan CJS paketlerini de yakalar. Once kosul
// `!/\.[mc]?js$/` idi ve babel'in `require('./data/plugins.json')` cagrisini
// `.json.js` yapiyordu; sonra "uzantisi yok" kosulu RN codegen'in dizin
// require'ini (`require('./components')`) bozdu. Bu yuzden artik IMPORT EDEN
// dosyanin da depo icinde ve node_modules DISINDA olmasi araniyor.
function bizimKaynak(parentURL) {
  if (!parentURL) return false;
  if (!parentURL.startsWith(KOK)) return false;
  return !parentURL.includes('/node_modules/');
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.includes('async-storage')) {
      return { url: STUB, shortCircuit: true };
    }
    if (
      specifier.startsWith('.') &&
      !/\.[A-Za-z0-9]+$/.test(specifier) &&
      bizimKaynak(context?.parentURL)
    ) {
      return nextResolve(specifier + '.js', context);
    }
    return nextResolve(specifier, context);
  },
});
