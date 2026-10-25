import { setupPhotoSwipe } from "./lightbox";
import { setupMarkdownImageLayout } from "./markdown-images";
import "overlayscrollbars/overlayscrollbars.css";
import { OverlayScrollbars } from "overlayscrollbars";
import { siteConfig } from "../config";
import {
	BANNER_HEIGHT_EXTEND,
	BANNER_HEIGHT_HOME,
	MAIN_PANEL_OVERLAPS_BANNER_HEIGHT,
} from "../constants/constants";
import {
	getHue,
	getStoredTheme,
	setHue,
	setTheme,
} from "../utils/setting-utils";

const bannerEnabled = !!document.getElementById("banner-wrapper");

function setClickOutsideToClose(panel: string, ignores: string[]) {
	document.addEventListener("click", (event) => {
		const panelDom = document.getElementById(panel);
		const tDom = event.target;
		if (!(tDom instanceof Node)) return; // Ensure the event target is an HTML Node
		for (const ig of ignores) {
			const ie = document.getElementById(ig);
			if (ie === tDom || ie?.contains(tDom)) {
				return;
			}
		}
		panelDom?.classList.add("float-panel-closed");
	});
}
setClickOutsideToClose("display-setting", [
	"display-setting",
	"display-settings-switch",
]);
setClickOutsideToClose("nav-menu-panel", ["nav-menu-panel", "nav-menu-switch"]);
setClickOutsideToClose("search-panel", [
	"search-panel",
	"search-bar",
	"search-switch",
]);

function loadTheme() {
	const theme = getStoredTheme();
	setTheme(theme);
}

function loadHue() {
	setHue(getHue());
}

function initCustomScrollbar() {
	const bodyElement = document.querySelector("body");
	if (!bodyElement) return;
	OverlayScrollbars(
		// docs say that a initialization to the body element would affect native functionality like window.scrollTo
		// but just leave it here for now
		{
			target: bodyElement,
			cancel: {
				nativeScrollbarsOverlaid: true, // don't initialize the overlay scrollbar if there is a native one
			},
		},
		{
			scrollbars: {
				theme: "scrollbar-base scrollbar-auto py-1",
				autoHide: "move",
				autoHideDelay: 500,
				autoHideSuspend: false,
			},
		},
	);

	const katexElements = document.querySelectorAll(
		".katex-display",
	) as NodeListOf<HTMLElement>;

	const katexObserverOptions = {
		root: null,
		rootMargin: "100px",
		threshold: 0.1,
	};

	const processKatexElement = (element: HTMLElement) => {
		if (!element.parentNode) return;
		if (element.hasAttribute("data-scrollbar-initialized")) return;

		const container = document.createElement("div");
		container.className = "katex-display-container";
		container.setAttribute("aria-label", "scrollable container for formulas");

		element.parentNode.insertBefore(container, element);
		container.appendChild(element);

		OverlayScrollbars(container, {
			scrollbars: {
				theme: "scrollbar-base scrollbar-auto",
				autoHide: "leave",
				autoHideDelay: 500,
				autoHideSuspend: false,
			},
		});

		element.setAttribute("data-scrollbar-initialized", "true");
	};

	const katexObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				processKatexElement(entry.target as HTMLElement);
				observer.unobserve(entry.target);
			}
		});
	}, katexObserverOptions);

	katexElements.forEach((element) => {
		katexObserver.observe(element);
	});
}

function showBanner() {
	if (!siteConfig.banner.enable) return;

	const banner = document.getElementById("banner");
	if (!banner) {
		console.error("Banner element not found");
		return;
	}

	banner.classList.remove("opacity-0", "scale-105");
}

function init() {
	loadTheme();
	loadHue();
	initCustomScrollbar();
	showBanner();
}

/* Load settings when entering the site */
init();

let swupHooksRegistered = false;

function setupSwup() {
	if (swupHooksRegistered || !window.swup?.hooks) return;
	swupHooksRegistered = true;
	setupPhotoSwipe();
	setupMarkdownImageLayout(window.swup);

	window.swup.hooks.on("link:click", () => {
		// Remove the delay for the first time page load.
		document.documentElement.style.setProperty("--content-delay", "0ms");
		scrollFunction();
	});

	window.swup.hooks.on("content:replace", initCustomScrollbar);
	window.swup.hooks.on("visit:start", () => {
		// Keep enough document height for Swup's scroll restoration.
		document.getElementById("page-height-extend")?.classList.remove("hidden");
		document.getElementById("toc-wrapper")?.classList.add("toc-not-ready");
	});

	window.swup.hooks.on("visit:end", () => {
		document.getElementById("page-height-extend")?.classList.add("hidden");
		document.getElementById("toc-wrapper")?.classList.remove("toc-not-ready");
		scrollFunction();
	});
}

if (window.swup?.hooks) {
	setupSwup();
} else {
	const swupWait = window.setInterval(() => {
		if (window.swup?.hooks) {
			window.clearInterval(swupWait);
			setupSwup();
		}
	}, 50);
}

const backToTopBtn = document.getElementById("back-to-top-btn");
const navbar = document.getElementById("navbar-wrapper");
function scrollFunction() {
	const scrollTop = Math.max(
		window.scrollY,
		document.body.scrollTop,
		document.documentElement.scrollTop,
	);
	const bannerHeight = window.innerHeight * (BANNER_HEIGHT_HOME / 100);
	const toc = document.getElementById("toc-wrapper");

	if (backToTopBtn) {
		if (scrollTop > bannerHeight) {
			backToTopBtn.classList.remove("hide");
		} else {
			backToTopBtn.classList.add("hide");
		}
	}

	if (bannerEnabled && toc && !toc.hasAttribute("data-sidebar-toc")) {
		if (scrollTop > bannerHeight) {
			toc.classList.remove("toc-hide");
		} else {
			toc.classList.add("toc-hide");
		}
	}

	if (!bannerEnabled) return;
	if (navbar) {
		const NAVBAR_HEIGHT = 72;
		const MAIN_PANEL_EXCESS_HEIGHT = MAIN_PANEL_OVERLAPS_BANNER_HEIGHT * 16; // The height the main panel overlaps the banner
		const threshold =
			bannerHeight - NAVBAR_HEIGHT - MAIN_PANEL_EXCESS_HEIGHT - 16;
		if (scrollTop >= threshold) {
			navbar.classList.add("navbar-hidden");
		} else {
			navbar.classList.remove("navbar-hidden");
		}
	}
}
window.onscroll = scrollFunction;

window.onresize = () => {
	// calculate the --banner-height-extend, which needs to be a multiple of 4 to avoid blurry text
	let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
	offset = offset - (offset % 4);
	document.documentElement.style.setProperty(
		"--banner-height-extend",
		`${offset}px`,
	);
};
