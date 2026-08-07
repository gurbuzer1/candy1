// Probe: BoardEngine exports nesnesi YAZILABILIR mi (spy takabilir miyim)?
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule } from '../tests/qa_akis_render.mjs';
const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE = loadModule(path.join(KOK, 'src', 'engine', 'BoardEngine.js'));
for (const ad of ['removeAndCollapse', 'reserveSpecials', 'createBoard']) {
  const d = Object.getOwnPropertyDescriptor(BE, ad);
  console.log(ad, JSON.stringify({ get: !!d.get, set: !!d.set, writable: d.writable, configurable: d.configurable }));
}
const eski = BE.removeAndCollapse;
try { BE.removeAndCollapse = () => 'SPY'; console.log('atama sonrasi:', BE.removeAndCollapse === eski ? 'DEGISMEDI' : 'DEGISTI'); }
catch (e) { console.log('atama HATASI:', e.message); }
