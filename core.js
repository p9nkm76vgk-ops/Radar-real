/** PriceRadar domain logic: no side effects, no network, no fictitious prices. */
export const EUR = new Intl.NumberFormat('es-ES', {style:'currency',currency:'EUR'});
export const DATE = new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'});
export const DAY = 86_400_000;
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function cents(input) {
  const normalized = String(input ?? '').trim().replace(/\s/g,'').replace(/€/g,'');
  if (!/^(?:\d{1,9})(?:[,.]\d{1,2})?$/.test(normalized)) throw new Error('Introduce un importe válido en euros (máximo dos decimales).');
  const [whole, frac=''] = normalized.replace(',','.').split('.');
  const value = Number(whole)*100 + Number(frac.padEnd(2,'0'));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('El importe debe ser mayor que cero.');
  return value;
}
export const euros = n => n == null ? 'Sin verificar' : EUR.format(n/100);
export const date = x => x ? DATE.format(new Date(x)) : 'Sin registrar';
export function escapeHTML(value='') {
  return String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function safeExternalUrl(value) {
  if (!value || !String(value).trim()) return null;
  try {
    const url=new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname.length > 255 || url.href.length > 2000 || url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return url.href;
  } catch {return null;}
}
export function assertText(input,label,max=120) {
  const value=String(input??'').trim();
  if(!value || value.length>max) throw new Error(`${label}: introduce entre 1 y ${max} caracteres.`);
  return value;
}
export function recentObservations(observations,offerId){return observations.filter(o=>o.offerId===offerId).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt) || a.id.localeCompare(b.id));}
export function totalCents(o) {
  if(!o || o.priceCents==null || o.shippingCents==null || o.taxesIncluded!==true) return null;
  return o.priceCents + o.shippingCents;
}
export function comparable(a,b) {
  return !!a && !!b && a.offerId===b.offerId && a.currency==='EUR' && b.currency==='EUR' && a.availability==='in_stock' && b.availability==='in_stock' && totalCents(a)!==null && totalCents(b)!==null;
}
export function latest(arr){return [...arr].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt) || b.id.localeCompare(a.id))[0]??null;}
export function metrics(observations,days=30,referenceTime=Date.now()) {
  const since=days===0 ? -Infinity : referenceTime-days*DAY;
  const inRange=observations.filter(o=>Date.parse(o.observedAt)>=since && Date.parse(o.observedAt)<=referenceTime && o.availability==='in_stock' && totalCents(o)!==null);
  const values=inRange.map(totalCents).sort((a,b)=>a-b);
  const coveredDays=new Set(inRange.map(o=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date(o.observedAt))));
  const daysCovered=coveredDays.size;
  let maxGapDays=days;
  if(days && coveredDays.size) {
    const dates=[...coveredDays].sort();
    const startDate=new Date(referenceTime-days*DAY).toISOString().slice(0,10);
    const endDate=new Date(referenceTime).toISOString().slice(0,10);
    const ticks=[startDate,...dates,endDate].map(x=>Date.parse(x+'T12:00:00Z'));
    maxGapDays=Math.max(0,...ticks.slice(1).map((x,i)=>Math.max(0,Math.round((x-ticks[i])/DAY)-1)));
  }
  const median=values.length ? (values.length%2 ? values[(values.length-1)/2] : (values[values.length/2-1]+values[values.length/2])/2) : null;
  const highCoverage=days===30 && daysCovered>=20 && maxGapDays<=3;
  return {min:values.length?values[0]:null,median:highCoverage?median:null,descriptiveMedian:median,highCoverage,daysCovered,maxGapDays,samples:values.length,windowDays:days};
}
export function ruleCondition(rule,current,previous,history=[]) {
  if(!current || current.availability!=='in_stock') return false;
  const total=totalCents(current);
  if(rule.type==='target') return total!==null && total<=rule.threshold;
  if(rule.type==='drop_eur') return comparable(previous,current) && totalCents(previous)-total>=rule.threshold;
  if(rule.type==='drop_pct') return comparable(previous,current) && totalCents(previous)>0 && (totalCents(previous)-total)*10000/totalCents(previous)>=rule.threshold;
  if(rule.type==='restock') return previous?.availability==='out_of_stock' && current.availability==='in_stock';
  if(rule.type==='observed_low') {
    const previousTotals=history.filter(o=>o.id!==current.id && comparable(o,current)).map(totalCents);
    return total!==null && previousTotals.length>=2 && total<Math.min(...previousTotals);
  }
  return false;
}
export function evaluateRules(rules,current,previous,history,nowMs=Date.now()) {
  return rules.map(rule=>{
    if(!rule.enabled || rule.offerId!==current.offerId) return {rule,fire:false,condition:false,changed:false};
    const condition=ruleCondition(rule,current,previous,history);
    const last=rule.lastTriggeredAt?Date.parse(rule.lastTriggeredAt):0;
    const cooldownOK=nowMs-last>=(rule.cooldownHours??24)*3600_000;
    const fire=condition && !rule.lastConditionMet && cooldownOK;
    return {rule:{...rule,lastConditionMet:condition,lastTriggeredAt:fire?new Date(nowMs).toISOString():rule.lastTriggeredAt??null},fire,condition,changed:true};
  });
}
export function compareOffers(offers,observations,productId) {
  return offers.filter(o=>o.productId===productId).map(offer=>{
    const observation=latest(observations.filter(o=>o.offerId===offer.id));
    return {offer,observation,total:totalCents(observation)};
  }).sort((a,b)=> (a.total===null)-(b.total===null) || (a.total??Infinity)-(b.total??Infinity));
}
export function csvCell(value) {let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return /[",\r\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
export function csv(rows) {return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';}
export function timeAgo(value,nowMs=Date.now()) {
  if(!value)return 'Sin datos'; const hours=Math.floor((nowMs-Date.parse(value))/3600_000);
  if(hours<0)return 'Fecha futura'; if(hours<1)return 'Hace menos de 1 h';if(hours<24)return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours/24)} d`;
}
