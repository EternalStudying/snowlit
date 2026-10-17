import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  const absolutePath = resolve(process.cwd(), path);

  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

function expectFixedStickerToHideWithHero(styles: string, className: string) {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  expect(styles).toMatch(
    new RegExp(`${escapedClassName}\\s*{[\\s\\S]*opacity:\\s*1;[\\s\\S]*transition:[\\s\\S]*opacity\\s+220ms\\s+ease`)
  );
  expect(styles).toMatch(
    new RegExp(
      `\\.home-cozy-shell\\[data-hero-immersive="true"\\]\\s+${escapedClassName}\\s*{[\\s\\S]*opacity:\\s*0;[\\s\\S]*pointer-events:\\s*none;[\\s\\S]*transform:`
    )
  );
  expect(styles).toMatch(
    new RegExp(`@media \\(prefers-reduced-motion:\\s*reduce\\)\\s*{[\\s\\S]*${escapedClassName}[\\s\\S]*transition:\\s*none`)
  );
}

function readRule(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return styles.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*{[^}]*}`))?.[0] ?? '';
}

function readLastRule(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = Array.from(styles.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*{[^}]*}`, 'g')));

  return matches.at(-1)?.[0] ?? '';
}

function expectUnifiedPageBackground(rule: string) {
  expect(rule).toContain('--page-bg-base: var(--snow-ground);');
  expect(rule).toContain('--page-bg-accent-rgb:');
  expect(rule).toContain('--page-bg-warm-rgb:');
  expect(rule).toContain('--page-bg-dot-rgb:');
  expect(rule).toContain('background: var(--page-bg-root);');
  expect(rule).toContain('background-size: var(--page-bg-root-size);');
}

describe('首页正式动效', () => {
  it('删除 playground 调试入口和调试配置', () => {
    expect(fileExists('src/components/motion/MotionPlaygroundPanel.vue')).toBe(false);
    expect(fileExists('src/composables/useMotionPlayground.ts')).toBe(false);
    expect(fileExists('src/types/motionPlayground.ts')).toBe(false);

    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const homeSource = readSource('src/modules/home/HomeView.vue');
    const stylesSource = readSource('src/styles.css');
    const combinedSource = `${shellSource}\n${homeSource}\n${stylesSource}`;

    expect(combinedSource).not.toMatch(/MotionPlayground|motionPlayground|MOTION_PLAYGROUND/);
    expect(combinedSource).not.toMatch(/downloadMotionConfig|localStorage|motionPlayground=1/);
    expect(stylesSource).not.toContain('motion-playground.css');
  });

  it('首页默认启用第一套温柔手账感动效', () => {
    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const homeSource = readSource('src/modules/home/HomeView.vue');
    const composableSource = readSource('src/modules/home/internal/useHomeMotion.ts');
    const revealSource = readSource(
      'src/modules/home/internal/useHomeMotionReveal.ts'
    );

    expect(fileExists('src/modules/home/home-motion.css')).toBe(true);
    expect(shellSource).toContain("import './home-motion.css'");
    expect(shellSource).toContain('useHomeMotion');
    expect(shellSource).toContain('v-bind="motionRootAttrs"');
    expect(shellSource).toContain(':style="shellStyle"');
    expect(shellSource).toContain('motionRootStyle.value');
    expect(shellSource).toContain('data-motion-module="hero"');
    expect(revealSource).toContain('IntersectionObserver');
    expect(homeSource).toContain('useHomeMotion');
    expect(homeSource).toContain(':enabled="isCountUpEnabled"');
    expect(composableSource).toContain("'data-home-motion': 'warm-journal'");
    expect(composableSource).toContain("'--motion-stagger': '105ms'");
    expect(composableSource).toContain("'--motion-softness': '0.82'");
    expect(composableSource).toContain("'--motion-float-intensity': '0.32'");
    expect(composableSource).toContain("'--motion-scale-intensity': '0.28'");
  });

  it('保留首页模块入场、漂移、纸张浮动、贴纸轻弹和减少动态降级', () => {
    const homeSource = readSource('src/modules/home/HomeView.vue');
    const motionStyles = readSource('src/modules/home/home-motion.css');

    expect(homeSource).toContain('MotionCountUp');
    expect(homeSource).toContain('progressLedgerCountUpStarted');
    expect(homeSource).toContain('@animationend="handleProgressLedgerRevealEnd"');
    expect(homeSource).toContain('@load="markProgressLedgerBackgroundReady"');
    expect(homeSource).toContain(':start="progressLedgerCountUpStarted || !isCountUpEnabled"');
    expect(homeSource).toContain('data-motion-module="memoryCard"');
    expect(homeSource).toContain('data-motion-module="dailyNote"');
    expect(homeSource).toContain('data-motion-module="statusCards"');
    expect(homeSource).toContain('data-motion-module="progressLedger"');
    expect(homeSource).toContain('data-motion-module="recentCards"');
    expect(homeSource).toContain('data-motion-module="nextPlan"');
    expect(motionStyles).toContain('.home-cozy-shell[data-home-motion="warm-journal"]');
    expect(motionStyles).toContain('--motion-reveal-y: 12px');
    expect(motionStyles).toContain('--motion-drift-scale: 0.018');
    expect(motionStyles).toContain('home-motion-module-reveal');
    expect(motionStyles).toContain('home-motion-image-drift');
    expect(motionStyles).toContain('home-motion-paper-float');
    expect(motionStyles).toContain('home-motion-sticker-pop');
    expect(motionStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(motionStyles).not.toContain('cinematic-opening');
    expect(motionStyles).not.toContain('playful-heartbeat');
  });

  it('今日小纸条和纪念日卡片在进入视口后使用 GSAP 编排纸张入场动画', () => {
    const homeSource = readSource('src/modules/home/HomeView.vue');
    const paperIntroSource = readSource(
      'src/modules/home/internal/useHomePaperIntro.ts'
    );

    expect(homeSource).toContain('useHomePaperIntro');
    expect(homeSource).toContain(":ref=\"paperIntroRef('memoryCard')\"");
    expect(homeSource).toContain(":ref=\"paperIntroRef('dailyNote')\"");
    expect(paperIntroSource).toContain("import { gsap } from 'gsap'");
    expect(paperIntroSource).toContain('MutationObserver');
    expect(paperIntroSource).toContain("attributeFilter: ['data-motion-visible']");
    expect(paperIntroSource).toContain('gsap.context');
    expect(paperIntroSource).toContain('gsap.timeline');
    expect(paperIntroSource).toContain(
      "window.matchMedia?.('(prefers-reduced-motion: reduce)')"
    );
    expect(paperIntroSource).toContain('onBeforeUnmount(stop)');
    expect(paperIntroSource).toContain('.home-memory-card__line');
    expect(paperIntroSource).toContain('.daily-note-card__sentence');
  });

  it('首页其余内容模块进入视口后也使用 GSAP 分层入场动画', () => {
    const homeSource = readSource('src/modules/home/HomeView.vue');
    const paperIntroSource = readSource(
      'src/modules/home/internal/useHomePaperIntro.ts'
    );

    expect(homeSource).toContain(":ref=\"paperIntroRef('statusCards')\"");
    expect(homeSource).toContain(":ref=\"paperIntroRef('progressLedger')\"");
    expect(homeSource).toContain(":ref=\"paperIntroRef('recentCards')\"");
    expect(homeSource).toContain(":ref=\"paperIntroRef('nextPlan')\"");
    expect(paperIntroSource).toContain('playStatusCardsIntro');
    expect(paperIntroSource).toContain('playProgressLedgerIntro');
    expect(paperIntroSource).toContain('playRecentCardsIntro');
    expect(paperIntroSource).toContain('playNextPlanIntro');
    expect(paperIntroSource).toContain('.status-person-card');
    expect(paperIntroSource).toContain('.progress-stat-card');
    expect(paperIntroSource).toContain('.recent-paper-item');
    expect(paperIntroSource).toContain('.next-plan-strip__content > div');
  });

  it('首页模块完整进入视口后触发，并统一每段内容的入场时间', () => {
    const revealSource = readSource(
      'src/modules/home/internal/useHomeMotionReveal.ts'
    );
    const motionStyles = readSource('src/modules/home/home-motion.css');

    expect(revealSource).toContain("rootMargin: '0px 0px 0px 0px'");
    expect(revealSource).toContain('threshold: 1');
    expect(motionStyles).toContain('home-motion-module-reveal calc(680ms * var(--motion-duration-scale, 1))');
    expect(motionStyles).not.toMatch(/animation-delay:\s*calc\(var\(--motion-stagger[\s\S]*--motion-module-index/);
    expect(motionStyles).toMatch(/@keyframes home-motion-module-reveal\s*{[\s\S]*from\s*{[\s\S]*opacity:\s*0;/);
  });

  it('保留首屏雪坡扩散的状态、控件、CSS 变量和减少动态降级', () => {
    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const heroSource = readSource(
      'src/modules/home/internal/useHomeHeroExperience.ts'
    );
    const homeStyles = readSource('src/modules/home/home.css');
    const motionStyles = readSource('src/modules/home/home-motion.css');

    expect(fileExists('src/modules/home/tests/JournalRouteShellHero.test.ts')).toBe(true);
    expect(heroSource).toContain('expansionProgress');
    expect(shellSource).toContain('isHeroExpanded');
    expect(heroSource).toContain('handleExpansionWheel');
    expect(heroSource).toContain('HERO_EXPANSION_INTENT_THRESHOLD = 240');
    expect(shellSource).toContain('showPreviousHeroSlide');
    expect(heroSource).not.toContain('HERO_EXPANSION_PREVIEW_PROGRESS');
    expect(shellSource).toContain('data-hero-immersive');
    expect(shellSource).toContain('data-hero-expanded');
    expect(heroSource).toContain('--hero-expansion-progress');
    expect(heroSource).toContain('--hero-snow-opacity');
    expect(shellSource).toContain('home-hero-arrow--prev');
    expect(shellSource).toContain('home-hero-arrow--next');
    expect(shellSource).toContain('home-hero-arrow__glyph');
    expect(shellSource).toContain('上一张首屏图片');
    expect(shellSource).toContain('下一张首屏图片');
    expect(heroSource).toContain('!isImmersive.value');

    expect(homeStyles).toContain('.home-cozy-shell[data-hero-immersive="true"]');
    expect(homeStyles).toContain('--hero-expansion-progress');
    expect(homeStyles).toContain('--hero-snow-opacity');
    expect(homeStyles).toContain('opacity: var(--hero-snow-opacity)');
    expect(homeStyles).toContain('.home-hero-arrow');
    expect(homeStyles).toContain('.home-hero-arrow__glyph');
    expect(homeStyles).toContain('.home-cozy-nav.is-hero-hidden');
    expect(homeStyles).toContain('opacity 560ms');
    expect(homeStyles).toContain('.home-cozy-stage .home-hero-slide {');
    expect(homeStyles).toContain('transform: scale(var(--hero-image-scale))');
    expect(homeStyles).toContain('animation-play-state: paused');
    expect(homeStyles).toContain('scaleY(calc(1 +');
    expect(homeStyles).toContain('translateY(calc(');
    expect(homeStyles).toContain('@media (prefers-reduced-motion: reduce)');

    expect(motionStyles).toContain('[data-hero-immersive="true"]');
  });

  it('首屏退出沉浸态时头像和爱心缩放使用常驻过渡，避免恢复跳动', () => {
    const homeStyles = readSource('src/modules/home/home.css');

    expect(homeStyles).toMatch(
      /\.home-cozy-stage\s+\.home-hero-content\s*{[\s\S]*transform:\s*translateY\(calc\(8px - 18px \* var\(--hero-expansion-progress\)\)\);[\s\S]*transition:\s*transform var\(--hero-expansion-duration\) var\(--hero-expansion-ease\);/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-stage\s+\.hero-sticker-cluster\s*{[\s\S]*transform:\s*scale\(var\(--hero-sticker-scale\)\);[\s\S]*transition:[\s\S]*transform var\(--hero-expansion-duration\) var\(--hero-expansion-ease\),[\s\S]*gap 320ms ease;/
    );
    expect(homeStyles).not.toContain(
      '.home-cozy-shell[data-hero-immersive="true"] .home-cozy-stage .home-hero-content {'
    );
    expect(homeStyles).not.toContain(
      '.home-cozy-shell[data-hero-immersive="true"] .home-cozy-stage .hero-sticker-cluster {'
    );
  });

  it('首页导航使用 idle/docked 二态融合与标签/密度二段动画契约', () => {
    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const navFusionSource = readSource(
      'src/modules/home/internal/useJournalNavFusion.ts'
    );
    const topbarSource = readSource('src/components/AppTopBar.vue');
    const homeStyles = readSource('src/modules/home/home.css');
    const appShellStyles = readSource('src/styles/02-app-shell.css');
    const responsiveStyles = readSource('src/modules/home/home-responsive.css');
    const motionSource = readSource('src/modules/home/internal/useHomeMotion.ts');
    const routerSource = readSource('src/router.ts');

    expect(navFusionSource).toContain('navFusionProgress');
    expect(navFusionSource).toContain('requestNavFusionUpdate');
    expect(shellSource).toContain('data-nav-fusion');
    expect(shellSource).toContain('data-nav-labels');
    expect(shellSource).toContain('data-nav-density');
    expect(shellSource).toContain('data-nav-restoring');
    expect(shellSource).toContain('data-nav-compact');
    expect(navFusionSource).toContain('--nav-fusion-progress');
    expect(navFusionSource).toContain('--nav-fusion-top');
    expect(navFusionSource).toContain('--nav-fusion-left');
    expect(navFusionSource).toContain('--nav-fusion-width');
    expect(navFusionSource).toContain('--nav-restore-y');
    expect(navFusionSource).toContain('route.path');
    expect(navFusionSource).toContain('NAV_FUSION_EXIT_BUFFER = 12');
    expect(navFusionSource).toContain('NAV_DOCKED_NAV_HEIGHT = 58');
    expect(navFusionSource).toContain('anchorCenterY <= topbarCenterY');
    expect(navFusionSource).toContain(
      'topbarCenterY + NAV_FUSION_EXIT_BUFFER'
    );
    expect(navFusionSource).toContain('NAV_LABEL_PHASE_MS = 200');
    expect(navFusionSource).toContain('NAV_DENSITY_PHASE_MS = 200');
    expect(navFusionSource).toContain('NAV_RESTORE_DROP_MS = 260');
    expect(navFusionSource).not.toContain("return 'fusing'");
    expect(navFusionSource).not.toContain('NAV_FUSION_DISTANCE');
    expect(navFusionSource).not.toContain('home-nav-dock-clone');

    expect(topbarSource).toContain('app-topbar__brand');
    expect(topbarSource).toContain('Snowlit');

    expect(appShellStyles).toContain('.app-topbar__brand');
    expect(appShellStyles).toMatch(/\.app-topbar__inner\s*{[\s\S]*justify-content:\s*center;/);
    expect(appShellStyles).toContain('"Lobster"');
    expect(appShellStyles).not.toContain('app-topbar__brand-text::after');
    expect(appShellStyles).toMatch(
      /body:has\(\.home-cozy-nav\[data-nav-fusion="docked"\]\)\s+\.app-topbar__brand/
    );
    expect(topbarSource).toContain('app-topbar__dock-motion');
    expect(topbarSource).toContain('class="app-topbar__weather-summary app-topbar__dock-motion"');
    expect(appShellStyles).toMatch(
      /\.app-topbar__dock-motion\s*{[\s\S]*opacity:\s*0;[\s\S]*visibility:\s*hidden;[\s\S]*pointer-events:\s*none;[\s\S]*transform:\s*translateY\(calc\(-50% - 4px\)\)\s*scale\(0\.96\);[\s\S]*transition:[\s\S]*opacity 180ms ease,[\s\S]*visibility 180ms ease,[\s\S]*transform 220ms cubic-bezier\(0\.645,\s*0\.045,\s*0\.355,\s*1\);/
    );
    expect(appShellStyles).toMatch(
      /body:has\(\.home-cozy-nav\[data-nav-fusion="docked"\]\)\s+\.app-topbar__dock-motion\s*{[\s\S]*opacity:\s*1;[\s\S]*visibility:\s*visible;[\s\S]*pointer-events:\s*auto;[\s\S]*transform:\s*translateY\(-50%\)\s*scale\(1\);/
    );
    expect(appShellStyles).toContain('data-nav-restoring="true"]) .app-topbar__dock-motion');
    expect(appShellStyles).not.toContain('transition-duration: 0ms');
    expect(appShellStyles).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\.app-topbar__dock-motion,[\s\S]*transition:\s*none;/
    );
    expect(appShellStyles).not.toContain('data-nav-fusion="fusing"');
    expect(homeStyles).toContain('.home-cozy-nav::after');
    expect(homeStyles).toContain('top: var(--nav-fusion-top');
    expect(homeStyles).toContain('left: var(--nav-fusion-left');
    expect(homeStyles).toContain('width: var(--nav-fusion-width');
    expect(homeStyles).toContain('.home-cozy-nav[data-nav-restoring="true"]');
    expect(homeStyles).toContain('transform: translate3d(0, var(--nav-restore-y');
    expect(homeStyles).toContain('.home-cozy-nav[data-nav-labels="hiding"]');
    expect(homeStyles).toContain('.home-cozy-nav[data-nav-density="compacting"]');
    expect(homeStyles).toContain('.home-cozy-nav[data-nav-density="compact"]');
    expect(homeStyles).toContain('.home-cozy-nav[data-nav-compact="true"]');
    expect(homeStyles).toContain('.home-cozy-nav__label');
    expect(homeStyles).not.toContain('.home-cozy-nav__link::after');
    expect(homeStyles).not.toContain('data-nav-fusion="fusing"');
    expect(homeStyles).not.toContain('calc(-58px * var(--nav-fusion-progress))');
    const baseNavBlock = homeStyles.match(/\.home-cozy-nav\s*{([^}]*)}/)?.[1] ?? '';
    expect(baseNavBlock).toContain('z-index: 46;');
    expect(homeStyles).toMatch(
      /\.home-cozy-nav\[data-nav-fusion="docked"\]\s*{[\s\S]*position:\s*fixed;[\s\S]*top:\s*var\(--nav-fusion-top,[\s\S]*left:\s*var\(--nav-fusion-left,[\s\S]*width:\s*var\(--nav-fusion-width,[\s\S]*min-height:\s*58px;/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-nav\[data-nav-fusion="docked"\]\s*{[\s\S]*z-index:\s*46;/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-nav\[data-nav-fusion="docked"\]\s+\.paper-nav-shell__content\s*{[\s\S]*min-height:\s*58px;[\s\S]*padding-block:\s*10px;/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-nav__link\s*{[\s\S]*transition:[\s\S]*min-width 200ms cubic-bezier\(0\.645,\s*0\.045,\s*0\.355,\s*1\),[\s\S]*width 200ms cubic-bezier\(0\.645,\s*0\.045,\s*0\.355,\s*1\),[\s\S]*padding 200ms cubic-bezier\(0\.645,\s*0\.045,\s*0\.355,\s*1\),[\s\S]*gap 200ms cubic-bezier\(0\.645,\s*0\.045,\s*0\.355,\s*1\)/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-nav__label\s*{[\s\S]*max-width:\s*3\.5em;[\s\S]*transition:[\s\S]*opacity 200ms ease,[\s\S]*filter 200ms ease,[\s\S]*transform 200ms ease;/
    );
    expect(homeStyles).not.toContain('scaleX(calc(1 - 0.18 * var(--nav-fusion-progress)))');
    const dockedNavBlock = homeStyles.match(/\.home-cozy-nav\[data-nav-fusion="docked"\]\s*{([^}]*)}/)?.[1] ?? '';
    expect(dockedNavBlock).not.toContain('left: 50%');
    expect(dockedNavBlock).not.toContain('translateX');
    expect(homeStyles).not.toContain('transform 220ms cubic-bezier');
    expect(responsiveStyles).toMatch(
      /\.home-cozy-nav\[data-nav-fusion="docked"\]\s*{[\s\S]*width:\s*var\(--nav-fusion-width,[\s\S]*margin-top:\s*0;[\s\S]*padding:\s*0;[\s\S]*justify-content:\s*center;[\s\S]*overflow-x:\s*visible;/
    );
    expect(homeStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(homeStyles).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\.home-cozy-nav__link\s*{[\s\S]*transition:\s*none;/
    );
    expect(homeStyles).not.toMatch(/\.home-cozy-nav__label[^{]*{[^}]*display:\s*none/);

    expect(topbarSource).not.toContain('LG Demo');
    expect(topbarSource).not.toContain('app-topbar__brand-mark');
    expect(topbarSource).not.toContain('app-topbar__quote');
    expect(appShellStyles).toMatch(/\.app-topbar\s*{[\s\S]*z-index:\s*45;/);
    expect(appShellStyles).not.toContain('app-topbar__quote');
    expect(appShellStyles).not.toMatch(/home-nav-dock|is-home-nav-docking|is-home-nav-docked/);
    expect(motionSource).not.toContain('navDock');
    expect(routerSource).not.toContain('homeCozyNavScrollBehavior');
  });

  it('普通态导航上边缘与首屏雪坡上沿红线位置平齐', () => {
    const homeStyles = readSource('src/modules/home/home.css');

    expect(homeStyles).toContain('--cozy-snow-slope-height: clamp(48px, 4.2vw, 72px);');
    expect(homeStyles).toContain('--cozy-snow-valley-depth: clamp(14px, 1.26vw, 22px);');
    expect(homeStyles).toContain('--cozy-snow-edge-depth: clamp(42px, 3.67vw, 63px);');
    expect(homeStyles).toContain('--cozy-snow-lift: clamp(30px, 2.55vw, 36px);');
    expect(homeStyles).toContain('--cozy-snow-tangent-adjust: 10px');
    expect(homeStyles).toContain('--cozy-nav-height: 70px');
    expect(homeStyles).toContain(
      '--cozy-nav-offset: calc(var(--cozy-snow-tangent-adjust) - var(--cozy-snow-lift) - var(--cozy-snow-edge-depth));'
    );
    expect(homeStyles).toContain(
      '--cozy-boundary-top: calc(var(--cozy-hero-height) - var(--cozy-snow-lift) - 12px);'
    );
    expect(homeStyles).toContain('bottom: calc(var(--cozy-snow-lift) - 1px);');
    expect(homeStyles).not.toContain(
      '--cozy-nav-offset: calc(0px - var(--cozy-snow-valley-depth) - var(--cozy-nav-height));'
    );
  });

  it('首页公共导航使用共享 active 轨道做内部路由状态过渡', () => {
    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const navFusionSource = readSource(
      'src/modules/home/internal/useJournalNavFusion.ts'
    );
    const homeStyles = readSource('src/modules/home/home.css');
    const activeTrackBlock = homeStyles.match(/\.home-cozy-nav__active-track\s*{([^}]*)}/)?.[1] ?? '';

    expect(shellSource).toContain('home-cozy-nav__active-track');
    expect(navFusionSource).toContain('--nav-active-x');
    expect(navFusionSource).toContain('--nav-active-width');
    expect(navFusionSource).toContain('--nav-active-opacity');
    expect(navFusionSource).toContain('--nav-switch-glow-x');

    expect(activeTrackBlock).toContain('transform: translate3d(var(--nav-active-x');
    expect(activeTrackBlock).toContain('width: var(--nav-active-width');
    expect(activeTrackBlock).toContain('opacity: var(--nav-active-opacity');
    expect(activeTrackBlock).toContain('width 300ms cubic-bezier');
    const activeTrackSettlingBlock =
      homeStyles.match(/\.home-cozy-nav\[data-nav-active-settling="true"\]\s+\.home-cozy-nav__active-track\s*{([^}]*)}/)?.[1] ??
      '';
    expect(activeTrackSettlingBlock).not.toContain('transition: none');
  });

  it('首页导航 route switch 动效不新增页面内容切换动画', () => {
    const homeStyles = readSource('src/modules/home/home.css');
    const routeContentBlock = homeStyles.match(/\.home-route-content\s*{([^}]*)}/)?.[1] ?? '';

    expect(homeStyles).not.toMatch(/home-route-content-(enter|leave|switch)/);
    expect(homeStyles).not.toMatch(/route-switch-(enter|leave|active)/);
    expect(routeContentBlock).not.toContain('transition:');
    expect(routeContentBlock).not.toContain('animation:');
  });

  it('首页导航 active 轨道和暖光扫过支持减少动态降级', () => {
    const homeStyles = readSource('src/modules/home/home.css');

    expect(homeStyles).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\.home-cozy-nav__active-track\s*{[\s\S]*transition:\s*none\s*!important;/
    );
    expect(homeStyles).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\.home-cozy-nav\[data-nav-switching="true"\]\s+\.paper-nav-shell__content::after\s*{[\s\S]*animation:\s*none\s*!important;/
    );
  });

  it('雪坡下方普通导航页面使用统一雪坡根背景且不影响特殊页面', () => {
    const tokens = readSource('src/styles/00-tokens.css');
    const stylesSource = readSource('src/styles.css');
    const pageBackgroundStyles = readSource('src/styles/05-page-background.css');
    const homeStyles = readSource('src/modules/home/home.css');
    const albumStyles = readSource('src/modules/album/album.css');
    const diaryStyles = readSource('src/modules/diary/diary.css');
    const wishStyles = readSource('src/modules/wishes/wishes.css');
    const messagesStyles = readSource('src/modules/messages/messages.css');
    const loginStyles = readSource('src/modules/login/login.css');
    const aboutStyles = readSource('src/modules/about/about.css');
    const storyStyles = readSource('src/modules/story/story.css');
    const albumPageRule = readRule(albumStyles, '.album-page');
    const diaryPageRule = readRule(diaryStyles, '.diary-page');
    const listPageRule = readRule(wishStyles, '.list-page');
    const messagesPageRule = readLastRule(messagesStyles, '.messages-page');

    expect(tokens).toContain('--snow-ground: #fff8ee;');
    expect(tokens).toContain('--snow-ground-rgb: 255, 248, 238;');
    expect(tokens).toContain('--page-bg-root:');
    expect(tokens).toContain('--page-bg-pattern:');
    expect(tokens).toContain('--page-bg-paper-texture:');
    expect(stylesSource).toContain('05-page-background.css');
    expect(pageBackgroundStyles).toMatch(/\.album-page,[\s\S]*\.messages-page\s*{[\s\S]*--page-bg-root:/);
    expect(homeStyles).toContain('var(--snow-ground)');
    expect(homeStyles).toMatch(/\.home-route-content\s*{[\s\S]*background:[\s\S]*var\(--snow-ground\);/);
    expect(homeStyles).toMatch(
      /\.home-route-content::before\s*{[\s\S]*top:\s*calc\(-1 \* \(var\(--cozy-snow-valley-depth\) \+ 18px\)\);[\s\S]*height:\s*calc\(var\(--cozy-snow-valley-depth\) \+ 19px\);[\s\S]*var\(--snow-ground\);/
    );
    expect(homeStyles).toMatch(
      /\.home-cozy-stage:has\(>\s*\.home-route-content\s*>\s*\.album-page\),[\s\S]*\.home-cozy-stage:has\(>\s*\.home-route-content\s*>\s*\.messages-page\)\s*{[\s\S]*padding-bottom:\s*0;/
    );
    [albumPageRule, diaryPageRule, listPageRule, messagesPageRule].forEach(expectUnifiedPageBackground);
    expect(albumStyles).toMatch(/\.album-page::before\s*{[\s\S]*background:\s*var\(--page-bg-paper-texture\);/);
    expect(diaryStyles).toMatch(/\.diary-page::before\s*{[\s\S]*background:\s*var\(--page-bg-paper-texture\);/);
    expect(wishStyles).toMatch(/\.list-page::before\s*{[\s\S]*background:\s*var\(--page-bg-paper-texture\);/);
    expect(messagesStyles).toMatch(/\.messages-page::before\s*{[\s\S]*background:\s*var\(--page-bg-paper-texture\);/);
    expect(messagesPageRule).toContain('--messages-fusion-top-offset: 64px;');
    expect(messagesPageRule).toContain('height: calc(100vh - var(--messages-fusion-top-offset));');
    expect(messagesPageRule).toContain('overflow: hidden;');
    expect(loginStyles).not.toContain('--snow-ground');
    expect(loginStyles).not.toContain('--page-bg-root');
    expect(aboutStyles).not.toContain('--snow-ground');
    expect(aboutStyles).not.toContain('--page-bg-root');
    expect(storyStyles).not.toContain('--snow-ground');
    expect(storyStyles).not.toContain('--page-bg-root');
    expect(albumStyles).toMatch(/\.album-immersive-gallery\s*{[\s\S]*background:\s*#000;/);
  });

  it('首屏放大后切图圆点停在图片下方的画面内位置', () => {
    const homeStyles = readSource('src/modules/home/home.css');

    expect(homeStyles).toMatch(
      /\.home-cozy-shell\[data-hero-expanded="true"\]\s+\.home-cozy-stage\s+\.home-hero-dots\s*{[\s\S]*bottom:\s*max\(clamp\(64px,\s*8vh,\s*96px\),\s*calc\(env\(safe-area-inset-bottom,\s*0px\) \+ 54px\)\);/
    );
  });

  it('首屏放大后切图圆点不再显示半透明椭圆底板', () => {
    const homeStyles = readSource('src/modules/home/home.css');
    const expandedDotsBlock =
      homeStyles.match(
        /\.home-cozy-shell\[data-hero-expanded="true"\]\s+\.home-cozy-stage\s+\.home-hero-dots\s*{([^}]*)}/
      )?.[1] ?? '';

    expect(expandedDotsBlock).toContain('padding: 0;');
    expect(expandedDotsBlock).toContain('background: transparent;');
    expect(expandedDotsBlock).toContain('box-shadow: none;');
    expect(expandedDotsBlock).toContain('backdrop-filter: none;');
  });

  it('首屏沉浸态隐藏导航锚点不再拦截底部圆点点击', () => {
    const homeStyles = readSource('src/modules/home/home.css');

    expect(homeStyles).toMatch(
      /\.home-cozy-shell\[data-hero-immersive="true"\]\s+\.home-cozy-nav-anchor\s*{[\s\S]*pointer-events:\s*none;/
    );
  });

  it('首屏沉浸态隐藏固定新增贴纸，恢复后再过渡出现', () => {
    const diaryStyles = readSource('src/modules/diary/diary.css');
    const albumStyles = readSource('src/modules/album/album.css');
    const wishStyles = readSource('src/modules/wishes/wishes.css');

    expectFixedStickerToHideWithHero(diaryStyles, '.diary-compose-fab');
    expectFixedStickerToHideWithHero(albumStyles, '.album-create-fab');
    expectFixedStickerToHideWithHero(wishStyles, '.wish-create-fab');
  });

  it('首屏放大态头像和中心爱心互动动画只在 expanded 状态启用并支持减少动态', () => {
    const shellSource = readSource('src/modules/home/JournalRouteShell.vue');
    const heroSource = readSource(
      'src/modules/home/internal/useHomeHeroExperience.ts'
    );
    const homeStyles = readSource('src/modules/home/home.css');

    expect(shellSource).toContain('activeHeroStickerSide');
    expect(shellSource).toContain('heroBurstParticles');
    expect(shellSource).toContain('triggerHeroStickerInteraction');
    expect(heroSource).toContain('resetStickerInteraction');
    expect(shellSource).toContain('data-heart-target');
    expect(shellSource).toContain('data-hero-sync-pulse');
    expect(shellSource).toContain('hero-heart-burst-particle');
    expect(shellSource).toContain('@keydown.enter.prevent');
    expect(shellSource).toContain('@keydown.space.prevent');

    expect(homeStyles).toContain('.home-cozy-shell[data-hero-expanded="true"] .hero-person-sticker');
    expect(homeStyles).toContain('.home-cozy-shell[data-hero-expanded="true"] .hero-center-heart');
    expect(homeStyles).toContain('[data-motion-sticker-pop="true"]');
    expect(homeStyles).toMatch(
      /\.home-cozy-shell\[data-hero-expanded="true"\]\[data-home-motion="warm-journal"\]\[data-motion-sticker-pop="true"\][\s\S]*\.hero-center-heart\s*{[\s\S]*animation:\s*none;/
    );
    expect(homeStyles).toContain('[data-heart-target="left"]');
    expect(homeStyles).toContain('[data-heart-target="right"]');
    expect(homeStyles).toContain('[data-hero-heart-beating="true"]');
    expect(homeStyles).toContain('[data-hero-sync-pulse="true"]');
    expect(homeStyles).toContain('@keyframes hero-avatar-soft-breathe');
    expect(homeStyles).toContain('@keyframes hero-heart-burst-fly');
    expect(homeStyles).toContain('@keyframes hero-sync-warm-glow');
    expect(homeStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.hero-heart-burst-particle[\s\S]*display:\s*none;/
    );
  });
});
