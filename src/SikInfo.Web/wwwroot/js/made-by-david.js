/*!
 * <made-by-david> — a one-tag maker's credit.
 *
 * Drop this file on any site and add one tag:
 *
 *     <script src="/js/made-by-david.js" defer></script>
 *     <made-by-david></made-by-david>
 *
 * ...or skip the tag entirely and let the script mount itself:
 *
 *     <script src="/js/made-by-david.js" data-mount="footer .container" defer></script>
 *
 * It renders in a shadow root, so no stylesheet on the host page can reach it
 * and it can reach nothing on the host page: the same mark looks the same on
 * every site. The one thing it DOES inherit is `color` — the mark is painted
 * with currentColor, so it takes on the surrounding text colour and follows a
 * site's light/dark theme for free.
 *
 * The diamond turns exactly as it does on davidasenov.com: `spin 70s linear
 * infinite` — one revolution per 70 seconds, slow enough to notice only if you
 * watch. Stops for anyone who asked for reduced motion.
 *
 * Attributes (all optional):
 *   label   text before the mark            default "made by"
 *   href    where the credit points         default https://davidasenov.com/
 *   size    logo height, any CSS length     default 1.6rem
 *
 * CSS custom properties, set on the element or any ancestor:
 *   --mbd-size            logo height (same as the size attribute)
 *   --mbd-gap             space between label and mark      default .4rem
 *   --mbd-font-size       label size                        default .72rem
 *   --mbd-opacity         resting opacity                   default .55
 *   --mbd-opacity-hover   hover/focus opacity               default 1
 *   --mbd-spin            one revolution                    default 70s
 *   --mbd-mark-stroke     mark stroke, user units           default 110
 *   --mbd-diamond-stroke  diamond stroke, user units        default 420
 *
 * The stroke defaults are the only deliberate departure from davidasenov.com,
 * where the diamond is 170: that is a hairline at a 150px logo and a sub-pixel
 * ghost at footer size. 420 keeps the same apparent weight when the mark is
 * small. Rendering it big? Set --mbd-diamond-stroke: 170 and get the original.
 */
(function () {
    "use strict";

    var VIEW_BOX = "4000 5300 15500 12000";
    var DIAMOND =
        '<g class="diamond-wrap">' +
        '<rect class="diamond" transform="matrix(0.861036 0.85967 -0.85967 0.861037 10974 6641.35)"' +
        ' width="5750.29" height="5750.29"></rect>' +
        "</g>";
    var MARK =
        '<path class="mark" d="M17854.39 13545.85c-21.04,824.86 -56.78,1095.97 -1141.85,1122.75 -118.4,2.89 -2344.86,' +
        "-9.72 -2714.21,-7.78 -144.45,0.76 -578.1,-0.87 -633.65,0l515.13 1213.99 -1351.04 0.02 -523.64 -1233.98 " +
        "-2078.77 9.41 -515.06 1224.57 -1338.68 0 2901.34 -6847.88 1917.22 4518.07c323.81,-3.36 1640.75,6.06 " +
        "1964.39,0.83 1932.35,-31.29 1856.97,187.2 1856.97,-1702.14 0,-477.4 0,-4055.83 0,-5654.74 0,-452.58 " +
        "-410.87,-684.55 -636.15,-684.55 -497.25,0 -1692.3,-9.84 -2320.87,-10.23 -727.93,0 -1455.89,0.02 " +
        "-2183.82,0.02l0 1147.14 -1195.5 0 0 -1147.14 0 -1154.29c1423.47,13.92 2875.41,0 4295.65,0 441.77,0 " +
        "1664.6,-23.43 2040.69,0 736.29,45.88 1141.85,405.51 1141.85,1164.5 0,1012.79 0,7765.97 0,8041.43zm" +
        '-6880.43 -1415.59l-574.78 1399.62 1138.15 8.53 -563.37 -1408.15z"></path>';

    var STYLE = [
        /* The host is inline so it can sit at the end of a line of text. */
        ":host { display: inline-block; line-height: 1; }",
        ":host([hidden]) { display: none; }",
        /* nowrap is the point: the label and the mark are one unbreakable unit,",
           so a narrow footer never splits "made" from "by". */
        "a {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  gap: var(--mbd-gap, .4rem);",
        "  white-space: nowrap;",
        "  color: inherit;",
        "  font: inherit;",
        "  font-size: var(--mbd-font-size, .72rem);",
        "  text-decoration: none;",
        "  opacity: var(--mbd-opacity, .55);",
        "  transition: opacity .18s ease;",
        "}",
        "a:hover, a:focus-visible { opacity: var(--mbd-opacity-hover, 1); }",
        "svg {",
        "  height: var(--mbd-size, 1.6rem);",
        "  width: auto;",
        "  display: block;",
        "  overflow: visible;",
        "}",
        /* Exactly davidasenov.com: both shapes painted with currentColor. */
        ".mark {",
        "  fill: currentColor;",
        "  stroke: currentColor;",
        "  stroke-width: var(--mbd-mark-stroke, 110);",
        "  stroke-linejoin: round;",
        "}",
        ".diamond {",
        "  fill: none;",
        "  stroke: currentColor;",
        "  stroke-width: var(--mbd-diamond-stroke, 420);",
        "  stroke-linejoin: round;",
        "}",
        /* The turn, exactly as on davidasenov.com: one revolution per 70s. */
        ".diamond-wrap {",
        "  transform-box: fill-box;",
        "  transform-origin: center;",
        "  animation: mbd-spin var(--mbd-spin, 70s) linear infinite;",
        "}",
        "@keyframes mbd-spin { to { transform: rotate(360deg); } }",
        "@media (prefers-reduced-motion: reduce) { .diamond-wrap { animation: none; } }"
    ].join("\n");

    var MadeByDavid = function () {};

    if (typeof window === "undefined" || !window.customElements || !document.createElement("div").attachShadow) {
        return; // Ancient browser: no credit rather than a broken one.
    }

    MadeByDavid = class extends HTMLElement {
        static get observedAttributes() { return ["label", "href", "size"]; }

        connectedCallback() {
            if (!this.shadowRoot) this.attachShadow({ mode: "open" });
            this.render();
        }

        attributeChangedCallback() {
            if (this.shadowRoot) this.render();
        }

        render() {
            var label = this.getAttribute("label");
            if (label === null) label = "made by";
            var href = this.getAttribute("href") || "https://davidasenov.com/";
            var size = this.getAttribute("size");

            var name = "David Asenov";
            var accessibleName = label ? label + " " + name : name;

            this.shadowRoot.innerHTML =
                "<style>" + STYLE + "</style>" +
                '<a part="link" href="' + escapeAttr(href) + '" target="_blank" rel="noopener noreferrer"' +
                ' aria-label="' + escapeAttr(accessibleName) + '" title="' + escapeAttr(name) + '"' +
                (size ? ' style="--mbd-size:' + escapeAttr(size) + '"' : "") + ">" +
                (label ? "<span part=\"label\">" + escapeText(label) + "</span>" : "") +
                '<svg part="logo" viewBox="' + VIEW_BOX + '" role="img" aria-hidden="true" focusable="false"' +
                ' xmlns="http://www.w3.org/2000/svg">' + DIAMOND + MARK + "</svg>" +
                "</a>";
        }
    };

    function escapeAttr(value) {
        return String(value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    var escapeText = escapeAttr;

    if (!window.customElements.get("made-by-david")) {
        window.customElements.define("made-by-david", MadeByDavid);
    }

    // Optional self-mounting: <script ... data-mount="footer .container">
    var self = document.currentScript;
    if (self && self.dataset && self.dataset.mount) {
        var mount = function () {
            var host = document.querySelector(self.dataset.mount);
            if (!host || host.querySelector("made-by-david")) return;
            host.appendChild(document.createElement("made-by-david"));
        };
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", mount);
        } else {
            mount();
        }
    }
})();
