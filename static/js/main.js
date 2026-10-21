(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ------------------------------------------------------------ nav */
  const nav = $(".nav");
  const hero = $(".hero");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > hero.offsetHeight - 80);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = $(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$(".nav-links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));

  const links = new Map($$(".nav-links a").map((a) => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove("active"));
        links.get(e.target.id)?.classList.add("active");
      }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  links.forEach((_, id) => document.getElementById(id) && spy.observe(document.getElementById(id)));

  /* --------------------------------------------------------- reveal */
  const reveal = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          reveal.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  $$(".reveal, .charts").forEach((el) => reveal.observe(el));

  /* ------------------------------------------------- compare sliders */
  $$(".compare").forEach((cmp) => {
    const range = $(".cmp-range", cmp);
    range.addEventListener("input", () => cmp.style.setProperty("--pos", range.value + "%"));
  });

  /* ----------------------------------------------- synchronised video */
  const ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a.5.5 0 00.77.42l8.5-5.5a.5.5 0 000-.84l-8.5-5.5A.5.5 0 004 2.5z"/></svg>';

  const groups = $$("[data-sync]");
  const isShown = (el) => !el.closest("[hidden]");

  function setToggle(group, playing) {
    const btn = $("[data-action='toggle']", group);
    if (!btn) return;
    if (btn.classList.contains("icon-btn")) btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    else btn.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function playGroup(group, restart) {
    $$("video", group).forEach((v) => {
      if (restart) v.currentTime = 0;
      v.play().catch(() => {});
    });
    group.dataset.playing = "1";
    setToggle(group, true);
  }

  function pauseGroup(group) {
    $$("video", group).forEach((v) => v.pause());
    group.dataset.playing = "0";
    setToggle(group, false);
  }

  function wireGroup(group) {
    const videos = $$("video", group);
    const master = videos[0];
    const bar = $(".progress i", group);
    videos.forEach((v) => (v.loop = false));
    master.addEventListener("timeupdate", () => {
      if (bar && master.duration) bar.style.width = (100 * master.currentTime) / master.duration + "%";
      videos.slice(1).forEach((v) => {
        if (!v.paused && Math.abs(v.currentTime - master.currentTime) > 0.15) v.currentTime = master.currentTime;
      });
    });
    master.addEventListener("ended", () => playGroup(group, true));
    $("[data-action='restart']", group)?.addEventListener("click", () => {
      group.dataset.userPaused = "0";
      playGroup(group, true);
    });
    $("[data-action='toggle']", group)?.addEventListener("click", () => {
      const playing = group.dataset.playing === "1";
      group.dataset.userPaused = playing ? "1" : "0";
      playing ? pauseGroup(group) : playGroup(group, false);
    });
  }
  groups.forEach(wireGroup);

  const vis = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const t = e.target;
        const visible = e.isIntersecting && isShown(t);
        if (t.hasAttribute("data-sync")) {
          if (visible && t.dataset.userPaused !== "1") {
            playGroup(t, t.dataset.started !== "1");
            t.dataset.started = "1";
          } else if (!visible) pauseGroup(t);
        } else if (visible) t.play().catch(() => {});
        else t.pause();
      }),
    { threshold: 0.2 }
  );
  groups.forEach((g) => vis.observe(g));
  $$("video").forEach((v) => !v.closest("[data-sync]") && vis.observe(v));

  const reobserve = (root) => {
    $$("[data-sync]", root).forEach((g) => {
      g.dataset.started = "0";
      vis.unobserve(g);
      vis.observe(g);
    });
    $$("video", root).forEach((v) => {
      if (!v.closest("[data-sync]")) {
        vis.unobserve(v);
        vis.observe(v);
      }
    });
  };

  /* ------------------------------------------------------------ tabs */
  $$("[role='tablist']").forEach((list) => {
    const tabs = $$("[role='tab']", list);
    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          const sel = t === tab;
          t.setAttribute("aria-selected", String(sel));
          const panel = document.getElementById(t.getAttribute("aria-controls"));
          panel.hidden = !sel;
          if (!sel) {
            $$("[data-sync]", panel).forEach(pauseGroup);
            $$("video", panel).forEach((v) => v.pause());
          }
        });
        reobserve(document.getElementById(tab.getAttribute("aria-controls")));
      })
    );
  });

  /* ---------------------------------------------------- demo switcher */
  const demo = $("#demo-player");
  if (demo) {
    const [gt, ours] = $$(".compare video", demo);
    const strip = $(".strip video", demo);
    const cmp = $(".compare", demo);
    const title = $(".title", demo);
    const meta = $(".meta", demo);
    $$("[data-demo]").forEach((chip) =>
      chip.addEventListener("click", () => {
        $$("[data-demo]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        const id = chip.dataset.clip;
        const set = (v, name) => {
          v.poster = `static/video/${name}.jpg`;
          v.src = `static/video/${name}.mp4`;
        };
        set(gt, `sq_gt_${id}`);
        set(ours, `sq_ours_${id}`);
        set(strip, `strip_${id}`);
        cmp.style.aspectRatio = chip.dataset.ratio;
        title.textContent = chip.dataset.title;
        meta.textContent = chip.dataset.meta;
        $$(".info-panel").forEach((p) => (p.hidden = p.id !== `info-${chip.dataset.demo}`));
        demo.dataset.userPaused = "0";
        playGroup(demo, true);
      })
    );
  }

  /* ---------------------------------------------------------- bibtex */
  const copy = $(".copy-btn");
  copy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($(".bib pre").innerText);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select to copy";
    }
    setTimeout(() => (copy.textContent = "Copy"), 1600);
  });
})();
