/**
 * Show the diagram asset that matches Material's active palette.
 *
 * Dual <picture> sources are labeled with prefers-color-scheme light/dark.
 * When both exist they map straight through:
 *   light page  → light source
 *   dark page   → dark source
 * Single-image pictures are left unchanged.
 *
 * Browsers re-resolve <source media> from the OS preference even when Material's
 * toggle disagrees, so we rewrite each <picture> into a dual-<img> pair driven
 * by data-md-color-scheme ("default" | "slate").
 */
(function () {
  function firstUrl(srcset) {
    if (!srcset) return null;
    return srcset.trim().split(/\s+/)[0] || null;
  }

  function pairFromPicture(picture) {
    var sources = picture.querySelectorAll("source[srcset]");
    var img = picture.querySelector("img");
    var mediaDark = null;
    var mediaLight = null;
    var namedDark = null;
    var namedLight = null;
    var i;

    for (i = 0; i < sources.length; i++) {
      var media = (sources[i].getAttribute("media") || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      var src = firstUrl(sources[i].getAttribute("srcset"));
      if (!src) continue;
      var file = src.split("/").pop().toLowerCase();

      if (media.indexOf("prefers-color-scheme:dark") !== -1) mediaDark = src;
      else if (media.indexOf("prefers-color-scheme:light") !== -1)
        mediaLight = src;

      if (file.indexOf("dark") !== -1) namedDark = src;
      if (file.indexOf("light") !== -1) namedLight = src;
    }

    var lightSrc =
      mediaLight || namedLight || (img && img.getAttribute("src"));
    var darkSrc = mediaDark || namedDark || lightSrc;

    // Only build a dual pair when two distinct sources exist.
    if (lightSrc && darkSrc && lightSrc !== darkSrc) {
      return { forLightPage: lightSrc, forDarkPage: darkSrc };
    }

    var only = lightSrc || darkSrc || (img && img.getAttribute("src"));
    return { forLightPage: only, forDarkPage: only };
  }

  function rewritePicture(picture) {
    if (picture.getAttribute("data-fmsg-scheme") === "done") return;
    if (
      picture.classList &&
      picture.classList.contains("fmsg-scheme-image")
    ) {
      return;
    }

    var img = picture.querySelector("img");
    if (!img) return;
    var alt = img.getAttribute("alt") || "";
    var pair = pairFromPicture(picture);
    if (!pair.forLightPage) return;

    var wrap = document.createElement("span");
    wrap.className = "fmsg-scheme-image";
    wrap.setAttribute("data-fmsg-scheme", "done");

    function make(cls, src) {
      var el = document.createElement("img");
      el.className = cls;
      el.setAttribute("src", src);
      el.setAttribute("alt", alt);
      el.setAttribute("loading", img.getAttribute("loading") || "lazy");
      return el;
    }

    wrap.appendChild(make("fmsg-for-light", pair.forLightPage));
    wrap.appendChild(
      make("fmsg-for-dark", pair.forDarkPage || pair.forLightPage)
    );

    if (picture.parentNode) {
      picture.parentNode.replaceChild(wrap, picture);
    }
  }

  function apply() {
    var pictures = document.querySelectorAll(".md-typeset picture");
    for (var i = 0; i < pictures.length; i++) {
      rewritePicture(pictures[i]);
    }
  }

  function watch() {
    apply();
    if (typeof MutationObserver === "undefined") return;
    var obs = new MutationObserver(function () {
      apply();
    });
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-md-color-scheme"],
      childList: true,
      subtree: true,
    });
  }

  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(watch);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }
})();
