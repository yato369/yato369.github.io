/* 进入动效：播放 MotionHarness 渲染的 _intro.mp4（横屏）/ _intro-p.mp4（竖屏），结束后交给主页。
   - 首帧之前用 poster 顶住，不会看到黑屏闪烁
   - 支持点击 / Esc / 触摸 跳过
   - 同一会话内只播一次（sessionStorage），但 key 带上片子的内容哈希：
     片子一更新，key 就变，所有人（包括手机上打开过的）都会重新看到一次
   - 微信内置浏览器：play() 会被直接拒绝（NotAllowedError），必须走
     WeixinJSBridgeReady + X5 属性 + canplay + 首次触摸 四条兜底，最后才退到静态首帧
   - 尊重 prefers-reduced-motion：直接跳过 */
(function () {
  var el = document.getElementById('intro');
  var vid = document.getElementById('introV');
  var skip = document.getElementById('introSkip');
  if (!el || !vid) { document.body.classList.remove('is-intro'); return; }

  var UA = navigator.userAgent || '';
  var WX = /MicroMessenger/i.test(UA);
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
  var playing = false;
  var guard = null;

  function finish() {
    if (done) return;
    done = true;
    if (guard) clearTimeout(guard);
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

  // 移动端 / 微信自动播放的硬性前提：muted 必须在 src 之前设好，
  // 并且要把 X5（微信安卓）的播放器属性都写上，否则会弹原生全屏播放器
  vid.muted = true;
  vid.defaultMuted = true;
  vid.volume = 0;
  vid.setAttribute('muted', '');
  vid.setAttribute('playsinline', '');
  vid.setAttribute('webkit-playsinline', '');
  vid.setAttribute('x5-playsinline', '');
  vid.setAttribute('x5-video-player-type', 'h5-page');
  vid.setAttribute('x5-video-player-fullscreen', 'false');
  vid.setAttribute('x5-video-orientation', 'portrait');
  vid.setAttribute('airplay', 'deny');
  vid.setAttribute('disableRemotePlayback', '');
  vid.playsInline = true;
  // 微信 X5 有一部分版本只认 autoplay 属性，不认手动 play()；
  // muted 已经设好，加这个属性不会触发声音或全屏
  vid.autoplay = true;
  vid.setAttribute('autoplay', '');
  vid.poster = pick.p;
  vid.src = pick.v;

  vid.addEventListener('ended', finish);
  vid.addEventListener('error', fallbackStill);
  vid.addEventListener('playing', function () {
    playing = true;
    // 万一先进了静态退路，视频又播起来了，把静态动画撤掉
    el.classList.remove('is-still');
    if (guard) clearTimeout(guard);
    guard = setTimeout(finish, 10000);
    vid.style.opacity = '1';
  }, { once: true });

  // 兜底：7s 的片子最多给它 10s（网络慢时 poster 会先顶住）
  guard = setTimeout(finish, 10000);

  var tries = 0;

  // 真的播不动时的最后退路：把 poster 当静态首帧，做一次缓慢推近再收场。
  // 微信里偶尔会出现「视频源被拦 / 解码失败」，至少别让人看到一片黑。
  function fallbackStill() {
    if (done || playing) return;
    el.classList.add('is-still');
    if (guard) clearTimeout(guard);
    guard = setTimeout(finish, 2600);
  }

  function attempt() {
    if (done) return;
    var p;
    try { p = vid.play(); } catch (e) { p = null; }
    if (p && p.then) {
      p.then(function () { playing = true; }).catch(function () {
        // 微信 / 部分安卓 WebView 会拒绝自动播放：继续下一轮重试，不要直接收场
        tries++;
        if (tries <= 3) {
          setTimeout(attempt, 200 * tries);
        } else {
          fallbackStill();
        }
      });
    } else if (!p) {
      // 老式 WebView 的 play() 不返回 promise
      tries++;
      if (tries <= 3) setTimeout(attempt, 200 * tries);
      else fallbackStill();
    }
  }

  // ① 直接试
  attempt();
  // ② 等元数据到位再试一次（X5 有时候要 canplay 之后才认）
  vid.addEventListener('canplay', function () { if (!playing) attempt(); });
  // ③ 微信专用：WeixinJSBridge 就绪后自动播放才被允许
  if (WX) {
    if (window.WeixinJSBridge && window.WeixinJSBridge.invoke) {
      attempt();
    } else {
      document.addEventListener('WeixinJSBridgeReady', function () { attempt(); }, false);
    }
  }
  // ④ 首次触摸（微信里用户任何一次点击都算手势，此时 play 一定被允许）
  function onGesture() {
    if (done) return;
    if (!playing) attempt();
  }
  document.addEventListener('touchstart', onGesture, { passive: true });
  document.addEventListener('click', onGesture);

  function onSkip() {
    try { vid.pause(); } catch (e) {}
    finish();
  }
  if (skip) skip.addEventListener('click', function (e) { e.stopPropagation(); onSkip(); });
  el.addEventListener('click', function (e) {
    // 还没播起来时，点一下先试着播；已经在播了才当"跳过"
    if (playing) onSkip();
    else { attempt(); }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onSkip();
  }, { once: true });
})();
