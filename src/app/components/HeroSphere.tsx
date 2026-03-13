import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  SplitText,
  TextShimmer,
  ease,
} from "./motion-utils";
import { useSmoothScroll } from "./SmoothScroll";
import { scrollToSection } from "./scroll-utils";
import { ChevronDown } from "lucide-react";

const easeOut = ease.out as unknown as number[];

/**
 * Hero Variant D — izum.study–style layout.
 *
 * 300vh phantom-scroll wrapper. Sticky viewport.
 * Large headline pinned to bottom-left.
 * Description + CTA pinned to bottom-right.
 * [Scroll] indicator at bottom-center.
 */
export const HeroSphere = ({ ready = true }: { ready?: boolean }) => {
  const smoothScroll = useSmoothScroll();
  const trackRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end start"],
  });

  // Content: visible from start, fades out when leaving hero
  const contentOpacity = useTransform(scrollYProgress, [0, 0.05, 0.7, 0.88], [1, 1, 1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.7, 0.9], [0, 0, -80]);

  // Scroll indicator: visible only at start
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0.1, 0.25], [1, 0]);

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    scrollToSection(href, smoothScroll);
  };

  const show = (v: Record<string, unknown>) => (ready ? v : undefined);

  return (
    <section
      ref={trackRef}
      id="hero-sphere-track"
      className="relative bg-[#050a09]"
      style={{ height: "300vh" }}
    >
      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen overflow-hidden z-[20]">
        {/* Bottom gradient for text readability */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "linear-gradient(to top, rgba(5,10,9,0.92) 0%, rgba(5,10,9,0.6) 20%, rgba(5,10,9,0.2) 40%, transparent 60%)",
          }}
        />

        {/* Content — full viewport, items at bottom */}
        <motion.div
          className="relative z-[2] w-full h-screen px-6 sm:px-10 lg:px-16 pb-10 sm:pb-14 flex flex-col justify-end"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          {/* Bottom row: headline left, description+CTA right */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-12">
            {/* ── Left: Headline ── */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={show({ opacity: 1, y: 0 })}
              transition={{ duration: 1.0, delay: 0.1, ease: easeOut }}
              className="flex-shrink-0 max-w-[720px]"
            >
              {/* Eyebrow pill */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={show({ opacity: 1, y: 0 })}
                transition={{ duration: 0.7, ease: easeOut }}
                className="mb-5"
              >
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/[0.12] bg-[#050a09]/80 backdrop-blur-md text-[13px] text-white/60 uppercase tracking-[0.08em] shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A84F] animate-pulse" />
                  Речевая аналитика
                </span>
              </motion.div>

              <h1 className="m-0" style={{ 
                filter: 'drop-shadow(0 4px 12px rgba(5,10,9,0.9)) drop-shadow(0 2px 4px rgba(5,10,9,0.95))',
              }}>
                {ready ? (
                  <TextShimmer>
                    <span className="text-[clamp(2.8rem,7vw,6.5rem)] tracking-[-0.04em] leading-[0.85] block">
                      <SplitText
                        delay={0.15}
                        staggerDelay={0.05}
                        immediate
                        wordClassName="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/95 to-white/60"
                      >
                        Каждый
                      </SplitText>
                      <br />
                      <SplitText
                        delay={0.25}
                        staggerDelay={0.05}
                        immediate
                        wordClassName="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/95 to-white/60"
                      >
                        диалог под
                      </SplitText>
                      <br />
                      <SplitText
                        delay={0.4}
                        staggerDelay={0.05}
                        immediate
                        wordClassName="bg-clip-text text-transparent bg-gradient-to-r from-[#00A84F] via-[#34D27B] to-[#34D2B4]"
                      >
                        контролем
                      </SplitText>
                    </span>
                  </TextShimmer>
                ) : (
                  <span className="text-[clamp(2.8rem,7vw,6.5rem)] tracking-[-0.04em] leading-[0.85] opacity-0 block">
                    Каждый диалог под контролем
                  </span>
                )}
              </h1>
            </motion.div>

            {/* ── Right: Description + CTA ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={show({ opacity: 1, y: 0 })}
              transition={{ duration: 1.0, delay: 0.5, ease: easeOut }}
              className="flex flex-col items-start lg:items-end gap-6 lg:max-w-[340px] lg:text-right pb-1"
            >
              <p 
                className="text-[14px] sm:text-[15px] text-white/60 leading-relaxed m-0 uppercase tracking-[0.04em]"
                style={{
                  filter: 'drop-shadow(0 4px 12px rgba(5,10,9,0.9)) drop-shadow(0 2px 4px rgba(5,10,9,0.95))',
                }}
              >
                Анализируем разговоры продавцов
                в&nbsp;реальном времени, находим
                потерянные сделки и&nbsp;точки
                роста&nbsp;выручки
              </p>

              <motion.a
                href="#form"
                onClick={(e) => handleClick(e, "#form")}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full border border-white/[0.2] bg-[#050a09]/70 hover:bg-[#00A84F] text-[15px] text-white/90 hover:text-white tracking-[-0.01em] transition-all duration-300 hover:shadow-[0_0_50px_rgba(0,168,79,0.35)] backdrop-blur-md shadow-lg"
              >
                Получить демо
              </motion.a>
            </motion.div>
          </div>

          {/* ── Bottom bar: scroll + stats ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={show({ opacity: 1 })}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]"
          >
            {/* Scroll indicator */}
            <motion.div
              className="flex items-center gap-2"
              style={{ opacity: scrollIndicatorOpacity }}
            >
              <span className="text-[12px] text-white/30 uppercase tracking-[0.15em]">
                [scroll]
              </span>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-3.5 h-3.5 text-white/20" />
              </motion.div>
            </motion.div>

            {/* Compact stats */}
            <div className="hidden sm:flex items-center gap-6 lg:gap-8">
              {[
                { value: "+34%", label: "конверсия" },
                { value: "2 дня", label: "до инсайтов" },
                { value: "100%", label: "контроль" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[14px] tracking-[-0.02em] bg-clip-text text-transparent bg-gradient-to-r from-[#00A84F] to-[#34D27B]">
                    {s.value}
                  </span>
                  <span className="text-[11px] text-white/30 uppercase tracking-[0.08em]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};