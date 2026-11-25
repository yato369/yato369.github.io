/* ══════════════════════════════════════════════════════════
   程佳伟 · 作品集 (site3) — app.js
   ① 影像：dt 归一化 WebGL 球体 + 悬停微浮起 + 实时作品胶囊
   ② 作品：FLIP 网格重排 + 无黑帧视频悬停预览
   ③ 关于：缓存宽度无限文字轨 + 一键复制
   ④ 播放浮层：空间原点展开 + 上下片切换 + 缓冲状态
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = window.DATA;
  var A = window.A || function (p) { return p; };
  var IMG = 'assets/img/';
  var IMG_SM = 'assets/img-sm/';
  var VID = 'assets/video/';
  var SM = 'assets/vid-sm/';

  var rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var RM = rmQuery.matches;
  if (rmQuery.addEventListener) {
    rmQuery.addEventListener('change', function (e) { RM = e.matches; });
  }
  var TOUCH = window.matchMedia('(hover:none), (pointer:coarse)').matches;

  var COVERS = window.COVERS || {};
  var FILE_MODE = location.protocol === 'file:';
  function coverSrc(slug) {
    if (FILE_MODE) return COVERS[slug] || A(IMG + slug + '.webp');
    return A(IMG_SM + slug + '.webp');
  }
  function thumbSrc(slug) {
    return FILE_MODE ? (COVERS[slug] || A(IMG + slug + '.webp')) : A(IMG_SM + slug + '.webp');
  }

  /* ── 主题系统（深色 / 浅色） ── */
  var themeBtn = document.getElementById('themeBtn');
  function getTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }
  function setTheme(next, persist) {
    document.documentElement.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem('cjw-theme', next); } catch (e) {}
    }
    if (gal && gal.syncTheme) gal.syncTheme(next);
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      setTheme(getTheme() === 'light' ? 'dark' : 'light', true);
    });
  }

  /* ── 一键复制与 Toast 提示 ── */
  var toastEl = document.getElementById('toast');
  var toastTimer = 0;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-on');
    }, 1800);
  }
  function copyText(text, btn) {
    var done = function () {
      if (btn) {
        btn.classList.add('is-copied');
        var origText = btn.classList.contains('copy-pill') ? btn.textContent : null;
        if (origText !== null) btn.textContent = '已复制';
        clearTimeout(btn._cpTimer);
        btn._cpTimer = setTimeout(function () {
          btn.classList.remove('is-copied');
          if (origText !== null) btn.textContent = origText;
        }, 1600);
      }
      showToast('已复制：' + text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text); done();
      });
    } else {
      fallbackCopy(text); done();
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    copyText(btn.dataset.copy, btn);
  });

  /* ── 速度层：预热与预取 ── */
  var fetching = {};
  function prefetch(slug) {
    if (TOUCH || FILE_MODE || fetching[slug]) return;
    fetching[slug] = true;
    var v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true;
    v.src = A(VID + slug + '.mp4');
    v.load();
  }
  function cheapNet() {
    var c = navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    return /^(slow-)?2g$/.test(c.effectiveType || '');
  }
  function warm(url) {
    if (typeof fetch !== 'function') return Promise.resolve();
    return fetch(url, { cache: 'force-cache' }).then(function (r) { return r.blob(); }).catch(function () {});
  }
  function warmup() {
    if (TOUCH || FILE_MODE || cheapNet()) return;
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    var list = D.items.filter(function (x) { return x.kind !== 'img'; });
    idle(function () {
      var k = 0;
      (function stepSm() {
        if (k >= list.length) return;
        warm(A(SM + list[k++].s + '.mp4')).then(function () { setTimeout(stepSm, 60); });
      })();
      list.slice(0, 4).forEach(function (x, i) {
        setTimeout(function () { prefetch(x.s); }, 900 + i * 1400);
      });
    });
  }

  /* ────────── 视图切换与 Dock ────────── */
  var dock = document.getElementById('dock');
  var dockPill = document.getElementById('dockPill');
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  var dockBtns = Array.prototype.slice.call(dock.querySelectorAll('.dock__b'));
  var cur = 'gallery';

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
      var on = v.dataset.view === name;
      v.classList.toggle('is-on', on);
      v.classList.toggle('is-in', on);
    });
    dockBtns.forEach(function (b) {
      var on = b.dataset.go === name;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    movePill();
    if (name === 'gallery') gal.resume();
    else gal.pause();
    if (name === 'about') marqCtrl.resume();
    else marqCtrl.pause();
  }

  dock.addEventListener('click', function (e) {
    var b = e.target.closest('.dock__b');
    if (!b) return;
    go(b.dataset.go);
  });
  dock.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var idx = dockBtns.findIndex(function (b) { return b.dataset.go === cur; });
    if (idx < 0) return;
    e.preventDefault();
    var next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + dockBtns.length) % dockBtns.length;
    go(dockBtns[next].dataset.go);
    dockBtns[next].focus();
  });

  var catLabel = { expo: '沉浸影像', brand: '品牌片', social: '产品短片', shot: '三维镜头', promo: '宣传片', reel: 'Showreel' };

  /* ══════════ ① 影像球（dt 归一化物理 + 悬停反馈） ══════════ */
  var gal = (function () {
    var canvas = document.getElementById('gl');
    var host = canvas.parentNode;
    var cap = document.getElementById('galCap');
    var capCat = document.getElementById('galCapCat');
    var capTitle = document.getElementById('galCapTitle');
    var renderer, scene, camera, group, meshes = [];
    var ok = false;

    var RAD = 206;
    var PLANE = 124;
    var drag = false, px = 0, py = 0, vx = 0, vy = 0, movedDist = 0;
    var pts = new Map(), pinchD0 = 0, pinchZ0 = 0, pinchT = 0;
    var tRotX = -0.2, tRotY = 0.4, rotX = -0.2, rotY = 0.4;
    var curZ = 660, targetZ = 660;
    var curScale = 0.84, targetScale = 0.84;
    var hovered = null, running = true, raf = 0;

    function updateCaption(m) {
      if (!cap) return;
      if (!m) {
        cap.classList.remove('is-on');
        return;
      }
      var it = m.userData.it;
      capCat.textContent = catLabel[it.c] || '作品';
      capTitle.textContent = it.t;
      cap.classList.add('is-on');
    }

    function applyThemeColors(theme) {
      if (!ok) return;
      var isLight = theme === 'light';
      var plateHex = isLight ? 0xe0e0dc : 0x1c1c1f;
      var bright = isLight ? 1.0 : 1.14;
      meshes.forEach(function (m) {
        m.material.color.setRGB(bright, bright, bright);
        if (m.userData.plate) {
          m.userData.plate.material.color.setHex(plateHex);
          m.userData.plate.material.opacity = isLight ? 0.85 : 0.92;
        }
      });
    }

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
      camera.position.set(0, 0, 660);

      group = new THREE.Group();
      scene.add(group);

      var n = D.items.length;
      var gold = Math.PI * (3 - Math.sqrt(5));
      var loader = new THREE.TextureLoader();
      var geo = new THREE.PlaneGeometry(PLANE, PLANE * 9 / 16);
      var plateGeo = new THREE.PlaneGeometry(PLANE + 3, PLANE * 9 / 16 + 3);
      var isLight = getTheme() === 'light';

      for (var i = 0; i < n; i++) {
        var it = D.items[i];
        var y = 1 - (i / (n - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = gold * i;

        var cover = loader.load(coverSrc(it.s));
        cover.colorSpace = THREE.SRGBColorSpace;
        var bright = isLight ? 1.0 : 1.14;
        var m = new THREE.MeshBasicMaterial({
          map: cover,
          transparent: true, opacity: 1,
          color: new THREE.Color(bright, bright, bright)
        });
        var mesh = new THREE.Mesh(geo, m);
        var plate = new THREE.Mesh(
          plateGeo,
          new THREE.MeshBasicMaterial({
            color: isLight ? 0xe0e0dc : 0x1c1c1f,
            transparent: true,
            opacity: isLight ? 0.85 : 0.92
          })
        );
        plate.position.set(0, 0, -0.9);
        mesh.add(plate);

        var bx = Math.cos(th) * r * RAD;
        var by = y * RAD;
        var bz = Math.sin(th) * r * RAD;
        mesh.position.set(bx, by, bz);
        mesh.lookAt(0, 0, 0);

        /* 记录法线方向（朝外），悬停时沿法线轻推 */
        var dir = new THREE.Vector3(bx, by, bz).normalize();
        mesh.userData = {
          it: it, i: i, cover: cover, plate: plate, live: false,
          basePos: new THREE.Vector3(bx, by, bz),
          dir: dir,
          hoverAmt: 0
        };
        group.add(mesh);
        meshes.push(mesh);

        if (it.kind !== 'img' && !FILE_MODE && !TOUCH) {
          (function (mesh) {
            var v = document.createElement('video');
            v.src = A(SM + mesh.userData.it.s + '.mp4');
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
          })(mesh);
        }
      }

      ok = true;
      resize();
      curZ = targetZ;
      camera.position.z = curZ;

      group.scale.setScalar(RM ? 1 : 0.84);
      curScale = RM ? 1 : 0.84;
      targetScale = RM ? 1 : 0.84;
      group.rotation.set(-0.2, 0.4, 0.4);

      window.__GAL = { renderer: renderer, scene: scene, camera: camera, group: group, meshes: meshes, get ok() { return ok; } };

      function startIn() { targetScale = 1; }
      if (document.body.classList.contains('is-intro')) {
        window.addEventListener('intro:done', startIn, { once: true });
      } else {
        startIn();
      }
      renderer.setAnimationLoop(loop);
    }

    var last = performance.now();
    function loop() {
      var now = performance.now();
      var dtMs = Math.min(48, Math.max(1, now - last));
      var dt = dtMs / 1000;
      last = now;

      /* dt 归一化阻尼与弹簧系数（60Hz / 120Hz 手感完全一致） */
      if (!drag) {
        var damp = Math.exp(-3.8 * dt);
        vx *= damp;
        vy *= damp;
        tRotY += vx * dt * 0.036;
        tRotX += vy * dt * 0.036;
        tRotX = Math.max(-0.92, Math.min(0.92, tRotX));
        if (!RM) tRotY += 0.095 * dt;
      }

      var rotAlpha = RM ? 1 : (1 - Math.exp(-8.5 * dt));
      rotX += (tRotX - rotX) * rotAlpha;
      rotY += (tRotY - rotY) * rotAlpha;

      group.rotation.x = rotX;
      group.rotation.y = rotY;
      group.rotation.z = 0.4;

      if (Math.abs(targetScale - curScale) > 0.0004) {
        var sAlpha = RM ? 1 : (1 - Math.exp(-4.8 * dt));
        curScale += (targetScale - curScale) * sAlpha;
        group.scale.setScalar(curScale);
      }

      if (Math.abs(targetZ - curZ) > 0.1) {
        var zAlpha = RM ? 1 : (1 - Math.exp(-12 * dt));
        curZ += (targetZ - curZ) * zAlpha;
        camera.position.z = curZ;
      }

      /* 悬停卡片：平滑微放大 + 沿法线轻推，非悬停退回封面 */
      var hAlpha = RM ? 1 : (1 - Math.exp(-14 * dt));
      if (hovered) {
        var hv = hovered.userData.video;
        if (hv && hv.paused) hv.play().catch(function () {});
      }
      for (var i = 0; i < meshes.length; i++) {
        var m = meshes[i];
        var ud = m.userData;
        var targetH = (m === hovered) ? 1 : 0;
        if (Math.abs(targetH - ud.hoverAmt) > 0.002) {
          ud.hoverAmt += (targetH - ud.hoverAmt) * hAlpha;
          var s = 1 + ud.hoverAmt * 0.075;
          m.scale.setScalar(s);
          var push = ud.hoverAmt * 14;
          m.position.set(
            ud.basePos.x + ud.dir.x * push,
            ud.basePos.y + ud.dir.y * push,
            ud.basePos.z + ud.dir.z * push
          );
        }
        if (m !== hovered) {
          var v = ud.video;
          if (v && !v.paused) v.pause();
          if (ud.live) {
            m.material.map = ud.cover;
            m.material.needsUpdate = true;
            ud.live = false;
          }
        }
      }

      renderer.render(scene, camera);
    }

    function resize() {
      if (!ok) return;
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var portrait = h > w;
      targetZ = portrait ? 800 : 660;
      if (!running) {
        curZ = targetZ;
        camera.position.z = curZ;
      }
      group.position.x = 0;
      camera.updateProjectionMatrix();
    }

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
        pinchZ0 = targetZ;
        drag = false; vx = vy = 0;
        return;
      }
      drag = true; px = e.clientX; py = e.clientY;
      vx = vy = 0; movedDist = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        targetZ = Math.max(340, Math.min(1150, pinchZ0 * pinchD0 / d));
        pinchT = Date.now();
        return;
      }
      if (drag) {
        var dx = e.clientX - px, dy = e.clientY - py;
        px = e.clientX; py = e.clientY;
        movedDist += Math.hypot(dx, dy);
        tRotY += dx * 0.0052; tRotX += dy * 0.0042;
        vx = dx; vy = dy;
        tRotX = Math.max(-0.95, Math.min(0.95, tRotX));
        if (hovered) { hovered = null; updateCaption(null); }
      } else if (!TOUCH) {
        var m = pick(e.clientX, e.clientY);
        if (m !== hovered) {
          hovered = m;
          canvas.style.cursor = m ? 'pointer' : 'grab';
          updateCaption(m);
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
    canvas.addEventListener('pointerleave', function () {
      if (hovered) { hovered = null; updateCaption(null); canvas.style.cursor = 'grab'; }
    });
    canvas.addEventListener('click', function (e) {
      if (Date.now() - pinchT < 400) return;
      if (movedDist > 8) return;
      var m = pick(e.clientX, e.clientY);
      if (m) openLB(m.userData.it, null, D.items);
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      targetZ = Math.max(340, Math.min(1150, targetZ + e.deltaY * 0.52));
    }, { passive: false });

    window.addEventListener('resize', resize);

    return {
      start: init,
      syncTheme: applyThemeColors,
      pause: function () {
        running = false;
        hovered = null;
        updateCaption(null);
        if (ok) renderer.setAnimationLoop(null);
      },
      resume: function () {
        running = true;
        last = performance.now();
        resize();
        if (ok) renderer.setAnimationLoop(loop);
      }
    };
  })();

  gal.start();
  document.querySelector('.view--gallery').classList.add('is-in');

  /* ══════════ ② 作品网格（FLIP 筛选 + 无黑帧悬停预览） ══════════ */
  var grid = document.getElementById('grid');
  var chips = document.getElementById('chips');
  var curCat = 'all';
  var cardMap = new Map();

  function getFilteredItems() {
    return curCat === 'all' ? D.items : D.items.filter(function (x) { return x.c === curCat; });
  }

  function buildChips() {
    var counts = { all: D.items.length };
    D.items.forEach(function (it) { counts[it.c] = (counts[it.c] || 0) + 1; });
    var list = [{ k: 'all', t: '全部' }].concat(D.cats);
    chips.innerHTML = list.map(function (c, i) {
      return '<button class="chip' + (i === 0 ? ' is-on' : '') + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '" data-cat="' + c.k + '" type="button">' +
        '<span>' + c.t + '</span><span class="chip__n">' + (counts[c.k] || 0) + '</span></button>';
    }).join('');

    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || b.dataset.cat === curCat) return;
      curCat = b.dataset.cat;
      Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (x) {
        var on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      filterGridFLIP();
    });
  }

  function buildGridOnce() {
    var frag = document.createDocumentFragment();
    D.items.forEach(function (it) {
      var art = document.createElement('article');
      art.className = 'pc';
      art.dataset.s = it.s;
      art.dataset.c = it.c;
      art.tabIndex = 0;
      art.setAttribute('role', 'button');
      art.setAttribute('aria-label', it.t + '，' + (catLabel[it.c] || '作品'));
      art.innerHTML =
        '<div class="pc__m">' +
          '<img src="' + thumbSrc(it.s) + '" alt="' + it.t + '" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="pc__i">' +
          '<span class="pc__n">' + it.t + '</span>' +
          '<span class="pc__k">' + (catLabel[it.c] || '') + '</span>' +
        '</div>';
      cardMap.set(it.s, art);
      frag.appendChild(art);
    });
    grid.appendChild(frag);
  }

  /* FLIP：保留 DOM 节点，平滑移动到新网格位置 */
  function filterGridFLIP() {
    var cards = Array.from(cardMap.values());
    var firstRects = new Map();
    cards.forEach(function (el) {
      if (!el.classList.contains('is-hidden')) {
        firstRects.set(el, el.getBoundingClientRect());
      }
    });

    var entering = [];
    cards.forEach(function (el) {
      var match = (curCat === 'all' || el.dataset.c === curCat);
      var wasHidden = el.classList.contains('is-hidden');
      el.classList.remove('is-enter');
      el.style.transition = '';
      el.style.transform = '';
      if (match) {
        el.classList.remove('is-hidden');
        if (wasHidden) entering.push(el);
      } else {
        el.classList.add('is-hidden');
      }
    });

    if (RM) return;

    /* Play: 现有卡片从旧位置滑到新位置 */
    cards.forEach(function (el) {
      if (el.classList.contains('is-hidden')) return;
      var first = firstRects.get(el);
      if (!first) return;
      var last = el.getBoundingClientRect();
      var dx = first.left - last.left;
      var dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      el.offsetHeight; /* 仅对需要移动的元素触发一次同步计算 */
      el.style.transition = 'transform 420ms var(--ease-spring)';
      el.style.transform = '';
    });

    /* 新出现的卡片错开轻盈入场 */
    entering.forEach(function (el, idx) {
      el.style.animationDelay = Math.min(idx * 30, 180) + 'ms';
      el.classList.add('is-enter');
    });
  }

  function itemOf(slug) {
    return D.items.filter(function (x) { return x.s === slug; })[0];
  }

  grid.addEventListener('pointermove', function (e) {
    if (TOUCH || RM) return;
    var c = e.target.closest('.pc');
    if (!c) return;
    var m = c.querySelector('.pc__m');
    if (!m) return;
    var r = m.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width;
    var ny = (e.clientY - r.top) / r.height;
    m.style.setProperty('--ry', ((nx - .5) * 8).toFixed(2) + 'deg');
    m.style.setProperty('--rx', ((.5 - ny) * 6).toFixed(2) + 'deg');
    m.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
    m.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
  }, true);

  grid.addEventListener('pointerenter', function (e) {
    if (TOUCH) return;
    var c = e.target.closest('.pc');
    if (!c) return;
    var it = itemOf(c.dataset.s);
    if (!it || it.kind === 'img') return;
    var m = c.querySelector('.pc__m');
    if (!m) return;
    c._leaving = false;
    clearTimeout(c._leaveTimer);
    prefetch(c.dataset.s);

    var v = m.querySelector('video');
    if (v) {
      v.play().catch(function () {});
      if (v.readyState >= 2) v.classList.add('is-live');
      return;
    }
    v = document.createElement('video');
    v.src = A(SM + c.dataset.s + '.mp4');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', '');
    var showLive = function () {
      if (!c._leaving) v.classList.add('is-live');
    };
    v.addEventListener('playing', showLive, { once: true });
    v.addEventListener('loadeddata', showLive, { once: true });
    m.appendChild(v);
    v.play().catch(function () {});
  }, true);

  grid.addEventListener('pointerleave', function (e) {
    var c = e.target.closest('.pc');
    if (!c) return;
    c._leaving = true;
    var m = c.querySelector('.pc__m');
    if (m) {
      m.style.setProperty('--rx', '0deg');
      m.style.setProperty('--ry', '0deg');
    }
    var v = c.querySelector('video');
    if (v) {
      v.classList.remove('is-live');
      clearTimeout(c._leaveTimer);
      c._leaveTimer = setTimeout(function () {
        if (c._leaving && v.parentNode) { v.pause(); v.remove(); }
      }, 280);
    }
  }, true);

  function openCard(c) {
    var it = itemOf(c.dataset.s);
    if (!it) return;
    var mediaEl = c.querySelector('.pc__m');
    openLB(it, mediaEl ? mediaEl.getBoundingClientRect() : null, getFilteredItems(), c);
  }
  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.pc');
    if (c) openCard(c);
  });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target.closest('.pc');
    if (!c) return;
    e.preventDefault();
    openCard(c);
  });

  buildChips();
  buildGridOnce();
  warmup();
  movePill();
  window.addEventListener('resize', movePill);
  document.fonts && document.fonts.ready && document.fonts.ready.then(movePill);

  /* ══════════ ③ 关于：履历与缓存宽度无限文字轨 ══════════ */
  document.getElementById('cv').innerHTML = D.cv.map(function (x) {
    return '<li><span class="cv__y">' + x.y + '</span>' +
      '<span class="cv__b"><span class="cv__c">' + x.c + '</span>' +
      '<span class="cv__r">' + x.r + '</span></span></li>';
  }).join('');

  var marqCtrl = (function () {
    var marq = document.getElementById('marq');
    var rows = Array.prototype.slice.call(marq.querySelectorAll('.marq__row'));
    var raf = 0, lastT = performance.now(), active = false;

    function measureWidths() {
      rows.forEach(function (row) {
        if (row.firstElementChild) {
          row._w = Math.max(80, row.firstElementChild.getBoundingClientRect().width);
        }
      });
    }

    rows.forEach(function (row, idx) {
      var span = row.firstElementChild;
      var base = span.textContent;
      var w = Math.max(80, span.getBoundingClientRect().width);
      var need = Math.ceil((window.innerWidth * 2.4) / w) + 1;
      for (var i = 0; i < Math.max(2, need); i++) {
        var c = document.createElement('span');
        c.className = 'marq__t';
        c.textContent = base;
        row.appendChild(c);
      }
      row._w = w;
      row._off = 0;
      row._dir = idx % 2 ? 1 : -1;
      row._spd = 0.022 + idx * 0.004;
    });

    window.addEventListener('resize', measureWidths);
    document.fonts && document.fonts.ready && document.fonts.ready.then(measureWidths);

    function tick(now) {
      if (!active || RM) { raf = 0; return; }
      var dt = Math.min(48, now - lastT); lastT = now;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var w = row._w || 200;
        row._off += row._dir * row._spd * dt * 0.06;
        if (row._off < -w) row._off += w;
        if (row._off > 0) row._off -= w;
        row.style.transform = 'translate3d(' + row._off.toFixed(2) + 'px,0,0)';
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener('pointermove', function (e) {
      if (cur !== 'about' || TOUCH) return;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var r = row.getBoundingClientRect();
        var cy = r.top + r.height / 2;
        var near = Math.max(0, 1 - Math.abs(e.clientY - cy) / 72);
        row.style.opacity = (0.58 + near * 0.42).toFixed(3);
      }
    });

    return {
      pause: function () { active = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      resume: function () {
        if (RM || active) return;
        active = true; lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
  })();

  /* ══════════ ④ 播放浮层（空间展开 + 切换 + 状态） ══════════ */
  var ov = document.getElementById('ov');
  var ovBox = document.getElementById('ovBox');
  var ovStage = document.getElementById('ovStage');
  var ovP = document.getElementById('ovP');
  var ovV = document.getElementById('ovV');
  var ovI = document.getElementById('ovI');
  var ovT = document.getElementById('ovT');
  var ovS = document.getElementById('ovS');
  var ovCat = document.getElementById('ovCat');
  var ovIdx = document.getElementById('ovIdx');
  var ovStatus = document.getElementById('ovStatus');
  var ovStatusText = document.getElementById('ovStatusText');
  var ovPrev = document.getElementById('ovPrev');
  var ovNext = document.getElementById('ovNext');
  var ovX = document.getElementById('ovX');

  var lbList = D.items, lbIndex = 0, lastTrigger = null, closeTimer = 0;

  function setStatus(msg) {
    if (!ovStatus) return;
    if (!msg) { ovStatus.classList.remove('is-on'); return; }
    ovStatusText.textContent = msg;
    ovStatus.classList.add('is-on');
  }

  function syncLayer() {
    if (ovV.readyState >= 2 && ovV.currentTime > 0) {
      ovP.classList.add('is-off');
      setStatus(null);
    }
  }
  ovV.addEventListener('playing', function () { setTimeout(syncLayer, 60); });
  ovV.addEventListener('timeupdate', syncLayer);
  ovV.addEventListener('waiting', function () {
    if (ov.classList.contains('is-on') && ovV.style.display !== 'none') setStatus('缓冲中');
  });
  ovV.addEventListener('error', function () {
    if (ov.classList.contains('is-on') && ovV.style.display !== 'none') setStatus('预览循环中');
  });

  function loadLBItem(it) {
    ovT.textContent = it.t;
    ovCat.textContent = catLabel[it.c] || '作品';
    ovS.textContent = it.k || '';
    if (ovIdx) ovIdx.textContent = (lbIndex + 1) + ' / ' + lbList.length;

    var isImg = it.kind === 'img';
    ovV.style.display = isImg ? 'none' : '';
    ovI.style.display = isImg ? '' : 'none';
    if (isImg) {
      ovV.pause(); ovP.pause();
      ovV.removeAttribute('src');
      ovP.classList.add('is-off');
      setStatus(null);
      ovI.src = A(IMG + it.s + '.webp');
      ovI.alt = it.t;
    } else {
      ovI.removeAttribute('src');
      ovP.classList.remove('is-off');
      if (ovP.dataset.s !== it.s) {
        ovP.dataset.s = it.s;
        ovP.src = A(SM + it.s + '.mp4');
        ovP.load();
      }
      try { ovP.currentTime = 0; } catch (e) {}
      ovP.play().catch(function () {});

      setStatus('正片加载中');
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
  }

  function openLB(it, originRect, list, triggerEl) {
    clearTimeout(closeTimer);
    lastTrigger = triggerEl || document.activeElement;
    lbList = list && list.length ? list : D.items;
    lbIndex = Math.max(0, lbList.findIndex(function (x) { return x.s === it.s; }));

    /* 计算空间原点偏移，让浮层从点击卡片的位置轻盈展开 */
    if (originRect && !RM) {
      var vw = window.innerWidth, vh = window.innerHeight;
      var ox = (originRect.left + originRect.width / 2) - vw / 2;
      var oy = (originRect.top + originRect.height / 2) - vh / 2;
      var os = Math.max(0.28, Math.min(0.85, originRect.width / Math.min(1100, vw * 0.85)));
      ovBox.style.setProperty('--ox', ox.toFixed(1) + 'px');
      ovBox.style.setProperty('--oy', oy.toFixed(1) + 'px');
      ovBox.style.setProperty('--os', os.toFixed(3));
    } else {
      ovBox.style.setProperty('--ox', '0px');
      ovBox.style.setProperty('--oy', '12px');
      ovBox.style.setProperty('--os', '.95');
    }

    loadLBItem(it);
    ov.classList.add('is-on');
    ov.setAttribute('aria-hidden', 'false');
    if (ovX) setTimeout(function () { ovX.focus({ preventScroll: true }); }, 60);
  }

  function stepLB(delta) {
    if (!lbList.length) return;
    lbIndex = (lbIndex + delta + lbList.length) % lbList.length;
    ovStage.classList.add('is-swap');
    setTimeout(function () {
      loadLBItem(lbList[lbIndex]);
      ovStage.classList.remove('is-swap');
    }, RM ? 0 : 120);
  }

  function closeLB() {
    if (!ov.classList.contains('is-on')) return;
    ov.classList.remove('is-on');
    ov.setAttribute('aria-hidden', 'true');
    setStatus(null);
    ovV.pause();
    ovP.pause();
    closeTimer = setTimeout(function () {
      if (!ov.classList.contains('is-on')) {
        ovI.removeAttribute('src');
      }
    }, 440);
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus({ preventScroll: true });
    }
  }

  ovX.addEventListener('click', closeLB);
  ovPrev.addEventListener('click', function () { stepLB(-1); });
  ovNext.addEventListener('click', function () { stepLB(1); });
  ov.addEventListener('click', function (e) { if (e.target === ov) closeLB(); });

  /* 触摸左右滑动切换作品 */
  var touchX0 = 0, touchY0 = 0;
  ovStage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touchX0 = e.touches[0].clientX;
      touchY0 = e.touches[0].clientY;
    }
  }, { passive: true });
  ovStage.addEventListener('touchend', function (e) {
    if (!e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - touchX0;
    var dy = e.changedTouches[0].clientY - touchY0;
    if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      stepLB(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (!ov.classList.contains('is-on')) return;
    if (e.key === 'Escape') closeLB();
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepLB(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepLB(1); }
  });
})();
