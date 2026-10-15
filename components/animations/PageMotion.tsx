"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function PageMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-enter]", {
          y: 48,
          opacity: 0,
          duration: 1,
          stagger: 0.12,
          ease: "power3.out",
          clearProps: "all",
        });
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 42,
            opacity: 0,
            duration: 0.85,
            ease: "power3.out",
            clearProps: "all",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: -4 },
            {
              yPercent: 4,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });
      });
      return () => context.revert();
    });
    return () => media.revert();
  }, [pathname]);
  return null;
}
