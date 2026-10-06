"use client";

import { track } from "@vercel/analytics";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoTile } from "@/components/Logo";

/** Remembers a dismissal as a timestamp, so we can ask again later. */
const DISMISSED_KEY = "cciw-install-dismissed";
const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** A visitor who stays this long without changing page still counts as engaged. */
const ENGAGED_AFTER_MS = 20_000;
/** Pause after the second page view, so the card never lands mid-tap. */
const SECOND_VIEW_DELAY_MS = 1_500;

/** Chromium's install hook. It isn't in lib.dom.d.ts. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISSED_KEY));
    return at > 0 && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Private browsing can throw. The card just stays dismissed for this visit.
  }
}

/** Safari on iPhone or iPad. Other iOS browsers have a different share menu, so they're left out. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, but only the iPad has a touch screen.
  const iPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPad;
  return ios && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
}

function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Not installed yet, not recently turned down, and on a phone or tablet. */
function shouldOffer(): boolean {
  return !isInstalled() && !wasDismissedRecently() && isTouchDevice();
}

/**
 * A dismissible card inviting visitors to add the site to their home screen.
 * Android and Chromium browsers get a real Install button; iOS Safari has no
 * install API, so it gets the "Share, then Add to Home Screen" steps. It stays
 * hidden once installed, after a dismissal, and until the visitor is engaged.
 * Desktop browsers show their own install icon in the address bar, so skip it.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [engaged, setEngaged] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const views = useRef(0);

  // Capture the browser's install event, and treat time on site as engagement.
  useEffect(() => {
    if (!shouldOffer()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => setEngaged(true), ENGAGED_AFTER_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  // A second page view also counts as engaged.
  useEffect(() => {
    views.current += 1;
    if (views.current < 2) return;
    const timer = window.setTimeout(() => setEngaged(true), SECOND_VIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // `engaged` only flips after mount, so reading the browser here can't mismatch the server render.
  const mode = !engaged || dismissed || !shouldOffer() ? null : installEvent ? "native" : isIosSafari() ? "ios" : null;
  const shown = mode !== null;

  useEffect(() => {
    if (shown) track("install_prompt_shown", { mode });
  }, [shown, mode]);

  if (mode === null) return null;

  const dismiss = () => {
    rememberDismissal();
    setDismissed(true);
    track("install_prompt_dismissed", { mode });
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    track(outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_declined", { mode });
    // The browser only lets the event be used once, win or lose.
    setInstallEvent(null);
    if (outcome === "dismissed") rememberDismissal();
  };

  return (
    <section
      aria-label="Install the app"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-start gap-3 rounded-card border border-line bg-surface-raised p-3 shadow-lg md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
    >
      <LogoTile className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Add CCIW Soccer to your home screen</p>
        {mode === "native" ? (
          <>
            <p className="mt-0.5 text-xs text-ink-muted">One tap to live scores and standings, full screen like an app.</p>
            <button
              type="button"
              onClick={install}
              className="mt-2 rounded-control bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover"
            >
              Install
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-ink-muted">
            Tap{" "}
            <svg
              viewBox="0 0 24 24"
              className="-mt-0.5 inline size-4 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
              aria-label="Share"
            >
              <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
              <path d="M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1" />
            </svg>{" "}
            then <span className="font-semibold text-ink">Add to Home Screen</span>.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </section>
  );
}
