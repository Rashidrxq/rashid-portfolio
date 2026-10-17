import React, { useState } from "react";
import AgentsHub from "./AgentsHub.jsx";
import ATSAgent from "./ATSAgent.jsx";
import LinkedInStudio from "./LinkedInStudio.jsx";
import TravelPlanner from "./TravelPlanner.jsx";
import SupportChatWidget from "./components/SupportChatWidget.tsx";

const EMAIL = "rashid.mhd.pp@gmail.com";
const ALT_EMAIL = "muhammerashid12345@gmail.com";
const PHONE = "+919745393044";

const projects = [
  {
    number: "01",
    category: "SALES OPERATIONS · FULL STACK",
    description:
      "A role-aware operations tool that carries each order from sales through inventory, production, billing, and dispatch.",
    images: [
      {
        src: "/images/remex-erp-dashboard-concept.png",
        alt: "Generated concept artwork of a dark ERP operations dashboard on a manufacturing worktable.",
      },
      {
        src: "/images/remex-erp-workshop-concept.png",
        alt: "Generated concept artwork showing a laptop and phone with an order workflow in a workshop.",
      },
    ],
    stack: ["Next.js", "React", "TypeScript", "Prisma", "PostgreSQL", "Tailwind CSS"],
    repository: "https://github.com/Rashidrxq/SalesOrder-ERP-REMEX",
    demo: "https://sales-order-erp-remex.vercel.app/Auth/login",
  },
];

const capabilities = [
  "Brand identity",
  "Digital experiences",
  "Creative development",
  "Motion & interaction",
];

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="arrow-icon">
      <path d="M3.5 14.5 14 4M5.5 4H14v8.5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 12" className="arrow-line">
      <path d="M1 6h19M15 1l5 5-5 5" />
    </svg>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Muhammed Rashid PP, back to top">
        <span className="wordmark-mark">R<span>.</span></span>
        <span className="wordmark-name">Muhammed Rashid PP<br /><small>CREATIVE PORTFOLIO</small></span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#work"><span>02</span> Work</a>
        <a href="#agents"><span>03</span> Agents</a>
        <a href="#about"><span>07</span> About</a>
        <a href="#contact"><span>09</span> Contact</a>
      </nav>
      <a className="header-cta" href="#contact">
        LET'S TALK <ArrowUpRight />
      </a>
    </header>
  );
}

function HeroArt() {
  function moveArt(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--shift-x", (x * 68) + "px");
    event.currentTarget.style.setProperty("--shift-y", (y * 52) + "px");
    event.currentTarget.style.setProperty("--rotate-x", (y * -22) + "deg");
    event.currentTarget.style.setProperty("--rotate-y", (x * 28) + "deg");
  }

  function resetArt(event) {
    event.currentTarget.style.setProperty("--shift-x", "0px");
    event.currentTarget.style.setProperty("--shift-y", "0px");
    event.currentTarget.style.setProperty("--rotate-x", "0deg");
    event.currentTarget.style.setProperty("--rotate-y", "0deg");
  }

  return (
    <div
      className="hero-art"
      role="img"
      onPointerMove={moveArt}
      onPointerLeave={resetArt}
      aria-label="Interactive red and ivory rotating 3D cube"
    >
      <div className="art-grain" />
      <div className="art-grid" />
      <p className="art-index mono">FORM STUDY <span>—</span> 001</p>
      <div className="orbit orbit--back" />
      <div className="orbit orbit--front" />
      <div className="cube-shadow" />
      <div className="cube-wrap">
        <div className="cube">
          <div className="cube-face cube-face--front"><span className="cube-r">R<span>.</span></span><span className="cube-face-note">MAKE<br />A MARK</span></div>
          <div className="cube-face cube-face--back"><span className="cube-back-type">RASHID<br />STUDIO</span></div>
          <div className="cube-face cube-face--right"><span className="cube-right-dot" /><span className="cube-face-note">IDEAS<br />IN MOTION</span></div>
          <div className="cube-face cube-face--left"><span className="cube-left-type">R / 01</span></div>
          <div className="cube-face cube-face--top"><span className="top-ring" /></div>
          <div className="cube-face cube-face--bottom" />
        </div>
      </div>
      <div className="art-cross art-cross--one">+</div>
      <div className="art-cross art-cross--two">+</div>
      <div className="art-spark" aria-hidden="true">✳</div>
      <p className="art-caption mono">A LITTLE DEPTH<br />GOES A LONG WAY</p>
      <div className="art-interaction mono"><span className="interaction-dot" /> MOVE TO PLAY</div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero section-shell" id="top">
      <div className="hero-meta">
        <p><span className="meta-pip" /> INDEPENDENT PRACTICE <span className="meta-slash">/</span> EDITABLE STARTER</p>
        <p>PORTFOLIO 2025—26 <span className="meta-slash">/</span> <a href="#contact">AVAILABLE? UPDATE THIS</a></p>
      </div>
      <div className="hero-layout">
        <div className="hero-copy">
          <p className="eyebrow"><span>01</span> THE SHORT VERSION</p>
          <h1>Make<br />your<br /><em>mark.</em></h1>
          <p className="hero-intro">
            A personal portfolio for Muhammed Rashid PP. Add a one-line introduction about your work here.
          </p>
          <div className="hero-links">
            <a className="button button--dark" href="#work">EXPLORE THE WORK <ArrowUpRight /></a>
            <a className="plain-link" href="#about">A LITTLE ABOUT ME <span>↓</span></a>
          </div>
        </div>
        <HeroArt />
      </div>
      <div className="hero-bottom">
        <p>DESIGN <span>×</span> CODE <span>×</span> CURIOSITY</p>
        <a href="#work" aria-label="Scroll to selected work" className="scroll-mark">SCROLL TO EXPLORE <span>↓</span></a>
      </div>
    </section>
  );
}

function ProjectCard({ project, className = "" }) {
  return (
    <article className={"featured-project " + className}>
      <figure className="featured-artwork">
        <img className="featured-artwork-main" src={project.images[0].src} alt={project.images[0].alt} decoding="async" />
        <div className="featured-artwork-inset">
          <img src={project.images[1].src} alt={project.images[1].alt} loading="lazy" decoding="async" />
          <span className="mono">WORKFLOW / CONCEPT</span>
        </div>
        <span className="featured-artwork-index mono">01 / REMEX INTERNATIONAL</span>
        <span className="featured-artwork-caption mono">GENERATED CONCEPT IMAGERY · NOT PRODUCT SCREENSHOTS</span>
        <span className="featured-artwork-mark" aria-hidden="true">R<span>.</span></span>
      </figure>
      <div className="featured-project-info">
        <p className="eyebrow"><span>{project.number}</span> {project.category}</p>
        <h3>SalesOrder ERP<br /><em>Remex International</em></h3>
        <p className="project-description">{project.description}</p>

        <div className="project-stack-block">
          <span className="project-detail-label mono">BUILT WITH</span>
          <ul className="project-stack" aria-label="Technology stack">
            {project.stack.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="project-links">
          <a className="project-link" href={project.repository} target="_blank" rel="noopener noreferrer">
            <span>VIEW REPOSITORY</span><ArrowUpRight />
          </a>
          <a className="project-link" href={project.demo} target="_blank" rel="noopener noreferrer">
            <span>OPEN LIVE DEMO</span><ArrowUpRight />
          </a>
        </div>
      </div>
    </article>
  );
}

function Work() {
  return (
    <section className="work-section section-shell" id="work">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><span>02</span> SELECTED WORK</p>
          <h2>Orders in motion.<br /><em>Built to flow.</em></h2>
        </div>
        <p className="section-note">A closer look at a sales order workflow<br />for Remex International.</p>
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.number}
            project={project}
          />
        ))}
      </div>
      <div className="work-end">
        <span>FEATURED CASE STUDY / SALES ORDER ERP</span>
        <span className="work-end-line" />
        <span>01 / 01</span>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="about-section" id="about">
      <div className="about-shell">
        <div className="about-topline">
          <p className="eyebrow eyebrow--light"><span>07</span> A LITTLE CONTEXT</p>
          <span className="mono about-coord">17°N · 78°E / EDIT AS NEEDED</span>
        </div>
        <div className="about-layout">
          <div className="about-title">
            <h2>Good work<br />starts with<br /><em>good questions.</em></h2>
            <span className="about-star" aria-hidden="true">✳</span>
          </div>
          <div className="about-copy">
            <p className="about-lede">
              I’m Muhammed Rashid PP — a <span>[your role]</span> creating <span>[your kind of work]</span> for <span>[your audience]</span>.
            </p>
            <p>
              Replace this paragraph with a short introduction: what you care about, how you work, and the kind of problems you like to solve. Keep it honest and unmistakably yours.
            </p>
            <a className="about-contact" href="#contact">MORE ABOUT ME <ArrowRight /></a>
          </div>
        </div>
        <div className="capabilities">
          <p className="eyebrow eyebrow--light"><span>08</span> CAPABILITIES TO CUSTOMIZE</p>
          <ul>
            {capabilities.map((capability, index) => (
              <li key={capability}>
                <span className="cap-number mono">0{index + 1}</span>
                <span>{capability}</span>
                <ArrowUpRight />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = "mailto:" + EMAIL;
    }
  }

  return (
    <section className="contact-section section-shell" id="contact">
      <div className="contact-head">
        <p className="eyebrow"><span>09</span> YOUR NEXT MOVE</p>
        <span className="contact-note mono">OPEN FOR A GOOD CONVERSATION</span>
      </div>
      <div className="contact-layout">
        <h2>Let's make<br />something <em>matter.</em></h2>
        <div className="contact-action">
          <p>Have a project, a question, or a left-field idea? Reach me by email or phone, or find me on LinkedIn and GitHub.</p>
          <div className="contact-details">
            <div className="contact-detail">
              <span className="contact-label">EMAIL</span>
              <div className="contact-values">
                <a className="contact-value" href={"mailto:" + EMAIL}>{EMAIL}</a>
                <a className="contact-value" href={"mailto:" + ALT_EMAIL}>{ALT_EMAIL}</a>
              </div>
            </div>
            <div className="contact-detail">
              <span className="contact-label">PHONE</span>
              <div className="contact-values"><a className="contact-value" href={"tel:" + PHONE}>+91 97453 93044</a></div>
            </div>
            <div className="contact-detail">
              <span className="contact-label">SOCIAL</span>
              <div className="contact-values contact-socials">
                <a className="contact-value" href="https://www.linkedin.com/in/muhammedrashidpp/" target="_blank" rel="noreferrer">LinkedIn @muhammedrashidpp ↗</a>
                <a className="contact-value" href="https://github.com/Rashidrxq" target="_blank" rel="noreferrer">GitHub @Rashidrxq ↗</a>
              </div>
            </div>
          </div>
          <button className="copy-button" onClick={copyEmail} type="button">
            {copied ? "COPIED TO CLIPBOARD ✓" : "COPY EMAIL ADDRESS"}
          </button>
        </div>
      </div>
      <footer className="site-footer">
        <a className="footer-mark" href="#top">R<span>.</span></a>
        <p>© {new Date().getFullYear()} MUHAMMED RASHID PP <span>—</span> CREATIVE PORTFOLIO</p>
        <a className="back-to-top" href="#top">BACK TO TOP ↑</a>
      </footer>
    </section>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Work />
        <AgentsHub />
        <ATSAgent />
        <LinkedInStudio />
        <TravelPlanner />
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            <span>MAKE IT MEAN SOMETHING <i>✳</i> MAKE IT MEAN SOMETHING <i>✳</i> </span>
            <span>MAKE IT MEAN SOMETHING <i>✳</i> MAKE IT MEAN SOMETHING <i>✳</i> </span>
          </div>
        </div>
        <About />
        <Contact />
      </main>
      <SupportChatWidget />
    </>
  );
}
