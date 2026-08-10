/**
 * Swizzled 2-state color mode toggle.
 *
 * Docusaurus 3.6+ ships a 3-state toggle (light -> dark -> system) when
 * respectPrefersColorScheme is on. We want the classic behavior instead:
 * default to the system scheme, show the effective mode's icon, and store an
 * explicit preference the first time the visitor clicks.
 */
import React from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {useColorMode} from '@docusaurus/theme-common';
import IconLightMode from '@theme/Icon/LightMode';
import IconDarkMode from '@theme/Icon/DarkMode';
import type {Props} from '@theme/ColorModeToggle';
import styles from './styles.module.css';

function ColorModeToggle({className, buttonClassName, onChange}: Props): React.JSX.Element {
  const isBrowser = useIsBrowser();
  // Effective mode (resolves the system preference); `value` from the navbar
  // wrapper is the stored *choice* and is null until the visitor picks one.
  const {colorMode} = useColorMode();
  const next = colorMode === 'dark' ? 'light' : 'dark';

  return (
    <div className={clsx(styles.toggle, className)}>
      <button
        className={clsx(
          'clean-btn',
          styles.toggleButton,
          !isBrowser && styles.toggleButtonDisabled,
          buttonClassName,
        )}
        type="button"
        onClick={() => onChange(next)}
        disabled={!isBrowser}
        title={`Switch to ${next} mode`}
        aria-label={`Switch to ${next} mode`}>
        {/* Both icons render; CSS keyed on the html[data-theme] attribute set
            by the pre-hydration script shows the effective one. */}
        <IconLightMode aria-hidden className={clsx(styles.toggleIcon, styles.lightToggleIcon)} />
        <IconDarkMode aria-hidden className={clsx(styles.toggleIcon, styles.darkToggleIcon)} />
      </button>
    </div>
  );
}

export default React.memo(ColorModeToggle);
