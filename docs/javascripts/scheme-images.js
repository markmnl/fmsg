/**
 * Prefer light/dark diagram assets from Material's color scheme toggle.
 *
 * Canonical docs keep <picture><source media="(prefers-color-scheme:…)">
 * for GitHub rendering. On the site, Material's palette can disagree with the
 * OS preference, so we set the <img> src from the matching source whenever
 * data-md-color-scheme changes.
 */
(function () {
  function isDarkScheme() {
    return document.body.getAttribute("data-md-color-scheme") === "slate";
  }

  function pickSrc(picture, dark) {
    var sources = picture.querySelectorAll("source[srcset]");
    var light = null;
    var darkSrc = null;
    var i;
    for (i = 0; i < sources.length; i++) {
      var media = sources[i].getAttribute("media") || "";
      var srcset = sources[i].getAttribute("srcset");
      if (!srcset) continue;
      // first URL token in srcset
      var src = srcset.trim().split(/\s+/)[0];
      if (media.indexOf("dark") !== -1) darkSrc = src;
      else if (media.indexOf("light") !== -1) light = src;
    }
    if (dark && darkSrc) return darkSrc;
    if (!dark && light) return light;
    if (darkSrc || light) return dark ? darkSrc || light : light || darkSrc;
    return null;
  }

  function applySchemeImages() {
    var dark = isDarkScheme();
    var pictures = document.querySelectorAll(".md-typeset picture");
    for (var i = 0; i < pictures.length; i++) {
      var picture = pictures[i];
      var img = picture.querySelector("img");
      if (!img) continue;
      var next = pickSrc(picture, dark);
      if (next && img.getAttribute("src") !== next) {
        img.setAttribute("src", next);
      }
    }
  }

  function watchScheme() {
    applySchemeImages();
    if (typeof MutationObserver === "undefined") return;
    var observer = new MutationObserver(applySchemeImages);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-md-color-scheme"],
    });
  }

  // Material emits document$ on instant navigation; fall back to DOM ready.
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(watchScheme);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchScheme);
  } else {
    watchScheme();
  }
})();
