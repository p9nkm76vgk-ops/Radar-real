import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,euros,escapeHTML,safeExternalUrl,totalCents,comparable,ruleCondition,evaluateRules,compareOffers,metrics,csv} from '../src/core.js';
const obs=(n,overrides={})=>({id:String(n),offerId:'offer1',priceCents:n*100,shippingCents:0,taxesIncluded:true,availability:'in_stock',currency:'EUR',observedAt:'2026-11-17T10:00:00.000Z',...overrides});
test('convierte euros exactos a enteros de céntimos',()=>{assert.equal(cents('9,99'),999);assert.equal(cents('10.50'),1050);assert.equal(cents('0,01'),1);assert.equal(cents('1 250,75 €'),125075);});
test('rechaza importes ambiguos, negativos, cero y precisión excesiva',()=>{for(const bad of ['0','-2','1.234,56','1,999','','abc','0,00','1e3'])assert.throws(()=>cents(bad));});
test('total solo si envío e impuestos son explícitos',()=>{assert.equal(totalCents(obs(100)),10000);assert.equal(totalCents(obs(100,{shippingCents:399})),10399);assert.equal(totalCents(obs(100,{shippingCents:null})),null);assert.equal(totalCents(obs(100,{taxesIncluded:null})),null);});
test('misma oferta y disponibilidad requeridas para comparar',()=>{assert.equal(comparable(obs(100),obs(80)),true);assert.equal(comparable(obs(100),obs(80,{offerId:'otra'})),false);assert.equal(comparable(obs(100),obs(80,{shippingCents:null})),false);assert.equal(comparable(obs(100),obs(80,{availability:'out_of_stock'})),false);});
test('umbral absoluto y porcentaje contra anterior comparable',()=>{let rule={type:'drop_eur',threshold:1200};assert.equal(ruleCondition(rule,obs(75),obs(90)),true);assert.equal(ruleCondition(rule,obs(85),obs(90)),false);rule={type:'drop_pct',threshold:1000};assert.equal(ruleCondition(rule,obs(89),obs(100)),true);assert.equal(ruleCondition(rule,obs(95),obs(100)),false);});
test('umbral target no depende de descuento anunciado ni MSRP',()=>{const rule={type:'target',threshold:8500};assert.equal(ruleCondition(rule,obs(80),obs(99)),true);assert.equal(ruleCondition(rule,obs(86),obs(90)),false);assert.equal(ruleCondition(rule,obs(80,{shippingCents:null}),obs(99)),false);});
test('no duplica alertas si sigue la misma condición',()=>{const rule={id:'r1',offerId:'offer1',type:'target',threshold:8000,enabled:true,lastConditionMet:false,lastTriggeredAt:null,cooldownHours:0};const a=evaluateRules([rule],obs(79),obs(91),[],Date.parse('2026-11-17T10:00:00Z'));assert.equal(a[0].fire,true);const b=evaluateRules([a[0].rule],obs(78),obs(79),[],Date.parse('2026-11-17T20:00:00Z'));assert.equal(b[0].fire,false);const c=evaluateRules([b[0].rule],obs(95),obs(78),[],Date.parse('2026-11-18T20:00:00Z'));assert.equal(c[0].fire,false);const d=evaluateRules([c[0].rule],obs(65),obs(95),[],Date.parse('2026-11-19T20:00:00Z'));assert.equal(d[0].fire,true);});
test('restock precisa transición desde fuera de stock',()=>{assert.equal(ruleCondition({type:'restock'},obs(60),obs(60,{availability:'out_of_stock'})),true);assert.equal(ruleCondition({type:'restock'},obs(60),obs(60)),false);});
test('mínimo observado no equivale a mínimo histórico sin registros anteriores',()=>{const current=obs(70,{id:'c'});const rule={type:'observed_low'};assert.equal(ruleCondition(rule,current,obs(90),[obs(90),current]),false);assert.equal(ruleCondition(rule,current,obs(80),[obs(90),obs(80),current]),true);});
test('comparador no sitúa envío desconocido como ganador de total',()=>{const offers=[{id:'a',productId:'p'},{id:'b',productId:'p'}],observations=[obs(40,{offerId:'a',shippingCents:null}),obs(50,{offerId:'b'})];const ranked=compareOffers(offers,observations,'p');assert.equal(ranked[0].offer.id,'b');assert.equal(ranked[1].total,null);});
test('cobertura insuficiente no habilita mediana fiable',()=>{const result=metrics([obs(40),obs(50)],30,Date.parse('2026-11-18T12:00:00Z'));assert.equal(result.daysCovered,1);assert.equal(result.highCoverage,false);assert.equal(result.median,null);assert.equal(result.min,4000);});
test('enlaces peligrosos e internos rechazados para enlace manual',()=>{for(const input of ['javascript:alert(1)','http://example.com','https://127.0.0.1','https://localhost','https://user:pass@example.com','https://[::1]','file:///etc/passwd'])assert.equal(safeExternalUrl(input),null);assert.equal(safeExternalUrl('https://example.com/producto?a=1'),'https://example.com/producto?a=1');});
test('texto y CSV escapan contenido inyectado',()=>{assert.equal(escapeHTML('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');assert.ok(csv([['x;"','b']]).includes('"x;"""'));});
test('mediana solo con cobertura temporal alta de 30 días',()=>{
 const ref=Date.parse('2026-11-30T12:00:00Z');
 const samples=Array.from({length:29},(_,i)=>obs(100+i,{id:`s${i}`,observedAt:new Date(ref-i*24*60*60*1000).toISOString()}));
 const result=metrics(samples,30,ref);
 assert.equal(result.highCoverage,true);
 assert.equal(result.daysCovered,29);
 assert.equal(result.min,10000);
 assert.equal(result.median,11400);
});
test('CSV evita fórmulas que empiezan por = + - o @',()=>{
 const out=csv([['=1+1','+SUM(A1)','-2+3','@remote']]);
 assert.ok(out.includes("'=1+1"));
 assert.ok(out.includes("'+SUM(A1)"));
 assert.ok(out.includes("'-2+3"));
 assert.ok(out.includes("'@remote"));
});
test('variantes diferentes no deben compararse por oferta',()=>{
 assert.equal(comparable(obs(100,{offerId:'model-black'}),obs(80,{offerId:'model-white'})),false);
});
