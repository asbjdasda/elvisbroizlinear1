import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function usePortfolioMotion() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return undefined

    const heroTargets = ['.hero__copy h1', '.hero__cta-block', '.hero__join-glow', '.hero__brand-marquee']
    let intro
    const ctx = gsap.context(() => {
      intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
      intro
        .from('.hero__frame', {
          clipPath: 'inset(12% 10% 12% 10% round 30px)',
          scale: 0.965,
          duration: 1.45,
        })
        .fromTo(
          '.hero__video',
          { scale: 1.03, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.65 },
          '<',
        )
        .addLabel('textEntry', 0.78)
        .fromTo('.hero__video', { filter: 'brightness(1)' },
          { filter: 'brightness(0.8)', duration: 1.1, ease: 'power1.inOut' }, 'textEntry')
        .fromTo(
          '.hero__cta-block',
          { yPercent: 26, scaleX: 0.82, transformOrigin: 'left bottom', autoAlpha: 0 },
          { yPercent: 0, scaleX: 1, autoAlpha: 1, duration: 1.35, clearProps: 'visibility,opacity,transform' },
          'textEntry',
        )
        .fromTo(
          '.hero__copy h1',
          { yPercent: 26, scaleX: 0.82, transformOrigin: 'left bottom', autoAlpha: 0 },
          { yPercent: 0, scaleX: 1, autoAlpha: 1, duration: 1.35, clearProps: 'visibility,opacity,transform' },
          '-=0.82',
        )
        .fromTo(
          ['.hero__join-glow', '.hero__brand-marquee'],
          { y: 24, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.95, stagger: 0.12, clearProps: 'visibility,opacity,transform' },
          '-=0.58',
        )

      gsap.utils.toArray('.motion-section').forEach((section) => {
        const cards = gsap.utils
          .toArray(section.querySelectorAll('.motion-card, .service-row, .product-rail, .split-format__choice'))
          .filter((card) => !card.closest('.achievement-block'))

        if (cards.length) {
          gsap.from(cards, {
            scrollTrigger: {
              trigger: section,
              start: 'top 76%',
            },
            y: 42,
            autoAlpha: 0,
            duration: 0.92,
            stagger: 0.08,
            ease: 'power3.out',
          })
        }
      })

      gsap.utils.toArray('.profile-section__avatar img').forEach((image) => {
        gsap.fromTo(
          image,
          { scale: 1.08 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: image,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8,
            },
          },
        )
      })
    })

    const fallbackTimer = window.setTimeout(() => {
      intro?.progress(1).kill()
      gsap.killTweensOf(heroTargets)
      gsap.set(heroTargets, {
        autoAlpha: 1,
        y: 0,
        yPercent: 0,
        scaleX: 1,
        clearProps: 'visibility,opacity,transform',
      })
    }, 2500)

    return () => {
      window.clearTimeout(fallbackTimer)
      ctx.revert()
    }
  }, [])
}

export default usePortfolioMotion
