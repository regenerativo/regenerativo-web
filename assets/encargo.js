/* regenerativo · comportamiento común de las páginas de encargo */
document.addEventListener('contextmenu',e=>{if(e.target.closest('img,picture,.cs,.xf,.gs'))e.preventDefault()});
document.addEventListener('dragstart',e=>{if(e.target.tagName==='IMG')e.preventDefault()});
try{history.scrollRestoration="manual"}catch(e){}
if(!location.hash){scrollTo(0,0);addEventListener("load",function(){scrollTo(0,0)});addEventListener("pageshow",function(){scrollTo(0,0);setTimeout(function(){scrollTo(0,0)},50)})}
addEventListener("pagehide",function(){try{scrollTo(0,0)}catch(e){}});
document.querySelectorAll('.burger').forEach(b=>b.addEventListener('click',()=>{const h=b.closest('header');h.classList.toggle('open');b.setAttribute('aria-expanded',h.classList.contains('open'));}));

document.querySelectorAll('.gcar').forEach(g=>{const s=g.querySelector('.gs'),p=g.querySelector('.gp'),n=g.querySelector('.gn');
 const u=()=>{const m=s.scrollWidth-s.clientWidth-2;p.style.opacity=s.scrollLeft>2?1:0;p.style.pointerEvents=s.scrollLeft>2?'auto':'none';n.style.opacity=s.scrollLeft<m?1:0;n.style.pointerEvents=s.scrollLeft<m?'auto':'none'};
 let t=0;s.addEventListener('scroll',()=>{if(!t)t=requestAnimationFrame(()=>{t=0;u()})},{passive:true});
 p.addEventListener('click',()=>s.scrollBy({left:-s.clientWidth,behavior:'smooth'}));n.addEventListener('click',()=>s.scrollBy({left:s.clientWidth,behavior:'smooth'}));u();});
document.querySelectorAll('.car').forEach(c=>{const s=c.querySelector('.cs'),d=[...c.querySelectorAll('.cd i')],p=c.querySelector('.cp'),n=c.querySelector('.cn'),L=d.length-1;
 const u=()=>{const i=Math.max(0,Math.min(L,Math.round(s.scrollLeft/s.clientWidth)));d.forEach((x,k)=>x.classList.toggle('on',k===i));const fg=c.closest('figure');if(fg)fg.querySelectorAll('.cl span').forEach((x,k)=>x.classList.toggle('on',k===i));p.style.opacity=i>0?1:0;p.style.pointerEvents=i>0?'auto':'none';n.style.opacity=i<L?1:0;n.style.pointerEvents=i<L?'auto':'none'};
 let t=0;s.addEventListener('scroll',()=>{if(!t)t=requestAnimationFrame(()=>{t=0;u()})},{passive:true});
 p.addEventListener('click',()=>s.scrollBy({left:-s.clientWidth,behavior:'smooth'}));n.addEventListener('click',()=>s.scrollBy({left:s.clientWidth,behavior:'smooth'}));
 c.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();n.click()}if(e.key==='ArrowLeft'){e.preventDefault();p.click()}});u();});

    const zoom = (e) => { return;
      const t = e && e.target;
      if (!t || t.tagName !== 'IMG') return;
      const c = t.closest('.car'); if (!c) return;
      const imgs = [...c.querySelectorAll('.cs img')]; const i0 = imgs.indexOf(t);
      const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
      const svg = (d) => '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"></path></svg>';
      lb.innerHTML = '<div class="ls">' + imgs.map((im) => '<div><img src="' + im.src + '" alt="' + im.alt + '"></div>').join('') + '</div>'
        + '<button type="button" class="cb cp" aria-label="Imagen anterior">' + svg('M14.5 5.5l-6 6.5 6 6.5') + '</button>'
        + '<button type="button" class="cb cn" aria-label="Imagen siguiente">' + svg('M9.5 5.5l6 6.5-6 6.5') + '</button>'
        + '<button type="button" class="cb lx" aria-label="Cerrar">' + svg('M6 6l12 12M18 6L6 18') + '</button><div class="lc"></div>';
      const host = document.body; host.appendChild(lb);
      const s = lb.querySelector('.ls'), lc = lb.querySelector('.lc'), N = imgs.length;
      const u = () => { const k = Math.round(s.scrollLeft / s.clientWidth); lc.textContent = (k + 1) + ' / ' + N; };
      s.scrollLeft = i0 * s.clientWidth; u(); s.addEventListener('scroll', () => requestAnimationFrame(u), { passive: true });
      const close = () => { lb.remove(); document.removeEventListener('keydown', key); };
      const key = (ev) => { if (ev.key === 'Escape') close(); if (ev.key === 'ArrowRight') s.scrollBy({ left: s.clientWidth, behavior: 'smooth' }); if (ev.key === 'ArrowLeft') s.scrollBy({ left: -s.clientWidth, behavior: 'smooth' }); };
      document.addEventListener('keydown', key);
      lb.querySelector('.cp').onclick = () => s.scrollBy({ left: -s.clientWidth, behavior: 'smooth' });
      lb.querySelector('.cn').onclick = () => s.scrollBy({ left: s.clientWidth, behavior: 'smooth' });
      lb.querySelector('.lx').onclick = close;
      lb.querySelector('.lx').focus();
    };
