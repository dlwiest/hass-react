import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'authentication',
    {
      type: 'category',
      label: 'Entities',
      items: [
        {
          type: 'category',
          label: 'Lighting & Power',
          items: [
            'entities/light',
            'entities/switch',
            'entities/fan',
            'entities/scene',
          ],
        },
        {
          type: 'category',
          label: 'Climate & Environment',
          items: [
            'entities/climate',
            'entities/weather',
            'entities/sensor',
            'entities/binary-sensor',
            'entities/number',
            'entities/datetime',
          ],
        },
        {
          type: 'category',
          label: 'Security & Access',
          items: [
            'entities/alarm-control-panel',
            'entities/camera',
            'entities/lock',
            'entities/cover',
          ],
        },
        {
          type: 'category',
          label: 'Entertainment',
          items: [
            'entities/media-player',
          ],
        },
        {
          type: 'category',
          label: 'Productivity',
          items: [
            'entities/calendar',
            'entities/todo',
            'entities/vacuum',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Advanced Hooks',
      items: [
        'advanced/multiple-entities',
        'advanced/custom-service-calls',
        'advanced/external-transports',
      ],
    },
    'error-handling',
    'development-testing',
  ],
};

export default sidebars;