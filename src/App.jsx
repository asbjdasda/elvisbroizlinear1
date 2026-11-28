import AuthModal from './components/feedback/AuthModal'
import { emailAuth } from './components/feedback/emailAuth'
import ClientMapPanel from './components/ClientMapPanel'
import clientMark0 from './assets/client-marks/green-ring.webp'
import clientMark1 from './assets/client-marks/multicolor-chevron.webp'
import clientMark2 from './assets/client-marks/herdio.webp'
import clientMark3 from './assets/client-marks/leagend.webp'
import clientMark4 from './assets/client-marks/ciberer.webp'
import clientMark5 from './assets/client-marks/nimo.webp'
import clientMark6 from './assets/client-marks/samassi.webp'
import clientMark7 from './assets/client-marks/usay.webp'
import clientMark8 from './assets/client-marks/zeblaze.webp'
import clientMark9 from './assets/client-marks/highgreat.webp'
import clientMark10 from './assets/client-marks/paxini.webp'
import clientMark11 from './assets/client-marks/color-t.webp'
import clientMark12 from './assets/client-marks/ubtech.webp'
import clientMark13 from './assets/client-marks/silkroad.webp'
import clientMark14 from './assets/client-marks/lingxing.webp'
import clientMark15 from './assets/client-marks/iridescent-orb.webp'
import clientMark16 from './assets/client-marks/arch.webp'
import clientMark17 from './assets/client-marks/round-face.webp'
import { ArrowLeft, ArrowRight, Mail, Phone } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import './video-modal-final.css'
import './portfolio-theme.css'
import Particles from './components/Particles'
import SquishSwitch from './components/SquishSwitch'
import AchievementDashboard from './components/AchievementDashboard'
import BorderGlow from './BorderGlow'
import Grainient from './Grainient'
import Loader from './components/Loader'
import LogoLoop from './components/LogoLoop'
import ProductSection from './components/ProductSection'
import ScrollFloat from './components/ScrollFloat'
import usePortfolioMotion from './hooks/usePortfolioMotion'

const navItems = [
  { label: 'Profile', target: 'profile' },
  { label: 'Project', target: 'project' },
  { label: 'Services', target: 'services' },
  { label: 'Contact', target: 'contact' },
]

const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
const HERO_VIDEO_URL =
  import.meta.env.VITE_HERO_VIDEO_URL || 'https://video.elvisbroizlinear.com/assets/product-videos/hero/hero-window.mp4'

const cinematicGrainientProps = {
  color1: '#dd4c0d',
  color2: '#10053e',
  color3: '#1e021f',
  timeSpeed: 0.25,
  colorBalance: -0.25,
  warpStrength: 1.0,
  warpFrequency: 3.1,
  warpSpeed: 2.0,
  warpAmplitude: 50.0,
  blendAngle: -21,
  blendSoftness: 0.05,
  rotationAmount: 500.0,
  noiseScale: 2.2,
  grainAmount: 0.1,
  grainScale: 2.0,
  grainAnimated: false,
  contrast: 1,
  gamma: 0.8,
  saturation: 1.0,
  centerX: -0.06,
  centerY: 0.0,
  zoom: 1.5,
}

const logoItems = [
  { name: 'Samassi', src: assetPath('/assets/logos/samassi.png'), height: '56px', maxWidth: '128px' },
  { name: 'Nimo', src: assetPath('/assets/logos/nimo.png'), height: '58px', maxWidth: '150px' },
  { name: 'Herdio', src: assetPath('/assets/logos/herdio-logo-new.png'), height: '54px', maxWidth: '230px' },
  { name: 'Usay', src: assetPath('/assets/logos/usay.png'), height: '52px', maxWidth: '132px' },
  { name: 'TITAN Innovation Awards', src: assetPath('/assets/logos/titan.png'), height: '48px', maxWidth: '176px' },
  { name: 'Good Design', src: assetPath('/assets/logos/good-design.png'), height: '58px', maxWidth: '86px' },
  { name: 'MUSE', src: assetPath('/assets/logos/muse.png'), height: '58px', maxWidth: '86px' },
  { name: 'Leagend', src: assetPath('/assets/logos/leagend.png'), height: '48px', maxWidth: '178px' },
  { name: 'FDA', src: assetPath('/assets/logos/fda.png'), height: '58px', maxWidth: '82px' },
]

const skillItems = [
  { name: '3ds Max', src: assetPath('/assets/skills/3dsmax.png') },
  { name: 'Adobe Illustrator', src: assetPath('/assets/skills/ai.png') },
  { name: 'Cinema 4D', src: assetPath('/assets/skills/cinema4d.png') },
  { name: 'Adobe XD', src: assetPath('/assets/skills/xd.png') },
  { name: 'Figma', src: assetPath('/assets/skills/figma.png') },
  { name: 'Photoshop', src: assetPath('/assets/skills/ps.png') },
  { name: 'XMind', src: assetPath('/assets/skills/xmind.png') },
  { name: 'After Effects', src: assetPath('/assets/skills/ae.png') },
  { name: 'Redshift', src: assetPath('/assets/skills/redshift.webp') },
  { name: 'Octane', src: assetPath('/assets/skills/octane.webp') },
]

const clientMarks = [
  { src: clientMark0, name: '' },
  { src: clientMark1, name: '' },
  { src: clientMark2, name: 'Herdio' },
  { src: clientMark3, name: 'Leagend' },
  { src: clientMark4, name: 'Ciberer' },
  { src: clientMark5, name: 'Nimo' },
  { src: clientMark6, name: 'Samassi' },
  { src: clientMark7, name: 'Usay' },
  { src: clientMark8, name: 'Zeblaze' },
  { src: clientMark9, name: 'HighGreat' },
  { src: clientMark10, name: 'PaXini' },
  { src: clientMark11, name: '' },
  { src: clientMark12, name: 'UBTECH' },
  { src: clientMark13, name: 'Silkroad Visual' },
  { src: clientMark14, name: 'Lingxing' },
  { src: clientMark15, name: '' },
  { src: clientMark16, name: '' },
  { src: clientMark17, name: '' },
]

const serviceItems = [
  {
    number: '01',
    title: 'Brand VI Systems',
    copy: 'Identity systems, launch visuals, product language, and guideline-ready brand assets.',
  },
  {
    number: '02',
    title: 'Amazon A+ Visual Sets',
    copy: 'Commercial image groups for product storytelling, comparison modules, and conversion-focused layouts.',
  },
  {
    number: '03',
    title: 'TVC & Motion Films',
    copy: 'Short films, campaign videos, social cuts, and cinematic product motion for multi-channel delivery.',
  },
  {
    number: '04',
    title: 'Selected Brand Clients',
    copy: 'A selection of brands for which I have successfully delivered projects.',
  },
]

const socialItems = [
  {
    name: 'Figma',
    href: 'https://www.figma.com/design/masXGJn73FetFjXNHXFsqM/%E5%8C%97%E7%BE%8E-Usay%E6%88%92%E6%8C%87-App?node-id=112-18811',
    src: assetPath('/assets/social/figma.png'),
  },
  { name: 'Instagram', href: 'https://www.instagram.com/', src: assetPath('/assets/social/instagram.png') },
  { name: 'Behance', href: 'https://www.behance.net/valentinejack1', src: assetPath('/assets/social/behance.png') },
  { name: 'Zcool', href: 'https://www.zcool.com.cn/u/21518952', src: assetPath('/assets/social/zcool-ball-white.png') },
]

const footerSocialItems = socialItems.filter((item) => item.name !== 'Zcool')
const zcoolItem = socialItems.find((item) => item.name === 'Zcool')

const profileSlides = [
  {
    eyebrow: 'About us',
    title: "Hey! I'm Elvis Brozien",
    copy: '',
  },
  {
    eyebrow: 'Motion Rive',
    title: 'Make This World Within Reach!',
    copy:
      'I am a passionate video content creator, dedicated to telling distinctive stories and expressing profound emotions through visual imagery. Throughout both pre-production and post-production, I enjoy exploring the artistic connection between light, composition, and color, aiming to create works that deliver strong visual impact while carrying rich emotional depth. Over the years, I have built extensive photography experience through a wide range of projects, allowing me to adapt flexibly across different environments and capture key moments with precision. Beyond professional photography, I also have a deep understanding of post-production, with unique insights into AI video creation and motion imagery. Moving forward, I aim to stay aligned with the pulse of the times, continue evolving, and create new forms of visual expression for the next era.',
  },
]

const profileStats = [
  ['Current Role', 'Motion Designer & Director'],
  ['Client Base', 'Brand / B2B / B2C / Government'],
  ['Industry Experience', '3+ years'],
  ['Script Output', '100+'],
  ['Video Deliverables', '500+'],
  ['Current Focus', 'AI Motion, E-commerce Short Videos, 3D & 2D Animation'],
]

function scrollToSection(target) {
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
}

function NavGuide({ activeSection, onSelect }) {
  return (
    <nav className="nav-guide" aria-label="Brozien portfolio guide">
      {navItems.map((item) => (
        <button
          className={activeSection === item.target ? 'nav-guide__item is-active' : 'nav-guide__item'}
          key={item.target}
          onClick={() => onSelect(item.target)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function Marquee({ label, items, variant = 'logos' }) {
  const isSkills = variant === 'skills'
  const isHero = variant === 'hero'
  const loopItems = items.map((item) => ({
    ...item,
    alt: `${item.name} ${isSkills ? 'icon' : 'logo'}`,
  }))

  return (
    <section className={`marquee marquee--${variant}`} aria-label={label}>
      <div className="marquee__inner">
        <div className="marquee__label">
          <p>{label}</p>
        </div>
        <div className="marquee__viewport" style={{ '--marquee-fade': isSkills ? '#070808' : '#020203' }}>
          <LogoLoop
            logos={loopItems}
            speed={isSkills ? 88 : isHero ? 54 : 96}
            direction="left"
            logoHeight={isSkills ? 58 : isHero ? 50 : 54}
            gap={isSkills ? 58 : isHero ? 42 : 86}
            hoverSpeed={0}
            fadeOut
            fadeOutColor={isSkills ? '#070808' : '#020203'}
            scaleOnHover={false}
            ariaLabel={label}
            renderItem={(item) => (
              <div className="marquee__loop-item" style={{ '--item-height': item.height, '--item-max-width': item.maxWidth }}>
                <img src={item.src} alt={item.alt} loading={isHero ? 'eager' : 'lazy'} />
                {isSkills && <span>{item.name}</span>}
              </div>
            )}
          />
        </div>
      </div>
    </section>
  )
}

function TiltedCard({ src, alt }) {
  const cardRef = useRef(null)
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg) scale(1)')
  const [captionStyle, setCaptionStyle] = useState({ opacity: 0, transform: 'translate3d(0, 0, 36px)' })

  function handlePointerMove(event) {
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const rotateY = ((x / rect.width) - 0.5) * 13
    const rotateX = ((0.5 - y / rect.height)) * 13

    setTransform(`rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.025)`)
    setCaptionStyle({
      opacity: 1,
      transform: `translate3d(${Math.min(Math.max(x + 18, 12), rect.width - 132)}px, ${Math.min(Math.max(y + 18, 12), rect.height - 34)}px, 46px)`,
    })
  }

  function handlePointerLeave() {
    setTransform('rotateX(0deg) rotateY(0deg) scale(1)')
    setCaptionStyle({ opacity: 0, transform: 'translate3d(18px, 18px, 36px)' })
  }

  return (
    <figure className="tilted-card-figure" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <span className="tilted-card-mobile-alert">Tap to view the IP portrait.</span>
      <div className="tilted-card-inner" ref={cardRef} style={{ transform }}>
        <img className="tilted-card-img" src={src} alt={alt} loading="lazy" />
        <div className="tilted-card-overlay" aria-hidden="true" />
        <figcaption className="tilted-card-caption" style={captionStyle}>
          Brozien IP
        </figcaption>
      </div>
    </figure>
  )
}

function ProfileSection() {
  const [profileSlide, setProfileSlide] = useState(0)
  const activeSlide = profileSlides[profileSlide]
  const profileSectionRef = useRef(null)

  const changeProfileSlide = useCallback((direction) => {
    setProfileSlide((current) => (current + direction + profileSlides.length) % profileSlides.length)
  }, [])

  return (
    <section className="profile-section motion-section" id="profile" aria-label="Profile" ref={profileSectionRef}>
      <div className="profile-section__heading motion-title">
        <ScrollFloat>PROFILE</ScrollFloat>
        <p>Personal Experience</p>
      </div>
      <div className="profile-section__visual motion-card">
        <div className="profile-section__avatar">
          <TiltedCard src={assetPath('/assets/profile/ip-avatar-brozien.jpg')} alt="Brozien IP avatar" />
        </div>
      </div>
      <div className="profile-section__text motion-card">
        <div className="profile-section__card-head">
          <span>{activeSlide.eyebrow}</span>
          <div className="profile-section__arrows" aria-label="Profile content controls">
            <button type="button" onClick={() => changeProfileSlide(-1)} aria-label="Scroll to previous profile page">
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => changeProfileSlide(1)} aria-label="Scroll to next profile page">
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <div className="profile-section__slider" style={{ '--profile-slide': profileSlide }}>
          {profileSlides.map((slide, index) => (
            <article className={index === profileSlide ? 'profile-section__slide is-active' : 'profile-section__slide'} key={slide.title}>
              <h1>{slide.title}</h1>
              {slide.copy ? <p>{slide.copy}</p> : null}
            </article>
          ))}
        </div>
        {profileSlide === 0 ? (
          <div className="profile-section__meta">
            {profileStats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <AchievementDashboard />
    </section>
  )
}

function ServicesSection() {
  return (
    <section className="services-section motion-section" id="services" aria-label="Services">
      <div className="services-section__head motion-title">
        <ScrollFloat>SERVICES</ScrollFloat>
        <p>Selected capabilities</p>
      </div>
      <div className="services-list">
        {serviceItems.map((item) => item.number === '04' ? (
          <ClientMapPanel key={item.number} title={item.title} description={item.copy}>
            <ul className="client-marks" aria-label="Client logos">
              {clientMarks.map(({ src, name }, index) => (
                <li key={src} style={{ '--order': index }}><img src={src} alt={name} loading="lazy" /></li>
              ))}
            </ul>
          </ClientMapPanel>
        ) : (
          <article className="service-row motion-card" key={item.number}>
            <span>{item.number}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </div>
          </article>
        ))}
      </div>
      <Marquee label="Creative toolset" items={skillItems} variant="skills" />
    </section>
  )
}

function ContactSection() {
  return (
    <section className="contact-section motion-section" id="contact" aria-label="Contact">
      <div className="contact-section__heading motion-title">
        <ScrollFloat>CONTACT</ScrollFloat>
        <p>Reach out</p>
      </div>
      <div className="contact-section__panel">
        <div className="contact-section__brand motion-card">
          <img src={assetPath('/assets/profile/brozien-b-mark.png')} alt="Brozien mark" />
          <div className="contact-section__brand-text">
            <h2>Brozien</h2>
            <p>design studio</p>
          </div>
        </div>
        <div className="contact-section__center">
          <p>elvisbiozliner.onrender.com</p>
        </div>
        <div className="contact-section__details">
          <a href="tel:+8613480670000">
            <Phone size={18} />
            +86 134 8067XXXX
          </a>
          <a href="mailto:Yzb2016494896@outlook.com">
            <Mail size={18} />
            Yzb2016494896@outlook.com
          </a>
          {zcoolItem ? (
            <a className="contact-section__zcool" href={zcoolItem.href} target="_blank" rel="noreferrer">
              <span className="contact-section__zcool-icon" aria-hidden="true">
                <img src={zcoolItem.src} alt="" loading="lazy" />
              </span>
              https://www.zcool.com.cn/u/21518952
            </a>
          ) : null}
        </div>
        <div className="social-links" aria-label="Social links">
          {footerSocialItems.map((item) => (
            <a href={item.href} key={item.name} target="_blank" rel="noreferrer">
              <img src={item.src} alt={item.name} loading="lazy" />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [lightTheme, setLightTheme] = useState(() => document.documentElement.dataset.theme === 'light')
  function changeTheme(light) {
    setLightTheme(light)
    const theme = light ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('brozien-theme', theme) } catch { /* Storage may be unavailable. */ }
  }
  const [activeSection, setActiveSection] = useState('')
  const [authMode, setAuthMode] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  useEffect(() => {
    if (!emailAuth) return
    const { data } = emailAuth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)))
    return () => data.subscription.unsubscribe()
  }, [])
  async function signOut() {
    const { error } = await emailAuth.signOut({ scope: 'local' })
    setSignOutError(error ? 'Could not sign out. Please try again.' : '')
  }
  const [opening, setOpening] = useState(true)
  usePortfolioMotion()

  useEffect(() => {
    const timer = window.setTimeout(() => setOpening(false), 1050)
    return () => window.clearTimeout(timer)
  }, [])

  function handleNavSelect(target) {
    setActiveSection(target)
    window.requestAnimationFrame(() => scrollToSection(target))
  }

  return (
    <div className="page-shell">
      {opening && <Loader className="app-loader" label="Opening portfolio" />}
      <div className="page-shell__backdrop" aria-hidden="true">
        {!lightTheme && <Grainient className="page-shell__grainient" {...cinematicGrainientProps} />}
      </div>
      {authMode ? <AuthModal key={authMode} mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} /> : null}
      <header className="site-header">
        <div className="site-header__left">
          <a className="identity" href="#hero" aria-label="Brozien home">
            <img src={assetPath('/assets/brozien-identity-mark.png')} alt="" />
          </a>
          <div className="header-auth" aria-label="Authentication actions">
            {signedIn ? (
              <button className="header-auth__button header-auth__button--secondary" type="button" onClick={signOut}>Log out</button>
            ) : (
              <>
                <button className="header-auth__button header-auth__button--secondary" type="button" onClick={() => setAuthMode('login')}>Log in</button>
                <button className="header-auth__button header-auth__button--primary" type="button" onClick={() => setAuthMode('signup')}>Sign Up</button>
              </>
            )}
            {signOutError && <span role="alert">{signOutError}</span>}
          </div>
        </div>
        <NavGuide activeSection={activeSection} onSelect={handleNavSelect} />
        <div className="site-header__tools">
        <SquishSwitch checked={lightTheme} onChange={changeTheme} ariaLabel="Light mode"
          trackColor="#39393e" trackOnColor="#d9dadc" thumbColor="#f8f8f6" thumbOnColor="#333439"
          width={48} height={27} />
        <button className="contact-link" type="button" onClick={() => handleNavSelect('contact')}>
          <Mail size={16} />
          Contact
        </button>
        </div>
      </header>

      <main>
        <section className="hero" id="hero">
          <div className="hero__frame">
            <video
              className="hero__video"
              poster={assetPath('/assets/hero-window-poster.jpg')}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Brozien hero animation"
            >
              <source src={HERO_VIDEO_URL} type="video/mp4" />
              <source src={assetPath('/assets/hero-preview.mp4')} type="video/mp4" />
            </video>
            <Particles className="hero__particles" particleCount={200} particleSpread={10}
              speed={0.1} particleBaseSize={50} glow={0.5} twinkle={0.3}
              moveParticlesOnHover hoverEffect="parallax" depthOfField={0.8} opacity={0.4} />
            <div className="hero__gradient" />
            <div className="hero__slats" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="hero__copy">
              <h1>Brozien</h1>
            </div>

            <div className="hero__cta-block">
              <div className="hero__portfolio-title hero__intro-title" aria-label="An animation portfolio of Brozien">
                <span>An animation</span>
                <strong>PORTFOLIO</strong>
                <em>of</em>
              </div>
            </div>

            <BorderGlow
              className="hero__join-glow"
              backgroundColor="rgba(240, 234, 209, 0.96)"
              borderRadius={999}
              glowColor="42 86 78"
              glowIntensity={1.16}
              glowRadius={24}
              edgeSensitivity={14}
              coneSpread={32}
              fillOpacity={0.2}
            >
              <a href="#services" className="hero__join-link">
                Join Us
                <span>
                  <ArrowRight size={18} />
                </span>
              </a>
            </BorderGlow>

            <div className="hero__brand-marquee">
              <Marquee label="Collaborations" items={logoItems} variant="hero" />
            </div>

            <div className="hero__scroll">Scroll</div>
          </div>
        </section>

        <div className="below-hero">
          <ProfileSection />
          <ProductSection />
          <ServicesSection />
          <ContactSection />
        </div>
      </main>
    </div>
  )
}

export default App
