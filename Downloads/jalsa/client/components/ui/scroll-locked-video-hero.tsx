"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface MetroHeroProps {
  videoSrc?: string;
  poster?: string;
  title?: ReactNode;
  scrollHint?: string | false;
  tagline?: string;
  signature?: { name: string; url: string } | false;
  scrubDistance?: number;
  loopPlayback?: boolean;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_VIDEO = "https://cdn.21st.dev/assets/mirror/21/21a77eac28eacbb7e142016eefeaa0b4a766619e51113629a3bc6df6af066c0f.mp4";
const DEFAULT_POSTER = "https://images.unsplash.com/photo-1494253188410-ff0cdea5499e?auto=format&fit=crop&w=1740&q=80";
const DEFAULT_SIGNATURE = { name: "Pinterest film", url: "https://www.pinterest.com/pin/804807395952195353/" };
const BODY_LOCK_PROPERTIES = ["position", "top", "left", "right", "width", "height", "overflow", "overscrollBehavior"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function MetroHero({
  videoSrc = DEFAULT_VIDEO,
  poster = DEFAULT_POSTER,
  title = "JALSA - know your area",
  scrollHint = "SCROLL TO REVEAL",
  tagline = "The city's rhythm, one zone at a time.",
  signature = DEFAULT_SIGNATURE,
  scrubDistance = 3200,
  loopPlayback = false,
  className = "",
  style,
}: MetroHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(loopPlayback);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    if (loopPlayback) {
      const markReady = () => setReady(true);
      video.addEventListener("loadeddata", markReady);
      video.addEventListener("canplay", markReady);
      video.addEventListener("playing", markReady);
      video.addEventListener("error", markReady);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markReady();
      void video.play().then(markReady).catch(markReady);
      return () => {
        video.removeEventListener("loadeddata", markReady);
        video.removeEventListener("canplay", markReady);
        video.removeEventListener("playing", markReady);
        video.removeEventListener("error", markReady);
      };
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let duration = video.duration || 0;
    let rafId = 0;
    let targetProgress = reduceMotion ? 1 : 0;
    let currentProgress = targetProgress;
    let isSeeking = false;
    let pendingTime: number | null = null;
    let locked = false;
    let lockedScrollY = 0;
    let sectionTop = 0;
    let sectionBottom = 0;
    let hasCompleted = false;
    let previousScrollY = window.scrollY;
    let savedBodyStyles: Record<string, string> = {};
    let touchStartY = 0;

    const handleLoadedData = () => {
      duration = video.duration || 0;
      setReady(true);
      if (reduceMotion && duration > 0) video.currentTime = duration * 0.92;
    };
    const handleVideoError = () => setReady(true);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleVideoError);

    const kickstartLoad = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(() => video.pause()).catch(() => {});
      } else {
        video.pause();
      }
    };
    kickstartLoad();

    const handleSeeked = () => {
      isSeeking = false;
      if (pendingTime !== null) {
        const nextTime = pendingTime;
        pendingTime = null;
        isSeeking = true;
        video.currentTime = nextTime;
      }
    };
    video.addEventListener("seeked", handleSeeked);

    const seekTo = (time: number) => {
      if (!duration || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
      if (isSeeking) {
        pendingTime = time;
        return;
      }
      isSeeking = true;
      video.currentTime = time;
    };

    const measureSection = () => {
      const rect = section.getBoundingClientRect();
      sectionTop = window.scrollY + rect.top;
      sectionBottom = sectionTop + section.offsetHeight;
    };
    measureSection();

    const restoreBody = () => {
      const bodyStyle = document.body.style;
      for (const property of BODY_LOCK_PROPERTIES) {
        bodyStyle[property] = savedBodyStyles[property] ?? "";
      }
    };

    const engageLock = (progress: number) => {
      if (locked || reduceMotion) return;
      measureSection();
      lockedScrollY = Math.max(0, sectionTop);
      targetProgress = progress;
      currentProgress = progress;
      locked = true;
      const bodyStyle = document.body.style;
      savedBodyStyles = Object.fromEntries(BODY_LOCK_PROPERTIES.map((property) => [property, bodyStyle[property]]));
      bodyStyle.position = "fixed";
      bodyStyle.top = `-${lockedScrollY}px`;
      bodyStyle.left = "0";
      bodyStyle.right = "0";
      bodyStyle.width = "100%";
      bodyStyle.height = "100%";
      bodyStyle.overflow = "hidden";
      bodyStyle.overscrollBehavior = "none";
      window.scrollTo(0, lockedScrollY);
    };

    const releaseLock = (nextScrollY: number) => {
      if (!locked) return;
      locked = false;
      hasCompleted = nextScrollY >= sectionBottom;
      restoreBody();
      window.scrollTo(0, Math.max(0, nextScrollY));
    };

    const addDelta = (deltaY: number) => {
      targetProgress = clamp(targetProgress + deltaY / Math.max(scrubDistance, 1), 0, 1);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!locked) {
        measureSection();
        const currentY = window.scrollY;
        const crossesSection = event.deltaY > 0 && !hasCompleted && currentY < sectionTop && currentY + event.deltaY >= sectionTop;
        const reentersSection = event.deltaY < 0 && hasCompleted && currentY > sectionTop && currentY + event.deltaY <= sectionTop;
        if (crossesSection || reentersSection) {
          event.preventDefault();
          engageLock(hasCompleted ? 1 : 0);
        }
        return;
      }
      event.preventDefault();
      if (targetProgress >= 1 && event.deltaY > 0) {
        releaseLock(sectionBottom + Math.min(event.deltaY, 180));
        return;
      }
      if (targetProgress <= 0 && event.deltaY < 0) {
        releaseLock(sectionTop - Math.min(Math.abs(event.deltaY), 180));
        return;
      }
      addDelta(event.deltaY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!locked) return;
      const nextY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = touchStartY - nextY;
      touchStartY = nextY;
      if (!locked) {
        measureSection();
        const currentY = window.scrollY;
        const crossesSection = deltaY > 0 && !hasCompleted && currentY < sectionTop && currentY + deltaY >= sectionTop;
        const reentersSection = deltaY < 0 && hasCompleted && currentY > sectionTop && currentY + deltaY <= sectionTop;
        if (crossesSection || reentersSection) {
          event.preventDefault();
          engageLock(hasCompleted ? 1 : 0);
        }
        return;
      }
      event.preventDefault();
      if (targetProgress >= 1 && deltaY > 0) {
        releaseLock(sectionBottom + Math.min(deltaY, 100));
        return;
      }
      addDelta(deltaY);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!locked) return;
      const direction = event.key === "ArrowDown" || event.key === "PageDown" || event.key === " "
        ? 1
        : event.key === "ArrowUp" || event.key === "PageUp"
          ? -1
          : 0;
      if (!direction) return;
      event.preventDefault();
      if (targetProgress >= 1 && direction > 0) {
        releaseLock(sectionBottom + 100);
        return;
      }
      if (targetProgress <= 0 && direction < 0) {
        releaseLock(sectionTop - 100);
        return;
      }
      addDelta(direction * (event.key.startsWith("Page") ? 360 : 100));
    };

    const handleScroll = () => {
      const currentY = window.scrollY;
      if (!locked && !reduceMotion) {
        measureSection();
        const entering = !hasCompleted && currentY >= sectionTop && currentY < sectionBottom;
        const returning = hasCompleted && previousScrollY > sectionTop && currentY <= sectionTop;
        if (entering || returning) engageLock(hasCompleted ? 1 : 0);
      }
      previousScrollY = window.scrollY;
    };

    if (!reduceMotion && sectionTop <= window.scrollY + 1) engageLock(0);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const frame = () => {
      currentProgress += (targetProgress - currentProgress) * 0.18;
      if (Math.abs(targetProgress - currentProgress) < 0.0005) currentProgress = targetProgress;
      seekTo(currentProgress * duration);

      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${1 + currentProgress * 0.06})`;
      }
      if (titleRef.current) {
        const opacity = 1 - clamp(currentProgress / 0.35, 0, 1);
        titleRef.current.style.opacity = String(opacity);
        titleRef.current.style.transform = `translateY(${(1 - opacity) * -24}px) scale(${0.96 + opacity * 0.04})`;
        titleRef.current.style.filter = `blur(${(1 - opacity) * 10}px)`;
      }
      if (hintRef.current) hintRef.current.style.opacity = targetProgress > 0.001 ? "0" : "1";
      if (taglineRef.current) {
        const opacity = clamp((currentProgress - 0.82) / 0.18, 0, 1);
        taglineRef.current.style.opacity = String(opacity);
        taglineRef.current.style.transform = `translateY(${(1 - opacity) * 20}px)`;
        taglineRef.current.style.filter = `blur(${(1 - opacity) * 8}px)`;
      }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${currentProgress})`;
      rafId = requestAnimationFrame(frame);
    };

    if (!reduceMotion) rafId = requestAnimationFrame(frame);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("seeked", handleSeeked);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
      if (locked) {
        restoreBody();
        window.scrollTo(0, lockedScrollY);
      }
    };
  }, [scrubDistance]);

  return (
    <section
      ref={sectionRef}
      className={`scroll-locked-hero ${className}`.trim()}
      style={{ backgroundColor: "#05070d", ...style }}
      aria-label="JALSA crowd-intelligence introduction"
    >
      <video
        ref={videoRef}
        className="scroll-locked-hero__video"
        src={videoSrc}
        poster={loopPlayback ? undefined : poster}
        autoPlay={loopPlayback}
        loop={loopPlayback}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ opacity: ready ? 1 : 0 }}
      />
      <div className="scroll-locked-hero__shade" aria-hidden="true" />

      <div ref={titleRef} className="scroll-locked-hero__title-wrap">
        <h1>{title}</h1>
      </div>

      {tagline && <div ref={taglineRef} className="scroll-locked-hero__tagline">{tagline}</div>}

      {scrollHint && (
        <div ref={hintRef} className="scroll-locked-hero__hint" aria-hidden="true">
          <span>{scrollHint}</span>
          <svg width="14" height="18" viewBox="0 0 14 18">
            <path d="M7 1 L7 17 M2 12 L7 17 L12 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="scroll-locked-hero__progress" aria-hidden="true">
        <div ref={progressRef} />
      </div>

      {signature && (
        <span className="scroll-locked-hero__signature">
          Film source: <a href={signature.url} target="_blank" rel="noopener noreferrer">{signature.name}</a>
        </span>
      )}
    </section>
  );
}
