import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {Highlight, themes} from 'prism-react-renderer';

import styles from './index.module.css';

const features = [
  {
    title: 'Flexible API',
    icon: '🪝',
    description: 'Every entity works as a render-prop component or a hook. Pick per component. Both read from the same store.',
  },
  {
    title: 'Small and Fast',
    icon: '⚡',
    description: 'One WebSocket connection shared by every hook, and components only re-render when their own entity changes. Big dashboards stay fast.',
  },
  {
    title: 'Headless Design',
    icon: '🎨',
    description: 'No styles shipped and no classes to override. Bring your own CSS, Tailwind, or component library.',
  },
  {
    title: 'Real-time Updates',
    icon: '🔌',
    description: 'The provider owns the WebSocket. Entity states update the moment they change in Home Assistant, no polling.',
  },
  {
    title: 'Built-in State Management',
    icon: '📦',
    description: 'No Redux and no context wiring. Entity state lives in the library and stays in sync with Home Assistant on its own.',
  },
  {
    title: 'Simple Service Calls',
    icon: '🛠️',
    description: 'Typed methods for common actions like turning on a light, plus callService for anything else Home Assistant exposes.',
  },
];

const additionalFeatures = [
  {
    title: 'Component Library',
    description: 'Light, Switch, MediaPlayer, Climate, and more built-in components.',
  },
  {
    title: 'Fully Typed',
    description: 'Complete type definitions for all entities and their properties.',
  },
  {
    title: 'Auth Just Works',
    description: 'OAuth 2.0 and long-lived token support with auto-detection.',
  },
];

function HeroSection() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <section className={styles.hero}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <Heading as="h1" className={styles.heroTitle}>
              The React toolkit for Home Assistant UIs
            </Heading>
            <p className={styles.heroSubtitle}>
              Headless React hooks and components for Home Assistant entities and services. 
              Build custom dashboards without the hassle of raw WebSockets or HASS service calls.
            </p>
            <div className={styles.heroButtons}>
              <Link className={styles.primaryButton} to="/docs/intro">
                Get Started
              </Link>
              <Link className={styles.secondaryButton} to="/docs/entities/light">
                Browse Entities
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.visDash}>
              <div className={styles.visDashBar}>
                <div className={styles.visDashTitle}><span /><span /></div>
                <div className={styles.visDashStatus}><span /></div>
              </div>
              <div className={styles.visDashGrid}>
                <div className={styles.visTile}>
                  <div className={styles.visTileTop}>
                    <div className={styles.visOrb} />
                    <div className={styles.visToggle}><span /></div>
                  </div>
                  <div className={styles.visRows}><span /><span /></div>
                </div>
                <div className={styles.visTile}>
                  <svg viewBox="0 0 72 72" className={styles.visGaugeSvg}>
                    <circle cx="36" cy="36" r="30" className={styles.visGaugeTrack} />
                    <circle cx="36" cy="36" r="30" className={styles.visGaugeArc} />
                  </svg>
                  <div className={styles.visGaugeRows}><span /><span /></div>
                </div>
                <div className={`${styles.visTile} ${styles.visTileWide}`}>
                  <div className={styles.visRows}><span /><span /></div>
                  <div className={styles.visSlider}><span /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className={styles.whySection}>
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.sectionMark} aria-hidden="true" />
          <Heading as="h2" className={styles.sectionTitle}>
            Build better interfaces
          </Heading>
          <p className={styles.sectionSubtitle}>
            The WebSocket and state plumbing is handled, so you can spend your time on the UI
          </p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <div key={idx} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <Heading as="h3" className={styles.featureTitle}>
                {feature.title}
              </Heading>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const CODE_EXAMPLE = `// Render props
<Light entityId="light.floor_lamp">
  {({ isOn, toggle }) => (
    <button onClick={toggle}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Light>

// Or hooks
const light = useLight('light.floor_lamp')
<button onClick={light.toggle}>
  {light.isOn ? 'ON' : 'OFF'}
</button>`;

function CodeSection() {
  return (
    <section className={styles.codeSection}>
      <div className="container">
        <div className={styles.codeLayout}>
          <div className={styles.codeExample}>
            <div className={styles.windowBar} aria-hidden="true">
              <span /><span /><span />
            </div>
            <Highlight code={CODE_EXAMPLE} language="tsx" theme={themes.nightOwl}>
              {({tokens, getLineProps, getTokenProps}) => (
                // The panel keeps its own background in both color modes, so
                // the theme is pinned dark and its background dropped.
                <pre className={styles.codeBlock}>
                  <code>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({line})}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({token})} />
                        ))}
                      </div>
                    ))}
                  </code>
                </pre>
              )}
            </Highlight>
          </div>
          <div className={styles.codeFeatures}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionMark} aria-hidden="true" />
              <Heading as="h2" className={styles.sectionTitle}>
                Choose your style
              </Heading>
              <p className={styles.sectionSubtitle}>
                Use render props for full control or hooks for direct access
              </p>
            </div>
            <div className={styles.additionalFeatures}>
              {additionalFeatures.map((feature, idx) => (
                <div key={idx} className={styles.additionalFeature}>
                  <span className={styles.featureTick} aria-hidden="true" />
                  <div>
                    <Heading as="h3" className={styles.additionalFeatureTitle}>
                      {feature.title}
                    </Heading>
                    <p className={styles.additionalFeatureDescription}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.ctaSection}>
      <div className="container">
        <div className={styles.ctaContent}>
          <Heading as="h2" className={styles.ctaTitle}>
            Ready to build?
          </Heading>
          <p className={styles.ctaSubtitle}>
            Point hass-react at your Home Assistant instance and start building
          </p>
          <div className={styles.ctaButtons}>
            <Link className={styles.primaryButton} to="/docs/intro">
              Get Started
            </Link>
            <Link
              className={styles.secondaryButton}
              to="/docs/entities/light">
              Browse Entities
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Build Home Assistant apps with pure React"
      description="A lightweight hook and headless component library that abstracts WebSockets, state management, and service calls for Home Assistant">
      <HeroSection />
      <main>
        <WhySection />
        <CodeSection />
        <CTASection />
      </main>
    </Layout>
  );
}
