/* regenerativo · capa viva */
(function(){
var d=document,H=d.documentElement,rm=matchMedia('(prefers-reduced-motion: reduce)').matches,fino=matchMedia('(hover:hover) and (pointer:fine)').matches;
H.classList.add('vivo');
var fuera=function(el){return el.closest('#hero,.stage,header,.v-gal,.v-mq,nav[aria-label="Redes"]')};

var pub=d.getElementById('publicaciones');
/* ——— inicio con más fuerza ——— */
if(pub&&d.getElementById('hero')){
  /* lema que se escribe solo */
  var lem=[].slice.call(d.querySelectorAll('#heroContent p')).filter(function(p){return /NO INTERVENIMOS/.test(p.textContent)})[0];
  if(lem&&!rm){var FR=['NO INTERVENIMOS, REGENERAMOS.','LEEMOS EL LUGAR.','DISEÑAMOS DESDE LA NATURALEZA.'],fi=0;lem.setAttribute('aria-label','No intervenimos, regeneramos.');lem.innerHTML='<span class="v-rot" aria-hidden="true">'+FR[0]+'</span>';var ro=lem.firstChild;
   setInterval(function(){ro.classList.add('sale');setTimeout(function(){fi=(fi+1)%FR.length;ro.textContent=FR[fi];ro.classList.remove('sale')},1700)},6500)}


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
var txt=[];d.querySelectorAll('h2,h3,p,li,form,.postmeta,dl,blockquote,.v-srv a').forEach(function(e){if(fuera(e)||e.closest('footer')||e.closest('.v-up')||e.querySelector('h1,h2,p,li')&&e.tagName!=='LI'&&e.tagName!=='FORM')return;e.classList.add('v-up');txt.push(e)});

var io=new IntersectionObserver(function(en){var n=0;en.forEach(function(x){if(!x.isIntersecting)return;var e=x.target;e.style.setProperty('--vd',Math.min(n++*80,400)+'ms');e.classList.add('v-in');io.unobserve(e)})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
txt.concat(imgs).concat([].slice.call(d.querySelectorAll('.v-tit'))).forEach(function(e){io.observe(e)});
setTimeout(function(){d.querySelectorAll('.v-up,.v-img,.v-tit').forEach(function(e){var r=e.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)e.classList.add('v-in')})},1800);

/* parallax suave */
var par=imgs.map(function(i){return i.parentElement});
var pmov=function(){var vh=innerHeight;par.forEach(function(p){var r=p.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;var c=(r.top+r.height/2-vh/2)/vh;p.style.setProperty('--vy',(c*-22).toFixed(1)+'px')})};
addEventListener('scroll',function(){requestAnimationFrame(pmov)},{passive:true});pmov();

if(!fino)return;
/* índice: vista previa flotante */
var pv=d.createElement('div');pv.className='v-prev';pv.innerHTML='<img alt="">';d.body.appendChild(pv);var pi=pv.firstChild;
d.querySelectorAll('ol a[href^="#"], .v-srv a').forEach(function(a){var src=a.dataset.img;if(!src){var art=d.querySelector(a.getAttribute('href'));var im=art&&art.querySelector('img');if(!im)return;src=im.currentSrc||im.src}
 a.addEventListener('mouseenter',function(){pi.src=src;pv.classList.add('on')});
 a.addEventListener('mousemove',function(e){pv.style.left=e.clientX+'px';pv.style.top=e.clientY+'px'});
 a.addEventListener('mouseleave',function(){pv.classList.remove('on')})});
})();
