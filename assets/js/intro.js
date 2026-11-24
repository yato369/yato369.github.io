/* 进入动效：播放 MotionHarness 渲染的 _intro.mp4（横屏）/ _intro-p.mp4（竖屏），结束后交给主页。
   - 首帧之前用 poster 顶住，不会看到黑屏闪烁
   - 支持点击 / Esc / 触摸 跳过
   - 同一会话内只播一次（sessionStorage），但 key 带上片子的内容哈希：
     片子一更新，key 就变，所有人（包括手机上打开过的）都会重新看到一次
   - 尊重 prefers-reduced-motion：直接跳过 */
(function () {
  var el = document.getElementById('intro');
  var vid = document.getElementById('introV');
  var skip = document.getElementById('introSkip');
  if (!el || !vid) { document.body.classList.remove('is-intro'); return; }

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]nointro=1/.test(location.search);

  // 竖屏用 9:16 的版本，避免 16:9 的片子在小屏上只剩中间一条
  // A() 是 index.html 内联的版本表：给资源拼上 ?v=<内容哈希>，片子一换就必然重新拉
  var A = window.A || function (p) { return p; };
  function pickSrc() {
    var portrait = window.innerHeight > window.innerWidth;
    return portrait
      ? { v: A('assets/video/_intro-p.mp4'), p: A('assets/img/_intro-p-poster.webp') }
      : { v: A('assets/video/_intro.mp4'), p: A('assets/img/_intro-poster.webp') };
  }
  var pick = pickSrc();

  // key 里带片子版本：换了片子就重播一次，不换就一直不打扰
  var ver = (pick.v.split('?v=')[1] || 'base').slice(0, 8);
  var KEY = 'cjw-intro-seen-' + ver;
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}

  var done = false;

  function finish() {
    if (done) return;
    done = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    el.classList.add('is-out');
    document.body.classList.remove('is-intro');
    // 主球体在遮罩还在时就开始入场，两段动画自然接上
    window.dispatchEvent(new CustomEvent('intro:done'));
    setTimeout(function () { el.classList.add('is-gone'); }, 700);
  }

  if (RM || seen) {
    el.classList.add('is-gone');
    document.body.classList.remove('is-intro');
    return;
  }

  // 移动端自动播放的硬性前提：muted 必须在 src 之前设好
  vid.muted = true;
  vid.defaultMuted = true;
  vid.setAttribute('muted', '');
  vid.setAttribute('playsinline', '');
  vid.setAttribute('webkit-playsinline', '');
  vid.playsInline = true;
  vid.poster = pick.p;
  vid.src = pick.v;
  vid.addEventListener('ended', finish);
  vid.addEventListener('error', finish);

  // 兜底：7s 的片子最多给它 10s（网络慢时 poster 会先顶住）
  var guard = setTimeout(finish, 10000);

  function onSkip() {
    clearTimeout(guard);
    try { vid.pause(); } catch (e) {}
    finish();
  }
  el.addEventListener('click', onSkip);
  el.addEventListener('touchstart', onSkip, { passive: true });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onSkip();
  }, { once: true });

  function start() {
    var p = vid.play();
    if (p && p.catch) {
      p.catch(function () {
        // 有些移动端浏览器仍然拒绝自动播放：直接放行到主页，别把人卡在黑屏上
        clearTimeout(guard);
        finish();
      });
    }
  }

  // 视频真的开始播放了再把 poster 撤掉（避免某些浏览器 poster 与首帧重叠闪一下）
  vid.addEventListener('playing', function () { vid.style.opacity = '1'; }, { once: true });

  start();
})();
