/** Comprobaciones estáticas para evitar publicar una PWA sin recursos esenciales. */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const path=join(process.cwd(),'dist');
for(const name of ['index.html','styles.css','manifest.webmanifest','sw.js','src/app.js','src/core.js','src/storage.js','assets/logo.svg','assets/icon-192.png','assets/icon-512.png','.nojekyll']){
  const s=await stat(join(path,name));
  assert.ok(s.isFile(),`Archivo requerido ausente: ${name}`);
}
const html=await readFile(join(path,'index.html'),'utf8');
const manifest=JSON.parse(await readFile(join(path,'manifest.webmanifest'),'utf8'));
const sw=await readFile(join(path,'sw.js'),'utf8');
for(const rel of ['./src/app.js','./styles.css','./manifest.webmanifest','./assets/logo.svg']) assert.ok(html.includes(rel),`Referencia HTML ausente: ${rel}`);
assert.ok(manifest.start_url.startsWith('./'),'La PWA debe funcionar en subruta de Pages');
assert.ok(manifest.scope.startsWith('./'),'El scope PWA debe quedar en el repositorio');
assert.ok(sw.includes("'./index.html'")&&sw.includes("'./src/app.js'"),'La caché offline debe contener archivos esenciales');
console.log('Verificación de assets y subruta de GitHub Pages: OK');
