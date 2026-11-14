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
  GAL.forEach(function(x,i){h+='<a class="v-gal-it '+x[5]+'" href="'+x[1]+'" data-ver="'+(x[3]==='Próximamente'?'Próximamente':'Ver encargo')+'" style="margin-right:'+gaps[i%8]+'px"><div class="v-gal-fr" style="height:calc(var(--gh) * '+x[6]+');width:calc(var(--gh) * '+(x[6]*x[4]).toFixed(3)+')"><img src="'+x[0]+'" alt="'+x[2]+'" loading="'+(i<4?'eager':'lazy')+'" draggable="false"></div><span class="v-gal-tx">'+x[2]+'<small>'+x[3]+'</small></span></a>'});
  h+='</div><div class="v-gal-bar"><i></i></div><div class="v-gal-hint">Desliza para explorar<svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M1 6H19M19 6L14 1M19 6L14 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>';
  g.innerHTML=h;pub.parentNode.insertBefore(g,pub);
  var pin=g.firstChild,tr=pin.querySelector('.v-gal-tr'),bar=pin.querySelector('.v-gal-bar i'),hint=pin.querySelector('.v-gal-hint'),dist=0;
  var medir=function(){var vh=innerHeight;var gh=innerWidth<760?Math.min(innerWidth*.56,vh*.34):Math.min(vh*.5,520);tr.style.setProperty('--gh',gh+'px');dist=Math.max(0,tr.scrollWidth-innerWidth);g.style.height=(vh+dist*.9)+'px';mover()};
  var mover=function(){var r=g.getBoundingClientRect(),tot=g.offsetHeight-innerHeight;var p=tot>0?Math.max(0,Math.min(1,-r.top/tot)):0;tr.style.transform='translate3d('+(-p*dist).toFixed(1)+'px,0,0)';bar.style.transform='scaleX('+p.toFixed(4)+')';hint.style.opacity=p<.08?1:0};
  addEventListener('resize',medir);addEventListener('load',medir);medir();
  addEventListener('scroll',function(){requestAnimationFrame(mover)},{passive:true});
}

/* franja en movimiento antes del pie */
var pie=d.querySelector('footer');
if(pie&&!d.querySelector('.v-mq')){var m=d.createElement('div');m.className='v-mq';m.setAttribute('aria-hidden','true');var t='<span>No intervenimos, <i>regeneramos.</i></span>';m.innerHTML='<div class="v-mq-tr">'+t+t+t+t+'</div>';pie.parentNode.insertBefore(m,pie)}

/* línea de progreso */
var pr=d.createElement('div');pr.className='v-prog';d.body.appendChild(pr);
var prog=function(){var m=H.scrollHeight-innerHeight;pr.style.transform='scaleX('+(m>0?scrollY/m:0).toFixed(4)+')'};
addEventListener('scroll',function(){requestAnimationFrame(prog)},{passive:true});prog();

if(rm)return;

/* títulos palabra por palabra */
d.querySelectorAll('h1').forEach(function(t){if(fuera(t)||t.children.length)return;var w=t.textContent.trim().split(/\s+/);t.setAttribute('aria-label',t.textContent.trim());t.innerHTML=w.map(function(x,i){return '<span class="v-w" aria-hidden="true"><span style="--vd:'+(i*70)+'ms">'+x+'</span></span>'}).join(' ');t.classList.add('v-tit')});

/* imágenes: máscara + parallax */
var imgs=[];d.querySelectorAll('main img, body img').forEach(function(im){if(fuera(im)||im.closest('footer')||imgs.indexOf(im)>-1)return;var p=im.parentElement;if(!p||p.children.length!==1)return;if(im.getBoundingClientRect().width<140&&im.width<140)return;im.classList.add('v-img');p.classList.add('v-par');imgs.push(im)});

/* textos que entran escalonados */
var txt=[];d.querySelectorAll('h2,h3,p,li,form,.postmeta,dl,blockquote').forEach(function(e){if(fuera(e)||e.closest('footer')||e.closest('.v-up')||e.querySelector('h1,h2,p,li')&&e.tagName!=='LI'&&e.tagName!=='FORM')return;e.classList.add('v-up');txt.push(e)});

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
d.querySelectorAll('ol a[href^="#"]').forEach(function(a){var art=d.querySelector(a.getAttribute('href'));var im=art&&art.querySelector('img');if(!im)return;
 a.addEventListener('mouseenter',function(){pi.src=im.currentSrc||im.src;pv.classList.add('on')});
 a.addEventListener('mousemove',function(e){pv.style.left=e.clientX+'px';pv.style.top=e.clientY+'px'});
 a.addEventListener('mouseleave',function(){pv.classList.remove('on')})});
})();
