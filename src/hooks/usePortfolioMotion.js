import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function usePortfolioMotion() {
  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return undefined

    const ctx = gsap.context(() => {
      const video = document.querySelector('.hero__video')
      video.classList.add('is-revealing')
      const intro = gsap.timeline({ defaults: { ease: 'power2.out' } })
      intro
        .fromTo(video,
          { '--wave-edge': '0%', opacity: 0 },
          { '--wave-edge': '135%', opacity: 1, duration: 1.8, ease: 'power1.out',
            onComplete: () => video.classList.remove('is-revealing') },
        )
        .addLabel('textEntry', 1.72)
        .fromTo(
          '.hero__cta-block',
          { yPercent: 26, scaleX: 0.82, transformOrigin: 'left bottom', autoAlpha: 0 },
          { yPercent: 0, scaleX: 1, autoAlpha: 1, duration: 2.55, clearProps: 'visibility,opacity,transform' },
          'textEntry',
        )
        .fromTo(
          '.hero__copy h1',
          { yPercent: 26, scaleX: 0.82, transformOrigin: 'left bottom', autoAlpha: 0 },
          { yPercent: 0, scaleX: 1, autoAlpha: 1, duration: 2.55, clearProps: 'visibility,opacity,transform' },
          'textEntry+=0.24',
        )
        .fromTo(
          ['.hero__join-glow', '.hero__brand-marquee'],
          { y: 24, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.95, stagger: 0.12, clearProps: 'visibility,opacity,transform' },
          'textEntry+=0.65',
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

    return () => {
      document.querySelector('.hero__video')?.classList.remove('is-revealing')
      ctx.revert()
    }
  }, [])
}

export default usePortfolioMotion
