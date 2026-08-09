/**
 * Show the diagram asset that matches Material's active palette.
 *
 * After markdown fix-up, <source media="(prefers-color-scheme: …)"> points at
 * the asset meant for that *page* theme:
 *   light page → dark-ink art (readable on white)
 *   dark page  → light-ink art (readable on near-black)
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
    var namedDarkInk = null;
    var namedLightInk = null;
    var i;

    for (i = 0; i < sources.length; i++) {
      var media = (sources[i].getAttribute("media") || "").toLowerCase().replace(/\s+/g, "");
      var src = firstUrl(sources[i].getAttribute("srcset"));
      if (!src) continue;
      var file = src.split("/").pop().toLowerCase();

      if (media.indexOf("prefers-color-scheme:dark") !== -1) mediaDark = src;
      else if (media.indexOf("prefers-color-scheme:light") !== -1) mediaLight = src;

      // Filename heuristics (ink colour), skipping ambiguous setup-example-light.png
      if (file.indexOf("dark") !== -1) namedDarkInk = src;
      if (file.indexOf("light") !== -1 && file.indexOf("transparent") !== -1) {
        namedLightInk = src;
      } else if (
        file.indexOf("light") !== -1 &&
        file.indexOf("setup-example-light.png") === -1
      ) {
        namedLightInk = src;
      }
    }

    // Media tags are authoritative once markdown is correct.
    var forLightPage =
      mediaLight || namedDarkInk || (img && img.getAttribute("src"));
    var forDarkPage = mediaDark || namedLightInk || forLightPage;

    return { forLightPage: forLightPage, forDarkPage: forDarkPage };
  }

  function rewritePicture(picture) {
    if (picture.getAttribute("data-fmsg-scheme") === "done") return;
    // Already rewritten wrapper
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
    var obs = new MutationObserver(function (mutations) {
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (
          mutations[i].type === "attributes" &&
          mutations[i].attributeName === "data-md-color-scheme"
        ) {
          // CSS handles visibility; nothing else required.
          continue;
        }
      }
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
