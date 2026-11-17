/** Build determinista de la edición estática; excluye código técnico y archivos privados. */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root=process.cwd();
const dest=join(root,'dist');
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
for(const file of ['index.html','styles.css','manifest.webmanifest','sw.js']) {
  await cp(join(root,file),join(dest,file));
}
for(const folder of ['src','assets']){
  await cp(join(root,folder),join(dest,folder),{recursive:true});
}
await writeFile(join(dest,'.nojekyll'),'');
console.log('Sitio estático generado en dist/ (sin documentación, pruebas ni borrador SQL).');
