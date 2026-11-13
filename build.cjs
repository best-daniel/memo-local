'use strict';
const fs=require('node:fs'),path=require('node:path');
const languages=['en','ko','de'];
const seo={
 en:{title:'Memo Local — Online Notepad',description:'A browser-based notepad with list, table and sticky-note views. Save notes locally and export or merge JSON backups.',heading:'Your notes, stored in your browser',intro:'Write notes in a single field, choose your preferred layout, and keep a JSON backup for another computer. No account is required.',privacy:'Notes are stored in this browser, not on a shared server. Clearing browser data can delete them. Export a backup before switching devices.'},
 ko:{title:'Memo Local — 온라인 메모장',description:'브라우저에 저장하는 간편한 온라인 메모장. 리스트·테이블·포스트잇 보기, JSON 백업과 가져오기·병합을 지원합니다.',heading:'브라우저에 저장하는 나만의 메모',intro:'입력란 하나로 메모를 작성하고 보기 방식을 선택하세요. JSON 백업으로 다른 PC에 옮길 수 있으며 회원가입이 필요 없습니다.',privacy:'메모는 공통 서버가 아닌 이 브라우저에 저장됩니다. 브라우저 데이터 삭제 시 사라질 수 있으므로 기기를 변경하기 전에 백업하세요.'},
 de:{title:'Memo Local — Online-Notizblock',description:'Notizen lokal im Browser speichern. Mit Listen-, Tabellen- und Haftnotizansicht sowie JSON-Sicherung, Import und Zusammenführung.',heading:'Ihre Notizen, in Ihrem Browser gespeichert',intro:'Notizen in einem einzigen Feld schreiben, die Ansicht auswählen und JSON-Sicherungen auf einen anderen Computer übertragen. Kein Konto erforderlich.',privacy:'Notizen werden in diesem Browser gespeichert, nicht auf einem gemeinsamen Server. Beim Löschen der Browserdaten können sie verloren gehen. Vor einem Gerätewechsel sichern.'}
};
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function origin(env){const raw=env.SITE_URL||(env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+env.VERCEL_PROJECT_PRODUCTION_URL:'');if(!raw)return '';const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('SITE_URL must be a site origin, e.g. https://example.com');return url.origin;}
function render(template,messages,lang,base,indexable){
 const translate=key=>messages[key]?.[lang]||key;
 let html=template.replace(/(<[a-zA-Z][^>]*>)([^<>]*)(?=<)/g,(all,tag,text)=>{const trimmed=text.trim();return messages[trimmed]?tag+text.replace(trimmed,escape(translate(trimmed))):all;});
 html=html.replace(/(placeholder|aria-label|title)="([^"]*)"/g,(all,attr,text)=>messages[text]?`${attr}="${escape(translate(text))}"`:all);
 html=html.replace(/<html lang="[^"]*"/,`<html lang="${lang}"`).replace(/<title>[^<]*<\/title>/,`<title>${escape(seo[lang].title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escape(seo[lang].description)}">`);
 html=html.replace(/(src|href)="(?!https?:|\/|#)([^" ]+\.(?:js|css))"/g,'$1="/$2"');
 let head=`<meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}">`;
 if(base){head+=`<link rel="canonical" href="${escape(base)}/${lang}/">`;for(const l of languages)head+=`<link rel="alternate" hreflang="${l}" href="${escape(base)}/${l}/">`;head+=`<link rel="alternate" hreflang="x-default" href="${escape(base)}/en/">`;}
 html=html.replace('</head>',head+'</head>');
 const nav=languages.map(l=>`<a href="/${l}/" lang="${l}" hreflang="${l}"${l===lang?' aria-current="page"':''}>${{en:'English',ko:'한국어',de:'Deutsch'}[l]}</a>`).join(' · ');
 return html.replace('<main>',`<main><section class="public-intro"><nav aria-label="${{en:'Language',ko:'언어',de:'Sprache'}[lang]}">${nav}</nav><h2>${escape(seo[lang].heading)}</h2><p>${escape(seo[lang].intro)}</p><p class="storage-note">${escape(seo[lang].privacy)}</p></section>`);
}
function build(dir=__dirname,env=process.env){
 const base=origin(env),indexable=Boolean(base)&&env.VERCEL_ENV!=='preview'&&env.VERCEL_ENV!=='development';
 const source=fs.readFileSync(path.join(dir,'i18n.js'),'utf8');const messages=JSON.parse(source.split('const messages = ')[1].split(';\nlet language')[0]);
 const template=fs.readFileSync(path.join(dir,'index.html'),'utf8');const out=path.join(dir,'dist');fs.mkdirSync(out,{recursive:true});
 for(const f of ['style.css','app.js','transfer.js','i18n.js'])fs.copyFileSync(path.join(dir,f),path.join(out,f));
 for(const lang of languages){fs.mkdirSync(path.join(out,lang),{recursive:true});fs.writeFileSync(path.join(out,lang,'index.html'),render(template,messages,lang,base,indexable));}
 fs.writeFileSync(path.join(out,'index.html'),render(template,messages,'en',base,indexable));
 fs.writeFileSync(path.join(out,'robots.txt'),indexable?`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
 const urls=base?languages.map(l=>`<url><loc>${escape(base)}/${l}/</loc></url>`).join(''):'';
 fs.writeFileSync(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
 console.log('Built /en/, /ko/, /de/; search indexing '+(indexable?'enabled':'disabled (Preview or missing SITE_URL)'));
}
if(require.main===module)build();module.exports={render,origin,seo};
