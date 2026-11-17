import {id,now,cents,assertText,safeExternalUrl,latest, evaluateRules, recentObservations,totalCents} from './core.js';

const DB_NAME='priceradar-manual-v1';
const VERSION=1;
export const STORES=['products','offers','watchlists','watches','observations','rules','events','notifications','preferences'];
let openPromise;
export function openDB() {
 if(openPromise)return openPromise;
 openPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
   const offer=db.transaction.objectStore('offers');offer.createIndex('productId','productId');
   const obs=db.transaction.objectStore('observations');obs.createIndex('offerId','offerId');
   const watches=db.transaction.objectStore('watches');watches.createIndex('productId','productId');
   const rules=db.transaction.objectStore('rules');rules.createIndex('watchId','watchId');
   const events=db.transaction.objectStore('events');events.createIndex('eventKey','eventKey',{unique:true});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
 return openPromise;
}
function txDone(tx) {return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Transacción cancelada'));});}
function reqPromise(req) {return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function snapshot(){
 const db=await openDB();const tx=db.transaction(STORES,'readonly');
 const requests=STORES.map(s=>reqPromise(tx.objectStore(s).getAll()));
 const lists=await Promise.all(requests);return Object.fromEntries(STORES.map((s,i)=>[s,lists[i]]));
}
export async function addProduct(form){
 const db=await openDB();
 const product={id:id(),name:assertText(form.name,'Nombre',150),brand:String(form.brand||'').trim().slice(0,80),model:String(form.model||'').trim().slice(0,100),variant:assertText(form.variant||'Variante sin especificar','Variante',150),condition:form.condition==='refurbished'?'refurbished':'new',category:form.category||'Otros',region:'ES',gtin:String(form.gtin||'').trim().slice(0,32),createdAt:now(),source:'manual'};
 const sourceUrl=form.url?.trim()?safeExternalUrl(form.url):null;
 if(form.url?.trim() && !sourceUrl)throw new Error('La URL debe ser HTTPS pública y no contener credenciales.');
 const offer={id:id(),productId:product.id,merchantName:assertText(form.merchant||'Observación personal','Tienda/fuente',100),sellerName:'',sourceUrl,condition:product.condition,region:'ES',currency:'EUR',mode:'manual_only',createdAt:now()};
 const watch={id:id(),productId:product.id,watchlistId:form.watchlistId||'default',status:'manual_only',monitoringMode:'manual',targetCents:form.target?cents(form.target):null,priority:'normal',createdAt:now()};
 const observation=form.price?makeObservation(offer.id,form):null;
 const rule=watch.targetCents==null?null:{id:id(),watchId:watch.id,offerId:offer.id,type:'target',threshold:watch.targetCents,cooldownHours:24,enabled:true,lastConditionMet:observation?totalCents(observation)!==null&&totalCents(observation)<=watch.targetCents:false,lastTriggeredAt:null,createdAt:now()};
 const tx=db.transaction(['products','offers','watches','observations','rules'],'readwrite');
 tx.objectStore('products').put(product);tx.objectStore('offers').put(offer);tx.objectStore('watches').put(watch);
 if(observation)tx.objectStore('observations').put(observation);if(rule)tx.objectStore('rules').put(rule);
 await txDone(tx);return product;
}
function nonnegativeCents(input) {
 const value=String(input??'').trim();
 if (!value || /^0(?:[,.]0{1,2})?$/.test(value)) return 0;
 return cents(value);
}
function makeObservation(offerId,form) {
 const observedAt=form.observedAt ? new Date(form.observedAt).toISOString():now();
 if(!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt)>Date.now()+60_000)throw new Error('La fecha de observación no puede ser futura.');
 let shipping=null;
 if(form.shippingKnown===true || form.shippingKnown==='on' || form.shippingKnown==='yes') shipping=nonnegativeCents(form.shipping);
 return {id:id(),offerId,priceCents:cents(form.price),shippingCents:shipping,taxesIncluded:form.taxesIncluded===true||form.taxesIncluded==='on',availability:form.availability==='out_of_stock'?'out_of_stock':'in_stock',currency:'EUR',observedAt,ingestedAt:now(),source:'manual',sourceNote:String(form.note||'').trim().slice(0,300)};
}
export async function addObservation(form){
 const db=await openDB();const offer=await reqPromise(db.transaction('offers').objectStore('offers').get(form.offerId));
 if(!offer)throw new Error('La fuente ya no existe.');
 const obs=makeObservation(offer.id,form);
 const data=await snapshot();const all=recentObservations(data.observations,offer.id);
 const previous=latest(all.filter(o=>Date.parse(o.observedAt)<=Date.parse(obs.observedAt)));
 const watch=data.watches.find(w=>w.productId===offer.productId);
 const rules=watch?.status==='paused_user' ? [] : data.rules.filter(rule=>rule.offerId===offer.id);
 // Backdated observations must not create notifications about supposedly current prices.
 const latestExisting=latest(all);
 const outcomes=latestExisting && Date.parse(obs.observedAt)<Date.parse(latestExisting.observedAt) ? [] : evaluateRules(rules,obs,previous,[...all,obs]);
 const tx=db.transaction(['observations','rules','events','notifications'],'readwrite');
 tx.objectStore('observations').put(obs);
 for(const outcome of outcomes){
  if(outcome.changed)tx.objectStore('rules').put(outcome.rule);
  if(outcome.fire){
   const event={id:id(),ruleId:outcome.rule.id,offerId:offer.id,observationId:obs.id,triggeredPriceCents:totalCents(obs),eventKey:`${outcome.rule.id}:${obs.id}`,createdAt:now()};
   const n={id:id(),eventId:event.id,productId:offer.productId,channel:'in_app',state:'delivered',createdAt:now(),readAt:null,type:outcome.rule.type,observedAt:obs.observedAt};
   tx.objectStore('events').put(event);tx.objectStore('notifications').put(n);
  }
 }
 await txDone(tx);return {observation:obs,fired:outcomes.filter(o=>o.fire).length};
}
export async function addOffer(productId,form){
 const product=await reqPromise((await openDB()).transaction('products').objectStore('products').get(productId));
 if(!product)throw new Error('Producto no encontrado.');
 const url=form.url?.trim()?safeExternalUrl(form.url):null;
 if(form.url?.trim() && !url)throw new Error('Enlace no válido (solo HTTPS público).');
 const offer={id:id(),productId,merchantName:assertText(form.merchant,'Tienda / fuente',100),sellerName:'',sourceUrl:url,condition:product.condition,region:'ES',currency:'EUR',mode:'manual_only',createdAt:now()};
 const db=await openDB();const tx=db.transaction('offers','readwrite');tx.objectStore('offers').put(offer);await txDone(tx);return offer;
}
export async function addRule(form){
 const data=await snapshot();const watch=data.watches.find(w=>w.id===form.watchId);const offer=data.offers.find(o=>o.id===form.offerId);
 if(!watch||!offer||offer.productId!==watch.productId) throw new Error('La regla no corresponde al producto.');
 const threshold=form.type==='drop_pct'?Math.round(Number(String(form.threshold).replace(',','.'))*100):cents(form.threshold);
 if(!Number.isSafeInteger(threshold)||threshold<=0 || (form.type==='drop_pct'&&threshold>10000))throw new Error('Umbral no válido.');
 const current=latest(data.observations.filter(o=>o.offerId===offer.id));
 const {ruleCondition}=await import('./core.js');
 const all=recentObservations(data.observations,offer.id);const previous=all.length>=2?all[all.length-2]:null;
 const rule={id:id(),watchId:watch.id,offerId:offer.id,type:form.type,threshold,cooldownHours:24,enabled:true,lastConditionMet:false,lastTriggeredAt:null,createdAt:now()};
 rule.lastConditionMet=!!(current && ruleCondition(rule,current,previous,all));
 const db=await openDB();const tx=db.transaction('rules','readwrite');tx.objectStore('rules').put(rule);await txDone(tx);return rule;
}
export async function mutate(storeName,idValue,changes) {
 if(!STORES.includes(storeName))throw new Error('Entidad no válida.');
 const db=await openDB();const tx=db.transaction(storeName,'readwrite');const store=tx.objectStore(storeName);
 const entry=await reqPromise(store.get(idValue));if(!entry)throw new Error('No existe este registro.');
 store.put({...entry,...changes,id:idValue});await txDone(tx);
}
export async function erase(storeName,idValue){
 if(!['rules','notifications'].includes(storeName))throw new Error('Eliminación no permitida.');
 const db=await openDB();const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(idValue);await txDone(tx);
}
export async function addCollection(name){const data=await snapshot();const clean=assertText(name,'Colección',60);if(data.watchlists.some(x=>x.name.toLowerCase()===clean.toLowerCase()))throw new Error('Esa colección ya existe.');const tx=(await openDB()).transaction('watchlists','readwrite');tx.objectStore('watchlists').put({id:id(),name:clean,createdAt:now()});await txDone(tx);}
export async function deleteCollection(collectionId){
 const db=await openDB();const data=await snapshot();const tx=db.transaction(['watchlists','watches'],'readwrite');
 tx.objectStore('watchlists').delete(collectionId);
 for(const watch of data.watches.filter(w=>w.watchlistId===collectionId))tx.objectStore('watches').put({...watch,watchlistId:'default'});
 await txDone(tx);
}
export async function deleteProduct(productId){
 const data=await snapshot();const offerIds=new Set(data.offers.filter(o=>o.productId===productId).map(o=>o.id));const watchIds=new Set(data.watches.filter(w=>w.productId===productId).map(w=>w.id));const ruleIds=new Set(data.rules.filter(r=>watchIds.has(r.watchId)).map(r=>r.id));const eventIds=new Set(data.events.filter(e=>ruleIds.has(e.ruleId)).map(e=>e.id));
 const db=await openDB();const tx=db.transaction(['products','offers','watches','observations','rules','events','notifications'],'readwrite');
 tx.objectStore('products').delete(productId);
 for(const x of offerIds)tx.objectStore('offers').delete(x);
 for(const x of watchIds)tx.objectStore('watches').delete(x);
 for(const x of data.observations.filter(o=>offerIds.has(o.offerId)))tx.objectStore('observations').delete(x.id);
 for(const x of ruleIds)tx.objectStore('rules').delete(x);
 for(const x of eventIds)tx.objectStore('events').delete(x);
 for(const x of data.notifications.filter(n=>eventIds.has(n.eventId)))tx.objectStore('notifications').delete(x.id);
 await txDone(tx);
}
export async function deleteAll(){const db=await openDB();const tx=db.transaction(STORES,'readwrite');for(const n of STORES)tx.objectStore(n).clear();await txDone(tx);}

/** Import a user-owned local backup; replacement is atomic across all object stores. */
export async function importBackup(payload) {
 if(!payload || payload.version!==1 || payload.edition!=='manual-local')throw new Error('Archivo no compatible con PriceRadar local.');
 const sets={};let count=0;
 for(const name of STORES){
  if(!Array.isArray(payload[name]))throw new Error(`Faltan registros de ${name}.`);
  const ids=new Set();sets[name]=payload[name];
  for(const item of sets[name]){
   if(!item || typeof item!=='object' || typeof item.id!=='string' || item.id.length>120 || !item.id || ids.has(item.id))throw new Error(`Identificadores incorrectos en ${name}.`);
   ids.add(item.id);count++;
  }
 }
 if(count>50000)throw new Error('La copia supera el límite de 50.000 registros.');
 const products=new Set(sets.products.map(x=>x.id));
 const offers=new Set(sets.offers.map(x=>x.id));
 const watches=new Set(sets.watches.map(x=>x.id));
 const rules=new Set(sets.rules.map(x=>x.id));
 const events=new Set(sets.events.map(x=>x.id));
 if(sets.offers.some(o=>!products.has(o.productId)||o.mode!=='manual_only'||(o.sourceUrl&&!safeExternalUrl(o.sourceUrl))) || sets.watches.some(w=>!products.has(w.productId)||w.monitoringMode!=='manual') || sets.observations.some(o=>!offers.has(o.offerId)||o.source!=='manual'||!Number.isSafeInteger(o.priceCents)||o.priceCents<=0) || sets.rules.some(r=>!watches.has(r.watchId)||!offers.has(r.offerId)) || sets.events.some(ev=>!rules.has(ev.ruleId)) || sets.notifications.some(n=>!events.has(n.eventId))){
  throw new Error('La copia contiene relaciones o datos de procedencia inválidos.');
 }
 const db=await openDB();const tx=db.transaction(STORES,'readwrite');
 for(const name of STORES){const store=tx.objectStore(name);store.clear();for(const value of sets[name])store.put(value);}
 await txDone(tx);return count;
}
