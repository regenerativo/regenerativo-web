/* regenerativo · capa viva */
(function(){
var d=document,H=d.documentElement,rm=matchMedia('(prefers-reduced-motion: reduce)').matches,fino=matchMedia('(hover:hover) and (pointer:fine)').matches;
H.classList.add('vivo');
var fuera=function(el){return el.closest('#hero,.stage,header,.v-gal,.v-mq,nav[aria-label="Redes"]')};

/* galería horizontal (solo inicio) */
var GAL=[
 ['/assets/pub-ciento-dos.jpg','/encargos/ciento-dos','Reforma Ciento dos','Residencial · Bogotá',1,'c',1],
 ['/assets/tcs-tarjeta-portal.jpg','/encargos/topara-concept-store','Topara Concept Store','Comercial · Colombia',.8,'t',1.15],
 ['/assets/thub-portada-benny.jpg','/encargos/t-hub','T-Hub · Nalsani','Oficinas · Bogotá',1.5,'b',.9],
 ['/assets/aira-tarjeta2.jpg','/encargos/studio-aira-ultra','Studio Aira Ultra','Residencial · Chía',.8,'c',1],
 ['/assets/tfs-portada-entrada32.jpg','/encargos/totto-topara-flagship-store','Totto Topara Flagship Store','Comercial · Bogotá',1.5,'t',.85],
 ['/assets/cd-portada-cocina.jpg','/encargos/ciento-dos','Reforma Ciento dos','Residencial · Bogotá',1.78,'b',1],
 ['/assets/tcs-vitrina-b.jpg','/encargos/topara-concept-store','Topara Concept Store','Comercial · Colombia',.75,'c',.8],
 ['/assets/thub-g1-1.jpg','/encargos/t-hub','T-Hub · Nalsani','Oficinas · Bogotá',1,'t',.75],
 ['/assets/aira-portada2.jpg','/encargos/studio-aira-ultra','Studio Aira Ultra','Residencial · Chía',1.78,'c',1.05],
 ['/assets/tfs-1154-c.jpg','/encargos/totto-topara-flagship-store','Totto Topara Flagship Store','Comercial · Bogotá',.8,'b',.9],
 ['/assets/lat21-tarjeta2.jpg','/encargos','Latitud 21 · Nalsani','Próximamente',.8,'t',.85]
];
var pub=d.getElementById('publicaciones');
if(pub&&d.getElementById('hero')){
  var g=d.createElement('section');g.className='v-gal';g.setAttribute('aria-label','Encargos');
  var h='<div class="v-gal-pin"><span class="v-gal-et">ENCARGOS</span><div class="v-gal-tr">';
  var gaps=[40,28,56,36,80,32,48,60];
  GAL.forEach(function(x,i){h+='<a class="v-gal-it '+x[5]+'" href="'+x[1]+'" data-ver="'+(x[3]==='Próximamente'?'Próximamente':'Ver encargo')+'" style="margin-right:'+gaps[i%8]+'px"><div class="v-gal-fr" style="height:calc(var(--gh) * '+x[6]+');width:calc(var(--gh) * '+(x[6]*x[4]).toFixed(3)+')"><img src="'+x[0]+'" alt="'+x[2]+'" loading="eager" decoding="async" draggable="false"></div><span class="v-gal-tx">'+x[2]+'<small>'+x[3]+'</small></span></a>'});
  h+='</div><div class="v-gal-bar"><i></i></div><div class="v-gal-hint">Desliza para explorar<svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M1 6H19M19 6L14 1M19 6L14 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>';
  g.innerHTML=h;pub.parentNode.insertBefore(g,pub);
  var pin=g.firstChild,tr=pin.querySelector('.v-gal-tr'),bar=pin.querySelector('.v-gal-bar i'),hint=pin.querySelector('.v-gal-hint'),dist=0;
  var medir=function(){var vh=innerHeight;var gh=innerWidth<760?Math.min(innerWidth*.56,vh*.34):Math.min(vh*.5,520);tr.style.setProperty('--gh',gh+'px');dist=Math.max(0,tr.scrollWidth-innerWidth);g.style.height=(vh+dist*.9)+'px';mover()};
  var its=[].slice.call(tr.children),ly=scrollY,sk=0;var mover=function(){var v=scrollY-ly;ly=scrollY;sk+=(Math.max(-8,Math.min(8,v*.12))-sk)*.3;if(!rm)its.forEach(function(it,i){it.style.transform='skewX('+(-sk*.6).toFixed(2)+'deg) translateY('+(Math.sin(i*1.7)*sk*2).toFixed(1)+'px)'});var r=g.getBoundingClientRect(),tot=g.offsetHeight-innerHeight;var p=tot>0?Math.max(0,Math.min(1,-r.top/tot)):0;tr.style.transform='translate3d('+(-p*dist).toFixed(1)+'px,0,0)';bar.style.transform='scaleX('+p.toFixed(4)+')';hint.style.opacity=p<.08?1:0};
  addEventListener('resize',medir);addEventListener('load',medir);medir();
  addEventListener('scroll',function(){requestAnimationFrame(mover)},{passive:true});(function dec(){if(Math.abs(sk)>.05){sk*=.88;its.forEach(function(it,i){it.style.transform='skewX('+(-sk*.6).toFixed(2)+'deg) translateY('+(Math.sin(i*1.7)*sk*2).toFixed(1)+'px)'})}requestAnimationFrame(dec)})();
}


/* ——— inicio con más fuerza ——— */
if(pub&&d.getElementById('hero')){
  /* lema que se escribe solo */
  var lem=[].slice.call(d.querySelectorAll('#heroContent p')).filter(function(p){return /NO INTERVENIMOS/.test(p.textContent)})[0];
  if(lem&&!rm){var FR=['NO INTERVENIMOS, REGENERAMOS.','LEEMOS EL LUGAR.','DISEÑAMOS DESDE LA NATURALEZA.'],fi=0;lem.setAttribute('aria-label','No intervenimos, regeneramos.');lem.innerHTML='<span class="v-rot" aria-hidden="true">'+FR[0]+'</span>';var ro=lem.firstChild;
   setInterval(function(){ro.classList.add('sale');setTimeout(function(){fi=(fi+1)%FR.length;ro.textContent=FR[fi];ro.classList.remove('sale');ro.classList.add('entra');void ro.offsetWidth;ro.classList.remove('entra')},450)},3200)}

  /* manifiesto que se enciende con el scroll */
  var man=d.createElement('section');man.className='v-man';
  var TX='Cada lugar ya tiene una forma de funcionar. Leemos sus relaciones, sus flujos y sus comportamientos, y desde ahí diseñamos espacios que nacen de lo que ya estaba.';
  man.innerHTML='<small>MANIFIESTO</small><p>'+TX.split(' ').map(function(w){return '<span>'+w+'</span>'}).join(' ')+'</p>';
  var gal=d.querySelector('.v-gal');gal.parentNode.insertBefore(man,gal);
  var ws=[].slice.call(man.querySelectorAll('p span'));
  var enc=function(){var r=man.querySelector('p').getBoundingClientRect(),vh=innerHeight;var p=Math.max(0,Math.min(1,(vh*.85-r.top)/(r.height+vh*.35)));var k=Math.round(p*ws.length);ws.forEach(function(w,i){w.classList.toggle('on',i<k)})};
  addEventListener('scroll',function(){requestAnimationFrame(enc)},{passive:true});enc();


  /* imagen que se expande con el scroll (Apple) */
  var zo=d.createElement('section');zo.className='v-zoom';zo.setAttribute('aria-label','Reforma Ciento dos');
  zo.innerHTML='<div class="v-zoom-pin"><div class="v-zoom-fr"><img src="/assets/cd-portada-cocina.jpg" alt="Reforma Ciento dos: cocina con isla verde y madera clara" decoding="async"></div><div class="v-zoom-tx"><b>Reforma Ciento dos</b><span>Residencial · Bogotá · 2026</span><a href="/encargos/ciento-dos">Ver encargo</a></div></div>';
  man.parentNode.insertBefore(zo,man.nextSibling);
  var zf=zo.querySelector('.v-zoom-fr'),zt=zo.querySelector('.v-zoom-tx');
  var zoom=function(){var r=zo.getBoundingClientRect(),tot=zo.offsetHeight-innerHeight;var p=tot>0?Math.max(0,Math.min(1,-r.top/tot)):0;var e=Math.min(1,p/.75);e=e*e*(3-2*e);
   zf.style.setProperty('--zi',(18*(1-e)).toFixed(2)+'%');zf.style.setProperty('--zx',((innerWidth<760?6:22)*(1-e)).toFixed(2)+'%');zf.style.setProperty('--zr',(28*(1-e)).toFixed(1)+'px');zf.style.setProperty('--zs',(1.25-.25*e).toFixed(3));
   zt.style.setProperty('--zo',Math.max(0,Math.min(1,(p-.55)/.25)).toFixed(3))};
  addEventListener('scroll',function(){requestAnimationFrame(zoom)},{passive:true});addEventListener('resize',zoom);zoom();
  /* cifras que cuentan */
  var num=d.createElement('section');num.className='v-num';
  var NUM=[[4,'Servicios'],[6,'Encargos publicados'],[3,'Sectores: residencial, comercial y oficinas'],[2023,'Primer encargo publicado']];
  num.innerHTML=NUM.map(function(x,i){return '<div style="--vd:'+i*120+'ms"><b data-n="'+x[0]+'">'+(rm?x[0]:0)+'</b><span>'+x[1]+'</span></div>'}).join('');
  gal.parentNode.insertBefore(num,gal);
  var cnt=new IntersectionObserver(function(en){if(!en[0].isIntersecting)return;num.classList.add('v-in');cnt.disconnect();if(rm)return;num.querySelectorAll('b').forEach(function(b,i){var n=+b.dataset.n,ini=n>1000?n-40:0,t0=performance.now()+i*120;(function f(t){var k=Math.max(0,Math.min(1,(t-t0)/1600));k=1-Math.pow(1-k,4);b.textContent=Math.round(ini+(n-ini)*k);if(k<1)requestAnimationFrame(f)})(t0)})},{threshold:.4});cnt.observe(num);

  /* servicios en filas con imagen flotante */
  var srv=d.createElement('section');srv.className='v-srv';
  var SRV=[['Arquitectura','Lugares nuevos y reformas, desde la lectura del sitio.','/assets/tfs-portada-entrada32.jpg'],['Diseño de Espacios','Interiores que ordenan cómo se vive y se trabaja.','/assets/pub-ciento-dos.jpg'],['Muebles y Objetos','Piezas a la medida de cada lugar.','/assets/thub-g1-1.jpg'],['Conceptualización de Proyectos','La idea que guía todo lo demás.','/assets/lat21-tarjeta2.jpg']];
  srv.innerHTML='<small>QUÉ HACEMOS</small>'+SRV.map(function(x,i){return '<a href="/about" data-img="'+x[2]+'"><i>0'+(i+1)+'</i><strong>'+x[0]+'</strong><em>'+x[1]+'</em><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>'}).join('');
  pub.parentNode.insertBefore(srv,pub);
}
/* franja en movimiento antes del pie */
var pie=d.querySelector('footer');
if(pie&&!d.querySelector('.v-mq')){var m=d.createElement('div');m.className='v-mq';m.setAttribute('aria-hidden','true');var t='<span>No intervenimos, <i>regeneramos.</i></span>';m.innerHTML='<div class="v-mq-tr">'+t+t+t+t+'</div>';pie.parentNode.insertBefore(m,pie)}

/* línea de progreso */
var pr=d.createElement('div');pr.className='v-prog';d.body.appendChild(pr);
var prog=function(){var m=H.scrollHeight-innerHeight;pr.style.transform='scaleX('+(m>0?scrollY/m:0).toFixed(4)+')'};
addEventListener('scroll',function(){requestAnimationFrame(prog)},{passive:true});prog();


/* scroll con inercia (fluidez tipo Apple) solo con mouse/trackpad */
if(!rm&&fino&&!/iPad|iPhone/.test(navigator.userAgent)){var ls=d.createElement('script');ls.src='https://unpkg.com/lenis@1.1.13/dist/lenis.min.js';ls.onload=function(){try{var L=new Lenis({lerp:.085,wheelMultiplier:.9});(function raf(t){L.raf(t);requestAnimationFrame(raf)})(performance.now());d.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var t=d.querySelector(a.getAttribute('href'));if(t){e.preventDefault();L.scrollTo(t,{offset:-90})}})})}catch(e){}};d.head.appendChild(ls)}
if(rm)return;

/* títulos palabra por palabra */
d.querySelectorAll('h1').forEach(function(t){if(fuera(t)||t.children.length)return;var w=t.textContent.trim().split(/\s+/);t.setAttribute('aria-label',t.textContent.trim());t.innerHTML=w.map(function(x,i){return '<span class="v-w" aria-hidden="true"><span style="--vd:'+(i*70)+'ms">'+x+'</span></span>'}).join(' ');t.classList.add('v-tit')});

/* imágenes: máscara + parallax */
var imgs=[];d.querySelectorAll('main img, body img').forEach(function(im){if(fuera(im)||im.closest('footer')||imgs.indexOf(im)>-1)return;var p=im.parentElement;if(!p||p.children.length!==1)return;if(im.getBoundingClientRect().width<140&&im.width<140)return;im.classList.add('v-img');p.classList.add('v-par');imgs.push(im)});

/* textos que entran escalonados */
var txt=[];d.querySelectorAll('h2,h3,p,li,form,.postmeta,dl,blockquote,.v-srv a').forEach(function(e){if(fuera(e)||e.closest('footer')||e.closest('.v-up')||e.querySelector('h1,h2,p,li')&&e.tagName!=='LI'&&e.tagName!=='FORM')return;e.classList.add('v-up');txt.push(e)});

var io=new IntersectionObserver(function(en){var n=0;en.forEach(function(x){if(!x.isIntersecting)return;var e=x.target;e.style.setProperty('--vd',Math.min(n++*80,400)+'ms');e.classList.add('v-in');io.unobserve(e)})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
txt.concat(imgs).concat([].slice.call(d.querySelectorAll('.v-tit'))).forEach(function(e){io.observe(e)});
setTimeout(function(){d.querySelectorAll('.v-up,.v-img,.v-tit').forEach(function(e){var r=e.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)e.classList.add('v-in')})},1800);

/* parallax suave */
var par=imgs.map(function(i){return i.parentElement});
var pmov=function(){var vh=innerHeight;par.forEach(function(p){var r=p.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;var c=(r.top+r.height/2-vh/2)/vh;p.style.setProperty('--vy',(c*-22).toFixed(1)+'px')})};
addEventListener('scroll',function(){requestAnimationFrame(pmov)},{passive:true});pmov();

if(!fino)return;
/* cursor “Ver encargo” */
var cur=d.createElement('div');cur.className='v-cur';d.body.appendChild(cur);var cx=0,cy=0,tx=0,ty=0,on=null;
(function loop(){cx+=(tx-cx)*.2;cy+=(ty-cy)*.2;cur.style.left=cx+'px';cur.style.top=cy+'px';requestAnimationFrame(loop)})();
addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY;var a=e.target.closest&&e.target.closest('a');var ok=a&&a.querySelector('img')&&/\/encargos/.test(a.getAttribute('href')||'');if(ok){cur.textContent=a.dataset.ver||'Ver encargo';if(!on){cx=tx;cy=ty}cur.classList.add('on');on=a}else if(on){cur.classList.remove('on');on=null}},{passive:true});

/* índice: vista previa flotante */
var pv=d.createElement('div');pv.className='v-prev';pv.innerHTML='<img alt="">';d.body.appendChild(pv);var pi=pv.firstChild;
d.querySelectorAll('ol a[href^="#"], .v-srv a').forEach(function(a){var src=a.dataset.img;if(!src){var art=d.querySelector(a.getAttribute('href'));var im=art&&art.querySelector('img');if(!im)return;src=im.currentSrc||im.src}
 a.addEventListener('mouseenter',function(){pi.src=src;pv.classList.add('on')});
 a.addEventListener('mousemove',function(e){pv.style.left=e.clientX+'px';pv.style.top=e.clientY+'px'});
 a.addEventListener('mouseleave',function(){pv.classList.remove('on')})});
})();
