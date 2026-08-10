import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'hass-react',
  tagline: 'Headless React components and hooks for building Home Assistant UI',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://hass-react.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For custom domain, this is usually '/'
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'dlwiest', // Usually your GitHub org/user name.
  projectName: 'hass-react', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/dlwiest/hass-react/tree/master/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'hass-react',
      hideOnScroll: false,
      items: [
        {
          href: 'https://github.com/dlwiest/hass-react',
          label: 'GitHub',
          position: 'right',
          className: 'navbar__link--github',
        },
        {
          to: '/docs/intro',
          label: 'Get Started',
          position: 'right',
          className: 'navbar__link--get-started',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'hass-react',
          items: [
            {
              label: 'React hooks for Home Assistant. Build custom interfaces with ease.',
              href: '#',
            },
          ],
        },
        {
          title: 'Links',
          items: [
            {
              label: 'GitHub Repository',
              href: 'https://github.com/dlwiest/hass-react',
            },
            {
              label: 'Documentation',
              to: '/docs/intro',
            },
            {
              label: 'Examples',
              href: 'https://github.com/dlwiest/hass-react/tree/master/examples',
            },
          ],
        },
        {
          title: 'Developer',
          items: [
            {
              html: 'Created by <a href="https://dlwiest.com" target="_blank" rel="noopener noreferrer">Derrick Wiest</a>',
            },
          ],
        },
      ],
      copyright: `<div class="footer__bottom"><span>© ${new Date().getFullYear()} hass-react. Open source and free to use.</span><div class="footer__bottom-links"><a href="https://github.com/dlwiest/hass-react" target="_blank" rel="noopener noreferrer">GitHub</a><a href="https://dlwiest.com" target="_blank" rel="noopener noreferrer">Developer Site</a></div></div>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
