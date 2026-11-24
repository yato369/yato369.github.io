/* ══════════════════════════════════════════════════════════
   暗色三视图 · app.js
   ① 影像：WebGL 视频球体  ② 作品：网格 + hover 播放  ③ 关于
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = window.DATA;
  /* window.A 由 index.html 内联的版本表提供：把 assets/xxx 映射成 assets/xxx?v=<内容哈希>。
     内容一变 URL 就变，浏览器必然重新拉；内容没变继续吃缓存。
     file:// 或版本表缺失时退化为原样返回。 */
  var A = window.A || function (p) { return p; };
  var IMG = 'assets/img/';
  var IMG_SM = 'assets/img-sm/';
  var VID = 'assets/video/';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 触屏设备：hover 预览没有意义，还会白耗流量；手势换成拖拽 + 双指缩放 */
  var TOUCH = window.matchMedia('(hover:none), (pointer:coarse)').matches;

  /* file:// 下 origin 是 null，WebGL 把 Image/Video 当纹理会被 CORS 拦掉（球体全黑）。
     COVERS 是内联 data URL 封面，不受此限；http 环境下改用 img-sm/ 的小图（每张约 11KB）。 */
  var COVERS = window.COVERS || {};
  var FILE_MODE = location.protocol === 'file:';
  function coverSrc(slug) {
    if (FILE_MODE) return COVERS[slug] || A(IMG + slug + '.webp');
    return A(IMG_SM + slug + '.webp');
  }
  /* 网格缩略图：560 宽够用（卡片 442px），播放浮层才用 960 全图 */
  function thumbSrc(slug) {
    return FILE_MODE ? (COVERS[slug] || A(IMG + slug + '.webp')) : A(IMG_SM + slug + '.webp');
  }

  /* ── 速度层 ────────────────────────────────────────────────
     SM   : 480x270 / 8s / ~110KB 的轻量悬停片，用来做 hover 预览，秒开。
     VID  : 960x540 / 60s / 带音轨的全片，只在真正点开时加载。
     prefetch() : 鼠标停在卡片上就开始悄悄预取全片，点下去直接命中 HTTP 缓存。 */
  var SM = 'assets/vid-sm/';
  var SM_SIZE = 0, SM_LOADED = 0;
  var fetching = {};
  function prefetch(slug) {
    if (TOUCH || FILE_MODE || fetching[slug]) return;
    fetching[slug] = true;
    var v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true;
    v.src = A(VID + slug + '.mp4');
    v.load();
  }
  /* 首屏空闲时先抢前三条，之后按顺序把剩下的全片陆续灌进 HTTP 缓存。
     用 fetch 灌缓存而不是建 <video>：不占解码内存，请求也不会被 GC 掉。
     省流模式 / 2G-3G 网络下不自动铺开，避免偷跑用户流量。 */
  /* 只在明确省流 / 2G 网络下不预热。3G 也照预热 —— 浏览器对网速的估算普遍保守，
     真按 effectiveType 卡会让大量正常宽带的访客都拿不到预热。 */
  function cheapNet() {
    var c = navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    return /^(slow-)?2g$/.test(c.effectiveType || '');
  }
  function warm(url, bytes) {
    if (typeof fetch !== 'function') return Promise.resolve();
    var opt = { cache: 'force-cache' };
    if (bytes) opt.headers = { Range: 'bytes=0-' + bytes };
    return fetch(url, opt).then(function (r) { return r.blob(); }).catch(function () {});
  }
  /* 预热分两步：
     ① 33 条轻量片（vid-sm）总共才 3.6MB，全部灌进缓存 —— 悬停预览与浮层首帧全靠它，
        这样"点开的那一瞬间"永远有画面在动，不用等全片。
     ② 最前面 4 条全片直接下完（用户最先点的就是这几张），其余等悬停时再补。 */
  function warmup() {
    if (TOUCH || FILE_MODE || cheapNet()) return;
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    var list = D.items.filter(function (x) { return x.kind !== 'img'; });
    idle(function () {
      var k = 0;
      (function stepSm() {
        if (k >= list.length) return;
        warm(SM + list[k++].s + '.mp4').then(function () { setTimeout(stepSm, 60); });
      })();
      list.slice(0, 4).forEach(function (x, i) {
        setTimeout(function () { prefetch(x.s); }, 900 + i * 1400);
      });
    });
  }

  /* ────────── 视图切换 ────────── */
  var dock = document.getElementById('dock');
  var dockPill = document.getElementById('dockPill');
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  var cur = 'gallery';

  /* 药丸底跟着当前按钮滑过去（首屏也要先摆好位置） */
  function movePill() {
    var b = dock.querySelector('.dock__b.is-on');
    if (!b || !dockPill) return;
    dockPill.style.width = b.offsetWidth + 'px';
    dockPill.style.transform = 'translateX(' + (b.offsetLeft - 5) + 'px)';
  }

  function go(name) {
    if (name === cur) return;
    cur = name;
    views.forEach(function (v) {
      v.classList.toggle('is-on', v.dataset.view === name);
    });
    Array.prototype.forEach.call(dock.querySelectorAll('.dock__b'), function (b) {
      b.classList.toggle('is-on', b.dataset.go === name);
    });
    movePill();
    if (name === 'gallery') gal.resume();
    else gal.pause();
    // 视图切换时让内容重新入场（网格的 stagger 动画才有意义）
    var on = document.querySelector('.view.is-on');
    if (on) {
      on.classList.remove('is-in');
      void on.offsetWidth;
      on.classList.add('is-in');
    }
  }

  dock.addEventListener('click', function (e) {
    var b = e.target.closest('.dock__b');
    if (!b) return;
    go(b.dataset.go);
  });

  /* ══════════ ① 影像球 ══════════ */
  var gal = (function () {
    var canvas = document.getElementById('gl');
    var host = canvas.parentNode;
    var renderer, scene, camera, group, meshes = [];
    var ok = false;

    var RAD = 206;        // 球半径
    var PLANE = 124;      // 单块尺寸
    var drag = false, px = 0, py = 0, vx = 0, vy = 0;
    var pts = new Map(), pinchD0 = 0, pinchZ0 = 0, pinchT = 0;
    var tRotX = 0, tRotY = 0, rotX = 0, rotY = 0;
    var hovered = null, running = false, raf = 0;

    function init() {
      if (!window.THREE) return;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
        });
      } catch (e) { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 1, 2000);
      camera.position.set(0, 0, 620);

      group = new THREE.Group();
      scene.add(group);

      var n = D.items.length;
      var gold = Math.PI * (3 - Math.sqrt(5));
      var loader = new THREE.TextureLoader();
      var geo = new THREE.PlaneGeometry(PLANE, PLANE * 9 / 16);

      for (var i = 0; i < n; i++) {
        var it = D.items[i];
        var y = 1 - (i / (n - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = gold * i;

        var cover = loader.load(coverSrc(it.s));
        // 封面纹理必须标 sRGB，否则在 sRGB 输出的渲染器里会被当成线性值，整片发灰发白
        cover.colorSpace = THREE.SRGBColorSpace;
        var m = new THREE.MeshBasicMaterial({
          map: cover,
          transparent: true, opacity: 1,
          // 素材偏夜景/深色，整体提一点点亮度，避免卡片沉进底色
          color: new THREE.Color(1.14, 1.14, 1.14)
        });
        var mesh = new THREE.Mesh(geo, m);
        // 卡片背后垫一层略大的深灰底板，给暗画面勾一道边，卡与卡之间才有分界
        var plate = new THREE.Mesh(
          new THREE.PlaneGeometry(PLANE + 3, PLANE * 9 / 16 + 3),
          new THREE.MeshBasicMaterial({ color: 0x1c1c1f, transparent: true, opacity: 0.92 })
        );
        plate.position.set(0, 0, -0.9);
        mesh.add(plate);
        mesh.position.set(Math.cos(th) * r * RAD, y * RAD, Math.sin(th) * r * RAD);
        mesh.lookAt(0, 0, 0);
        mesh.userData = { it: it, i: i, cover: cover, live: false };
        group.add(mesh);
        meshes.push(mesh);

        // 视频纹理：只在悬停播放出画面时替换，离开立刻退回封面
        // （否则暂停状态的 VideoTexture 尚未解码首帧，会渲染成纯黑）
        // file:// 下 video 纹理同样受 CORS 限制，直接跳过，只用内联封面
        if (it.kind !== 'img' && !FILE_MODE && !TOUCH) {
          (function (mesh, it) {
          var v = document.createElement('video');
          v.src = A(SM + it.s + '.mp4');
          v.loop = true; v.muted = true; v.playsInline = true;
          v.preload = 'none';
          function swapIn() {
            if (!v.videoWidth || !v.videoHeight) return;
            if (mesh.userData.live) return;
            if (!mesh.userData.liveTex) {
              mesh.userData.liveTex = new THREE.VideoTexture(v);
              mesh.userData.liveTex.colorSpace = THREE.SRGBColorSpace;
            }
            mesh.material.map = mesh.userData.liveTex;
            mesh.material.needsUpdate = true;
            mesh.userData.live = true;
          }
          v.addEventListener('playing', swapIn);
          v.addEventListener('timeupdate', swapIn);
          mesh.userData.video = v;
          })(mesh, it);
        }
      }

      ok = true;
      resize();
      renderer.setAnimationLoop(loop);
      window.__GAL = { renderer: renderer, scene: scene, camera: camera, group: group, meshes: meshes, get ok() { return ok; } };
      // 初始入场：等进入动效播完再放大，两段动画接力
      group.scale.setScalar(0.82);
      group.rotation.set(-0.2, 0.4, 0);
      rotX = tRotX = -0.2; rotY = tRotY = 0.4;
      function startIn() { easing(1, 1100); }
      if (document.body.classList.contains('is-intro')) {
        window.addEventListener('intro:done', startIn, { once: true });
      } else {
        startIn();
      }
    }

    var easeT0 = 0, easeOn = false;
    function easing(to, dur) { easeT0 = performance.now(); easeOn = { to: to, dur: dur }; }

    /* 让球体缓慢自转 + 拖拽惯性 */
    var last = performance.now();
    function loop() {
      var now = performance.now();
      var dt = Math.min(40, now - last); last = now;

      if (!drag) {
        vx *= 0.94; vy *= 0.94;
        tRotY += vx * dt * 0.0006;
        tRotX += vy * dt * 0.0006;
        tRotX = Math.max(-0.9, Math.min(0.9, tRotX));
        if (!RM) tRotY += 0.0001 * dt;
      }
      rotX += (tRotX - rotX) * 0.09;
      rotY += (tRotY - rotY) * 0.09;

      group.rotation.x = rotX;
      group.rotation.y = rotY;
      group.rotation.z = 0.4;

      if (easeOn) {
        var p = Math.min(1, (now - easeT0) / easeOn.dur);
        var e = 1 - Math.pow(1 - p, 3);
        var s = 0.82 + (1 - 0.82) * e;
        group.scale.setScalar(s);
        if (p >= 1) easeOn = false;
      }

      // 悬停播放；离开时立刻退回封面纹理（暂停中的 VideoTexture 会渲染成黑块）
      if (hovered) {
        var v = hovered.userData.video;
        if (v && v.paused) { v.play().catch(function () {}); }
      }
      meshes.forEach(function (m) {
        if (m === hovered) return;
        var v = m.userData.video;
        if (v && !v.paused) v.pause();
        if (m.userData.live) {
          m.material.map = m.userData.cover;
          m.material.needsUpdate = true;
          m.userData.live = false;
        }
      });

      renderer.render(scene, camera);
    }

    function resize() {
      if (!ok) return;
      var w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // 竖屏时把相机拉远，保证球体不被裁；横竖屏都居中（左侧标题已移除）
      var portrait = h > w;
      camera.position.z = portrait ? 800 : 660;
      group.position.x = 0;
      camera.updateProjectionMatrix();
    }

    /* 交互 */
    var ray = null, pointer = null;
    function pick(x, y) {
      if (!ok) return null;
      var r = canvas.getBoundingClientRect();
      pointer = pointer || new THREE.Vector2();
      pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      if (!ray) ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, camera);
      var hit = ray.intersectObjects(group.children, false);
      return hit.length ? hit[0].object : null;
    }

    canvas.addEventListener('pointerdown', function (e) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        var a = Array.from(pts.values());
        pinchD0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        pinchZ0 = camera.position.z;
        drag = false; vx = vy = 0;
        return;
      }
      drag = true; px = e.clientX; py = e.clientY;
      vx = vy = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      /* 双指捏合缩放 */
      if (pts.size === 2) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        camera.position.z = Math.max(340, Math.min(1150, pinchZ0 * pinchD0 / d));
        camera.updateProjectionMatrix();
        pinchT = Date.now();
        return;
      }
      if (drag) {
        var dx = e.clientX - px, dy = e.clientY - py;
        px = e.clientX; py = e.clientY;
        tRotY += dx * 0.0052; tRotX += dy * 0.0042;
        vx = dx; vy = dy;
        tRotX = Math.max(-0.95, Math.min(0.95, tRotX));
      } else {
        var m = pick(e.clientX, e.clientY);
        if (m !== hovered) {
          hovered = m;
          canvas.style.cursor = m ? 'pointer' : 'grab';
        }
      }
    });
    canvas.addEventListener('pointerup', function (e) {
      pts.delete(e.pointerId);
      if (!drag) return;
      drag = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointercancel', function (e) {
      pts.delete(e.pointerId);
      drag = false;
    });
    canvas.addEventListener('click', function (e) {
      /* 双指缩放结束后会补一次 click，吞掉；拖动过也不当作点击 */
      if (Date.now() - pinchT < 400) return;
      if (Math.abs(vx) > 5 || Math.abs(vy) > 5) return;
      var m = pick(e.clientX, e.clientY);
      if (m) openLB(m.userData.it);
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      camera.position.z = Math.max(340, Math.min(1150, camera.position.z + e.deltaY * 0.55));
      camera.updateProjectionMatrix();
    }, { passive: false });

    window.addEventListener('resize', resize);

    return {
      start: init,
      pause: function () {
        running = false;
        hovered = null;
        if (ok) renderer.setAnimationLoop(null);   // 离开球体视图就停渲染，手机上省电
      },
      resume: function () {
        running = true;
        resize();
        if (ok) renderer.setAnimationLoop(loop);
      }
    };
  })();

  gal.start();
  document.querySelector('.view--gallery').classList.add('is-in');

  /* ══════════ ② 作品网格 ══════════ */
  var grid = document.getElementById('grid');
  var chips = document.getElementById('chips');
  var curCat = 'all';

  var catLabel = { expo: '沉浸影像', brand: '品牌片', social: '产品短片', shot: '三维镜头', promo: '宣传片', reel: 'Showreel' };

  function buildChips() {
    var list = [{ k: 'all', t: '全部 · ' + D.items.length }].concat(D.cats);
    chips.innerHTML = list.map(function (c, i) {
      return '<button class="chip' + (i === 0 ? ' is-on' : '') + '" data-cat="' + c.k + '">' + c.t + '</button>';
    }).join('');
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      curCat = b.dataset.cat;
      Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (x) {
        x.classList.toggle('is-on', x === b);
      });
      renderGrid();
    });
  }

  function renderGrid() {
    var list = curCat === 'all'
      ? D.items
      : D.items.filter(function (x) { return x.c === curCat; });
    grid.innerHTML = list.map(function (it) {
      return '<article class="pc" data-s="' + it.s + '">' +
        '<div class="pc__m">' +
          '<img src="' + thumbSrc(it.s) + '" alt="' + it.t + '" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="pc__i">' +
          '<span class="pc__n">' + it.t + '</span>' +
          '<span class="pc__k">' + (catLabel[it.c] || '') + '</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function itemOf(slug) {
    return D.items.filter(function (x) { return x.s === slug; })[0];
  }








































  grid.addEventListener('pointermove', function (e) {
    if (TOUCH) return;
    var c = e.target.closest('.pc');
    if (!c) return;
    var m = c.querySelector('.pc__m');
    if (!m) return;
    var r = m.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width;
    var ny = (e.clientY - r.top) / r.height;
    m.style.setProperty('--ry', ((nx - .5) * 9).toFixed(2) + 'deg');
    m.style.setProperty('--rx', ((.5 - ny) * 7).toFixed(2) + 'deg');
    m.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
    m.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
  }, true);

  grid.addEventListener('pointerenter', function (e) {
    if (TOUCH) return;
    var c = e.target.closest('.pc');
    if (!c) return;
    var it = itemOf(c.dataset.s);
    if (!it || it.kind === 'img') return;   // 静帧不做视频预览
    var m = c.querySelector('.pc__m');
    if (!m || m.querySelector('video')) return;
    prefetch(c.dataset.s);
    var v = document.createElement('video');
    v.src = A(SM + c.dataset.s + '.mp4');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', '');
    m.appendChild(v);
    v.play().catch(function () {});
  }, true);

  grid.addEventListener('pointerleave', function (e) {
    var c = e.target.closest('.pc');
    if (!c) return;
    var v = c.querySelector('video');
    if (v) { v.pause(); v.remove(); }
    var m = c.querySelector('.pc__m');
    if (m) {
      m.style.setProperty('--rx', '0deg');
      m.style.setProperty('--ry', '0deg');
    }
  }, true);

  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.pc');
    if (!c) return;
    var it = itemOf(c.dataset.s);
    if (it) openLB(it);
  });

  buildChips();
  renderGrid();
  warmup();
  movePill();
  window.addEventListener('resize', movePill);
  document.fonts && document.fonts.ready && document.fonts.ready.then(movePill);


  /* ══════════ ③ 关于 ══════════ */
  function renderCV() {
    document.getElementById('cv').innerHTML = D.cv.map(function (x) {
      return '<li><span class="cv__y">' + x.y + '</span>' +
        '<span class="cv__b"><span class="cv__c">' + x.c + '</span>' +
        '<span class="cv__r">' + x.r + '</span></span></li>';
    }).join('');
  }
  renderCV();

  /* 磁性文字轨：鼠标靠近时整行被推开 */
  var marq = document.getElementById('marq');
  var rows = Array.prototype.slice.call(marq.querySelectorAll('.marq__row'));
  var seen = new WeakSet();

  function setupMarquee() {
    rows.forEach(function (row, idx) {
      var span = row.firstElementChild;
      // 复制直到铺满两倍宽度
      var base = span.textContent;
      var need = Math.ceil((window.innerWidth * 2.4) / measure(span)) + 1;
      for (var i = 0; i < Math.max(2, need); i++) {
        var c = document.createElement('span');
        c.className = 'marq__t';
        c.textContent = base;
        row.appendChild(c);
      }
      row._off = 0;
      row._dir = idx % 2 ? 1 : -1;
      row._spd = 0.022 + idx * 0.004;
      Array.prototype.forEach.call(row.children, function (c) { seen.add(c); });
    });
    window.addEventListener('resize', function () {
      // 简化：重排即可
    });
  }
  function measure(el) { return Math.max(80, el.getBoundingClientRect().width); }

  setupMarquee();

  var mY = -9999, mX = -9999;
  window.addEventListener('pointermove', function (e) { mX = e.clientX; mY = e.clientY; });

  var lastTick = performance.now();
  function marqueeTick(now) {
    var dt = Math.min(48, now - lastTick); lastTick = now;
    rows.forEach(function (row) {
      var w = measure(row.firstElementChild);
      row._off += row._dir * row._spd * dt * 0.06;
      // 循环
      if (row._off < -w) row._off += w;
      if (row._off > 0) row._off -= w;
      row.style.transform = 'translate3d(' + row._off + 'px,0,0)';
    });
    requestAnimationFrame(marqueeTick);
  }
  requestAnimationFrame(marqueeTick);

  /* 磁性让位：靠近某行时该行变亮 */
  window.addEventListener('pointermove', function (e) {
    if (cur !== 'about') return;
    rows.forEach(function (row) {
      var r = row.getBoundingClientRect();
      var cy = r.top + r.height / 2;
      var d = Math.abs(e.clientY - cy);
      var near = Math.max(0, 1 - d / 70);
      row.style.opacity = (0.58 + near * 0.42).toFixed(3);
    });
  });

  /* ══════════ 播放浮层 ══════════ */
  var ov = document.getElementById('ov');
  var ovP = document.getElementById('ovP');   /* 轻量预览层（480×270 / 8s） */
  var ovV = document.getElementById('ovV');   /* 正片（960×540 / 60s / 带声） */
  var ovI = document.getElementById('ovI');
  var ovT = document.getElementById('ovT');
  var ovS = document.getElementById('ovS');
  var ovCat = document.getElementById('ovCat');

  /* 正片能出画面了就淡出预览层 */
  function syncLayer() {
    if (ovV.readyState >= 2 && ovV.currentTime > 0) ovP.classList.add('is-off');
  }
  ovV.addEventListener('playing', function () { setTimeout(syncLayer, 60); });
  ovV.addEventListener('timeupdate', syncLayer);

  function openLB(it) {
    ovT.textContent = it.t;
    ovCat.textContent = catLabel[it.c] || '作品';
    ovS.textContent = it.k || '';
    var isImg = it.kind === 'img';
    ovV.style.display = isImg ? 'none' : '';
    ovI.style.display = isImg ? '' : 'none';
    if (isImg) {
      ovV.pause(); ovP.pause();
      ovV.removeAttribute('src');
      ovP.classList.add('is-off');
      ovI.src = A(IMG + it.s + '.webp');
      ovI.alt = it.t;
    } else {
      ovI.removeAttribute('src');
      /* ① 预览层立刻接上 —— 它只有 100KB 出头且早已在缓存里，点下去就有画面在动 */
      ovP.classList.remove('is-off');
      if (ovP.dataset.s !== it.s) {
        ovP.dataset.s = it.s;
        ovP.src = A(SM + it.s + '.mp4');
        ovP.load();
      }
      try { ovP.currentTime = 0; } catch (e) {}
      ovP.play().catch(function () {});
      /* ② 正片在下面同步加载，播起来了再盖掉预览层 */
      ovV.poster = coverSrc(it.s);
      if (ovV.dataset.s !== it.s) {
        ovV.dataset.s = it.s;
        ovV.src = A(VID + it.s + '.mp4');
        ovV.load();
      } else {
        try { ovV.currentTime = 0; } catch (e) {}
      }
      ovV.play().catch(function () {});
      prefetch(it.s);
    }
    ov.classList.add('is-on');
    ov.setAttribute('aria-hidden', 'false');
  }
  function closeLB() {
    ov.classList.remove('is-on');
    ov.setAttribute('aria-hidden', 'true');
    /* 只暂停、不清 src —— 留着已解码的缓冲，再次点开同一个片子是瞬时的。
       换成别的片子时 openLB 里会比对 dataset.s 再换源。 */
    ovV.pause();
    ovP.pause();
    ovI.removeAttribute('src');
  }
  document.getElementById('ovX').addEventListener('click', closeLB);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeLB(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ov.classList.contains('is-on')) closeLB();
  });

  /* 滚轮翻视图（影像 → 作品） */
  var wheelLock = 0;
  window.addEventListener('wheel', function (e) {
    if (cur !== 'gallery') return;
    if (Date.now() < wheelLock) return;
    if (Math.abs(e.deltaY) < 30) return;
    wheelLock = Date.now() + 900;
    go(e.deltaY > 0 ? 'projects' : 'gallery');
  }, { passive: true });

})();
