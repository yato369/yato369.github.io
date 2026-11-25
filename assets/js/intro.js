/* 进入动效：MotionHarness 风格实时 Canvas 胶片弧线 + 遮罩文字入场
   - 9 张代表作胶片卡沿二次弧线从中心向外依次落位，短暂停留后沿弧线向上抽走，
     紧接「程佳伟 · CHENG JIAWEI」遮罩升起与细线展开，无缝接力 3D 球体。
   - 纯实时 60/120fps 合成渲染，零视频下载等待，自适应深浅色与横竖屏。 */
(function () {
  var el = document.getElementById('intro');
  var canvas = document.getElementById('introC');
  var skip = document.getElementById('introSkip');
  if (!el || !canvas) { document.body.classList.remove('is-intro'); return; }

  var q = location.search;
  var FORCE = /[?&]intro=1/.test(q);
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]nointro=1/.test(q);
  var KEY = 'cjw-intro-mh-v1';
  var seen = false;
  try { seen = !FORCE && sessionStorage.getItem(KEY) === '1'; } catch (e) {}

  if (RM || seen) {
    el.classList.add('is-gone');
    document.body.classList.remove('is-intro');
    return;
  }

  var A = window.A || function (p) { return p; };
  var CARDS = ['shchip', 'tp500', 'shekou', 'saoxz', 'hologram', 'txai', 'fh', 'cave', 'zyyc'];
  var ORDER = [4, 3, 5, 2, 6, 1, 7, 0, 8];

  /* 紧凑丝滑时间轴（总长 3.6s） */
  var DUR = 3.60;
  var T_IN = 0.08, T_STAG = 0.045, T_DUR = 0.62;
  var T_OUT = 1.68, T_OUT_STAG = 0.025, T_OUT_DUR = 0.56;
  var T_TITLE = 2.08, T_SUB = 2.42, T_END = 3.22;

  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp01((t - a) / (b - a)); };
  var outCubic = function (p) { return 1 - Math.pow(1 - p, 3); };
  var outQuint = function (p) { return 1 - Math.pow(1 - p, 5); };
  var inCubic = function (p) { return p * p * p; };
  var lerp = function (a, b, p) { return a + (b - a) * p; };

  function rrect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  var imgs = CARDS.map(function (s) {
    var im = new Image();
    im.src = A('assets/img-sm/' + s + '.webp');
    return im;
  });

  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, PR = 1;
  function resize() {
    PR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * PR);
    canvas.height = Math.round(H * PR);
  }
  resize();
  window.addEventListener('resize', resize);

  var done = false, raf = 0, t0 = performance.now();
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    el.classList.add('is-out');
    document.body.classList.remove('is-intro');
    window.dispatchEvent(new CustomEvent('intro:done'));
    setTimeout(function () { el.classList.add('is-gone'); }, 580);
  }

  function frame(now) {
    if (done) return;
    var t = (now - t0) / 1000;
    if (t >= DUR) { finish(); return; }

    var isLight = document.documentElement.dataset.theme === 'light';
    var bg = isLight ? '#f4f4f1' : '#0c0c0d';
    var ink = isLight ? '#141416' : '#ededeb';
    var mute = isLight ? '#636366' : '#8e8e8c';
    var filmBg = isLight ? '#e2e2de' : '#08080a';
    var holeClr = isLight ? 'rgba(20,20,22,.22)' : 'rgba(237,237,235,.32)';
    var borderClr = isLight ? 'rgba(20,20,22,.22)' : 'rgba(237,237,235,.48)';

    ctx.setTransform(PR, 0, 0, PR, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var PORTRAIT = H > W;
    var S = PORTRAIT ? W / 720 : W / 1280;
    var CX = W / 2, CY = H / 2;
    var CW = PORTRAIT ? Math.round((W * 0.90 - Math.round(W * 0.024) * 2) / 3) : Math.round(258 * S);
    var CH = Math.round((CW * 9) / 16);
    var GAP = PORTRAIT ? Math.round(W * 0.024) : Math.round(142 * S);
    var GAPY = PORTRAIT ? Math.round(W * 0.028) : 0;
    var PAD = Math.max(5, Math.round((PORTRAIT ? 7 : 10) * S));

    function cardBase(i) {
      if (PORTRAIT) {
        var col = i % 3, row = (i - col) / 3;
        return {
          x: CX - (CW + GAP) + col * (CW + GAP),
          y: CY - (CH + GAPY) + row * (CH + GAPY),
          rot: 0, z: 1, d: col - 1
        };
      }
      var d = i - 4;
      return {
        x: CX + d * GAP,
        y: CY - 16 * S + Math.abs(d) * 12 * S,
        rot: d * 0.052,
        z: 1 - Math.abs(d) * 0.045,
        d: d
      };
    }

    /* 绘制 9 张弧线胶片卡（按从两侧向中心层次叠放） */
    var drawOrder = [0, 8, 1, 7, 2, 6, 3, 5, 4];
    for (var idx = 0; idx < drawOrder.length; idx++) {
      var i = drawOrder[idx];
      var ord = ORDER.indexOf(i);
      var ea = seg(t, T_IN + ord * T_STAG, T_IN + ord * T_STAG + T_DUR);
      if (ea <= 0) continue;
      var ex = seg(t, T_OUT + ord * T_OUT_STAG, T_OUT + ord * T_OUT_STAG + T_OUT_DUR);
      if (ex >= 1) continue;

      var b = cardBase(i);
      var eIn = outQuint(ea);
      var eOut = inCubic(ex);
      var u = 1 - eIn;
      var sign = (b.d || 0) >= 0 ? 1 : -1;

      var x = b.x + u * (b.d || 0) * 52 * S + Math.sin(Math.PI * u) * sign * 28 * S + Math.sin(Math.PI * eOut) * sign * 24 * S + eOut * (b.d || 0) * 20 * S;
      var y = b.y + u * 230 * S - eOut * (H * 0.82 + 140 * S);
      var rot = b.rot + u * sign * 0.12 - eOut * sign * 0.09;
      var sc = b.z * lerp(0.90, 1, eIn) * lerp(1, 0.93, eOut);
      var alpha = outCubic(clamp01(ea / 0.5)) * (1 - inCubic(clamp01((ex - 0.45) / 0.55)));
      if (alpha <= 0.005) continue;

      var w = CW * sc, h = CH * sc, pad = Math.max(4, PAD * sc);
      var bw = w + pad * 2, bh = h + pad * 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rot);

      ctx.fillStyle = filmBg;
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, Math.max(2, 3 * sc));
      ctx.fill();

      ctx.save();
      rrect(ctx, -w / 2, -h / 2, w, h, 1);
      ctx.clip();
      var im = imgs[i];
      if (im && im.complete && im.naturalWidth) {
        var ir = im.naturalWidth / im.naturalHeight, cr = w / h;
        var dw = w, dh = h, dx = -w / 2, dy = -h / 2;
        if (ir > cr) { dw = h * ir; dx = -dw / 2; }
        else { dh = w / ir; dy = -dh / 2; }
        ctx.drawImage(im, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = isLight ? '#d4d4d0' : '#1c1c1f';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();

      /* 胶片齿孔 */
      var step = Math.max(10, Math.round(20 * sc * S));
      var hw = Math.max(4, Math.round(7.5 * sc * S)), hh = Math.max(3, Math.round(5 * sc * S));
      var hg = Math.max(2, Math.round(3 * sc * S));
      ctx.fillStyle = holeClr;
      var nHole = Math.floor(bw / step);
      for (var k = 0; k < nHole; k++) {
        var hx = -bw / 2 + step / 2 + k * step;
        if (hx + hw / 2 > bw / 2 - hg) break;
        rrect(ctx, hx - hw / 2, -bh / 2 + hg, hw, hh, 1);
        ctx.fill();
        rrect(ctx, hx - hw / 2, bh / 2 - hg - hh, hw, hh, 1);
        ctx.fill();
      }

      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = Math.max(0.8, 1 * S);
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, Math.max(2, 3 * sc));
      ctx.stroke();
      ctx.restore();
    }

    /* 标题遮罩升起 + 细线展开 */
    var et = seg(t, T_TITLE, T_TITLE + 0.58);
    if (et > 0) {
      var ee = outQuint(et);
      var endFade = 1 - inCubic(seg(t, T_END, DUR));
      var tSize = Math.round(clampVal(PORTRAIT ? 34 * S : 44 * S, 26, 56));
      ctx.save();
      ctx.globalAlpha = endFade;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      /* 遮罩裁剪框 */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, CY - tSize * 1.1, W, tSize * 1.45);
      ctx.clip();
      ctx.fillStyle = ink;
      ctx.font = '500 ' + tSize + 'px "Geist","PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText('程佳伟', CX, CY - tSize * 0.34 + (1 - ee) * tSize * 1.2);
      ctx.restore();

      var es = seg(t, T_SUB, T_SUB + 0.52);
      if (es > 0) {
        var ese = outCubic(es);
        var lw = Math.round(clampVal(180 * S, 120, 220) * outQuint(es));
        ctx.fillStyle = borderClr;
        ctx.fillRect(CX - lw / 2, CY + tSize * 0.36, lw, 1);

        ctx.fillStyle = mute;
        ctx.globalAlpha = endFade * ese;
        ctx.font = '400 ' + Math.round(clampVal(11 * S, 10, 13)) + 'px "Geist",sans-serif';
        ctx.fillText('CHENG JIAWEI  ·  后期视效 / 三维 / 沉浸影像', CX, CY + tSize * 0.92 + (1 - ese) * 8);
      }
      ctx.restore();
    }

    raf = requestAnimationFrame(frame);
  }

  function clampVal(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }

  raf = requestAnimationFrame(frame);

  if (skip) {
    skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
  }
  el.addEventListener('click', finish);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
  }, { once: true });
})();
