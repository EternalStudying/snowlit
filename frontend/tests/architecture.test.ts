import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAboutRoute } from '../src/modules/about';
import { loadAlbumRoute } from '../src/modules/album';
import { loadDiaryRoute } from '../src/modules/diary';
import { loadHomeRoute } from '../src/modules/home';
import LoginView from '../src/modules/login';
import { loadMessagesRoute } from '../src/modules/messages';
import { loadStoryRoute } from '../src/modules/story';
import SupportCenter from '../src/modules/support';
import WeatherAtmosphere from '../src/modules/weather';
import { loadWishesRoute } from '../src/modules/wishes';
import router from '../src/router';

const sourceModules = import.meta.glob('../src/**/*.{css,ts,vue}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

function readSourceTree(relativeDir: string) {
  return Object.entries(sourceModules)
    .filter(([path]) => path.startsWith(`../${relativeDir}/`))
    .map(([, source]) => source)
    .join('\n');
}

describe('frontend architecture', () => {
  it('功能模块通过公共入口暴露页面和应用壳组件', () => {
    expect(loadAboutRoute).toBeTypeOf('function');
    expect(loadAlbumRoute).toBeTypeOf('function');
    expect(loadDiaryRoute).toBeTypeOf('function');
    expect(loadHomeRoute).toBeTypeOf('function');
    expect(LoginView).toBeTruthy();
    expect(loadMessagesRoute).toBeTypeOf('function');
    expect(loadStoryRoute).toBeTypeOf('function');
    expect(SupportCenter).toBeTruthy();
    expect(WeatherAtmosphere).toBeTruthy();
    expect(loadWishesRoute).toBeTypeOf('function');
  });

  it('通过模块公共加载器配置首页入口和六个独立模块路由', () => {
    expect(router.getRoutes().map((route) => route.path).sort()).toEqual([
      '/',
      '/about',
      '/album',
      '/diary',
      '/messages',
      '/story',
      '/wishes'
    ]);
    expect(router.getRoutes().find(({ path }) => path === '/')?.components?.default).toBe(loadHomeRoute);
    expect(router.getRoutes().find(({ path }) => path === '/story')?.components?.default).toBe(loadStoryRoute);
    expect(router.getRoutes().find(({ path }) => path === '/album')?.components?.default).toBe(loadAlbumRoute);
    expect(router.getRoutes().find(({ path }) => path === '/messages')?.components?.default).toBe(loadMessagesRoute);
    expect(router.getRoutes().find(({ path }) => path === '/diary')?.components?.default).toBe(loadDiaryRoute);
    expect(router.getRoutes().find(({ path }) => path === '/wishes')?.components?.default).toBe(loadWishesRoute);
    expect(router.getRoutes().find(({ path }) => path === '/about')?.components?.default).toBe(loadAboutRoute);
    expect(readFileSync(resolve(process.cwd(), 'src/router.ts'), 'utf8')).not.toContain('View.vue');
  });

  it('Story 视觉组件通过类型化地图边界访问高德 SDK', () => {
    const mapCanvas = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/story/components/StoryMapCanvas.vue'
      ),
      'utf8'
    );
    const editor = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/story/components/MomentEditorDialog.vue'
      ),
      'utf8'
    );
    const globalTypes = readFileSync(
      resolve(process.cwd(), 'src/vite-env.d.ts'),
      'utf8'
    );

    expect(mapCanvas).toContain('../internal/amapSdk');
    expect(mapCanvas).toContain('../internal/storyMapModel');
    expect(editor).toContain('../internal/amapSdk');
    expect(`${mapCanvas}\n${editor}`).not.toContain('window.AMap');
    expect(`${mapCanvas}\n${editor}\n${globalTypes}`).not.toMatch(/\bany\b/);
  });

  it('Journal 路由壳只组合首屏、模块显隐和导航融合边界', () => {
    const shell = readFileSync(
      resolve(process.cwd(), 'src/shell/JournalRouteShell.vue'),
      'utf8'
    );
    const heroExperience = readFileSync(
      resolve(
        process.cwd(),
        'src/shell/useJournalHero.ts'
      ),
      'utf8'
    );
    const motionReveal = readFileSync(
      resolve(
        process.cwd(),
        'src/shell/useMotionReveal.ts'
      ),
      'utf8'
    );
    const navFusion = readFileSync(
      resolve(
        process.cwd(),
        'src/shell/useJournalNavFusion.ts'
      ),
      'utf8'
    );

    expect(shell).toContain('useJournalHero');
    expect(shell).toContain('useMotionReveal');
    expect(shell).toContain('useJournalNavFusion');
    expect(shell).not.toContain('addEventListener(');
    expect(shell).not.toContain('requestAnimationFrame(');
    expect(shell).not.toContain('MutationObserver');
    expect(heroExperience).toContain(
      "window.addEventListener('wheel', handleExpansionWheel"
    );
    expect(motionReveal).toContain('IntersectionObserver');
    expect(navFusion).toContain('preserveNextRouteScrollPosition');
  });

  it('Album 路由视图只组合目录呈现、弹层动效和沉浸式会话边界', () => {
    const view = readFileSync(
      resolve(process.cwd(), 'src/modules/album/AlbumView.vue'),
      'utf8'
    );
    const catalogPresentation = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/album/internal/useAlbumCatalogPresentation.ts'
      ),
      'utf8'
    );
    const dialogMotion = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/album/internal/useAlbumDialogMotion.ts'
      ),
      'utf8'
    );
    const immersiveSession = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/album/internal/useAlbumImmersiveSession.ts'
      ),
      'utf8'
    );

    expect(view).toContain('useAlbumCatalogPresentation');
    expect(view).toContain('useAlbumDialogMotion');
    expect(view).toContain('useAlbumImmersiveSession');
    expect(view).not.toContain("from 'gsap'");
    expect(view).not.toContain('IntersectionObserver');
    expect(view).not.toContain('ResizeObserver');
    expect(view).not.toContain('addEventListener(');
    expect(catalogPresentation).toContain('IntersectionObserver');
    expect(catalogPresentation).toContain('ResizeObserver');
    expect(dialogMotion).toContain("from 'gsap'");
    expect(immersiveSession).toContain(
      "window.addEventListener('keydown'"
    );
  });

  it('生产 TypeScript 和 Vue 源码不使用 any 逃逸类型系统', () => {
    const productionSource = Object.entries(sourceModules)
      .filter(
        ([path]) =>
          !path.includes('/tests/') &&
          (path.endsWith('.ts') || path.endsWith('.vue'))
      )
      .map(([, source]) => source)
      .join('\n');

    expect(productionSource).not.toMatch(/\bany\b/);
  });

  it('不保留只服务旧页面的前端工具和样式', () => {
    const wishStyles = readFileSync(resolve(process.cwd(), 'src/modules/wishes/wishes.css'), 'utf8');
    const paperStyles = readFileSync(resolve(process.cwd(), 'src/modules/home/home-paper.css'), 'utf8');
    const responsiveStyles = readFileSync(resolve(process.cwd(), 'src/styles/99-responsive.css'), 'utf8');
    const homeResponsiveStyles = readFileSync(
      resolve(process.cwd(), 'src/modules/home/home-responsive.css'),
      'utf8'
    );
    const homeStyles = readFileSync(resolve(process.cwd(), 'src/modules/home/home.css'), 'utf8');
    const keyframeStyles = readFileSync(resolve(process.cwd(), 'src/styles/90-keyframes.css'), 'utf8');

    expect(existsSync(resolve(process.cwd(), 'src/utils/date.ts'))).toBe(false);
    expect(wishStyles).not.toMatch(/\.wish-card\b/);
    expect(wishStyles).not.toContain('.wish-badge');
    expect(wishStyles).not.toContain('.wish-action');
    expect(wishStyles).not.toContain('.wish-board__header');
    expect(wishStyles).not.toContain('.wish-board__tape');
    expect(wishStyles).not.toContain('.list-hero__postmark');
    expect(wishStyles).not.toContain('.list-hero__flowers');
    expect(wishStyles).not.toContain('.list-hero__clip');
    expect(wishStyles).not.toContain('.list-hero__heart');
    expect(wishStyles).not.toContain('.list-progress-stamp');
    expect(wishStyles).not.toContain('.list-note-card__stamp');
    expect(paperStyles).not.toContain('.stage-tape');
    expect(paperStyles).not.toContain('.stage-stamp');
    expect(paperStyles).not.toContain('.stage-sticker');
    expect(paperStyles).not.toContain('.paper-clip');
    expect(paperStyles).not.toContain('.paper-piece--note');
    expect(paperStyles).not.toContain('.paper-piece--strip');
    expect(paperStyles).not.toContain('.paper-piece--ticket');
    expect(responsiveStyles).not.toContain('.home-');
    expect(homeResponsiveStyles).not.toContain('finale-grid');
    expect(homeResponsiveStyles).not.toContain('finale-section');
    expect(homeResponsiveStyles).not.toContain('wish-list');
    expect(homeResponsiveStyles).not.toContain('hero-memory-note');
    expect(homeResponsiveStyles).not.toContain('hero-anniversary-capsule');
    expect(homeResponsiveStyles).not.toContain('hero-memory-stack');
    expect(homeResponsiveStyles).not.toContain('hero-heart-spark');
    expect(homeResponsiveStyles).not.toContain('album-grid');
    expect(homeResponsiveStyles).not.toContain('login-lead');
    expect(homeStyles).not.toContain('.memoir-stage');
    expect(homeStyles).not.toContain('.couple-title');
    expect(homeStyles).not.toContain('.hero-stats');
    expect(homeStyles).not.toContain('.stat-slice');
    expect(homeStyles).not.toContain('.hero-memory-note');
    expect(homeStyles).not.toContain('.hero-anniversary-capsule');
    expect(homeStyles).not.toContain('.hero-memory-stack');
    expect(homeStyles).not.toContain('.hero-heart-spark');
    expect(homeStyles).not.toContain('hero-spark-twinkle');
    expect(readFileSync(resolve(process.cwd(), 'src/modules/diary/diary.css'), 'utf8')).not.toContain('.diary-compose__header');
    expect(keyframeStyles).not.toContain('@keyframes title-pop');
    expect(keyframeStyles).not.toContain('@keyframes stat-enter');
    expect(keyframeStyles).not.toContain('@keyframes stat-glow');
    expect(keyframeStyles).not.toContain('@keyframes index-rise');
    expect(keyframeStyles).not.toContain('@keyframes float-tape');
    expect(keyframeStyles).not.toContain('@keyframes float-sticker');
    expect(keyframeStyles).not.toContain('@keyframes story-rise');
    expect(keyframeStyles).not.toContain('@keyframes hero-spark-twinkle');
  });

  it('前端瘦身重构后不保留旧兼容路径、旧组件和无引用资产', () => {
    const removedPaths = [
      'src/api/user.ts',
      'src/types/user.ts',
      'src/types/home.ts',
      'src/components/BackHomeLink.vue',
      'src/assets/story/story-timeline-panel-transparent-full-v1.webp',
      'src/views/AlbumView.vue',
      'src/components/album',
      'src/styles/pages/album.css',
      'src/api/albums.ts',
      'src/types/album.ts',
      'src/composables/useAlbumUploadQueue.ts',
      'src/assets/album-scrapbook',
      'tests/album.test.ts',
      'tests/api.test.ts',
      'tests/user-api.test.ts',
      'src/views/WishesView.vue',
      'src/api/wishes.ts',
      'src/assets/list-design',
      'src/styles/pages/messages-wishes.css',
      'tests/wishes-events.test.ts',
      'src/views/DiaryView.vue',
      'src/api/diary.ts',
      'src/components/diary',
      'src/styles/pages/diary.css',
      'src/assets/diary',
      'tests/diary.test.ts',
      'src/views/StoryView.vue',
      'src/api/story.ts',
      'src/types/story.ts',
      'src/components/story',
      'src/composables/useStoryRouteTransition.ts',
      'src/styles/pages/story.css',
      'src/assets/story',
      'tests/story.test.ts',
      'src/modules/story/components/MomentEditorDrawer.vue',
      'src/views/MessagesView.vue',
      'src/api/messages.ts',
      'src/components/messages',
      'src/composables/useFloatingMessages.ts',
      'src/styles/pages/messages.css',
      'tests/messages.test.ts',
      'src/views/HomeView.vue',
      'src/components/HomeCozyShell.vue',
      'src/api/home.ts',
      'src/composables/useHomeData.ts',
      'src/composables/useHomeMotion.ts',
      'src/config/homeHeroSlides.ts',
      'src/styles/pages/home.css',
      'src/styles/components/home-motion.css',
      'src/styles/04-paper-system.css',
      'src/assets/paper',
      'src/assets/home-hero',
      'src/assets/home-avatars',
      'tests/home-api-integration.test.ts',
      'tests/home-motion.test.ts',
      'tests/home-nav-scroll.test.ts',
      'tests/home-hero-expansion.test.ts',
      'tests/home-album-preview.test.ts',
      'tests/homeData.fixture.ts',
      'src/components/UpdateNoticeFeedback.vue',
      'src/modules/support/UpdateNoticeFeedback.vue',
      'src/modules/support/tests/UpdateNoticeFeedback.test.ts',
      'src/api/feedback.ts',
      'src/api/updateNotice.ts',
      'src/styles/components/update-notice-feedback.css',
      'tests/update-notice-feedback.test.ts',
      'src/views/LoginView.vue',
      'src/api/auth.ts',
      'src/styles/pages/login.css',
      'tests/login.test.ts',
      'tests/auth.test.ts',
      'src/api/weather.ts',
      'src/types/weather.ts',
      'src/composables/useWeatherAtmosphereData.ts',
      'src/components/WeatherAtmosphere.vue',
      'src/components/LegacyWeatherAtmosphere.vue',
      'src/components/SunnyWeatherLayer.vue',
      'src/components/ThreeWeatherLayer.vue',
      'src/styles/components/sunny-weather-layer.css',
      'src/weather',
      'tests/weather-api.test.ts',
      'tests/weather-atmosphere.test.ts',
      'tests/weather-aurora-meteor-system.test.ts',
      'tests/weather-cloud-lighting.test.ts',
      'tests/weather-cloud-profile.test.ts',
      'tests/weather-cloud-system.test.ts',
      'tests/weather-complete-verification.test.ts',
      'tests/weather-controller.test.ts',
      'tests/weather-fog-sprite-port.test.ts',
      'tests/weather-night-sky-system.test.ts',
      'tests/weather-orchestration-profile.test.ts',
      'tests/weather-page-environment.test.ts',
      'tests/weather-performance-hardening.test.ts',
      'tests/weather-renderer.test.ts',
      'tests/weather-sky-profile.test.ts',
      'tests/weather-stage5-effects.test.ts',
      'tests/weather-system-orchestration.test.ts',
      'tests/weather-systems.test.ts',
      'tests/weather-three-skill-complete-verification.test.ts',
      'tests/weather-transition-routes.test.ts',
      'src/views/AboutView.vue',
      'src/styles/pages/about.css',
      'tests/about-starmap.test.ts'
    ];
    const sourceText = readSourceTree('src');
    const wishSourceText = readSourceTree('src/modules/wishes');
    const wishPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/wishes/internal/ports.ts'),
      'utf8'
    );
    const diaryPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/diary/internal/ports.ts'),
      'utf8'
    );
    const storyPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/story/internal/ports.ts'),
      'utf8'
    );
    const messagePorts = readFileSync(
      resolve(process.cwd(), 'src/modules/messages/internal/ports.ts'),
      'utf8'
    );
    const homePorts = readFileSync(
      resolve(process.cwd(), 'src/modules/home/internal/ports.ts'),
      'utf8'
    );
    const supportPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/support/internal/ports.ts'),
      'utf8'
    );
    const loginPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/login/internal/ports.ts'),
      'utf8'
    );
    const weatherPorts = readFileSync(
      resolve(process.cwd(), 'src/modules/weather/internal/ports.ts'),
      'utf8'
    );

    removedPaths.forEach((path) => {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false);
    });
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/wishes/tests/support/memoryWishGateway.ts'
        )
      )
    ).toBe(true);
    expect(wishPorts).not.toContain('createMemoryWishGateway');
    expect(wishPorts).not.toContain('MemoryWishGatewayOptions');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/diary/tests/support/memoryDiaryGateway.ts'
        )
      )
    ).toBe(true);
    expect(diaryPorts).not.toContain('createMemoryDiaryGateway');
    expect(diaryPorts).not.toContain('MemoryDiaryGatewayOptions');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/story/tests/support/memoryStoryGateway.ts'
        )
      )
    ).toBe(true);
    expect(storyPorts).not.toContain('createMemoryStoryGateway');
    expect(storyPorts).not.toContain('MemoryStoryGatewayOptions');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/messages/tests/support/memoryMessageGateway.ts'
        )
      )
    ).toBe(true);
    expect(messagePorts).not.toContain('createMemoryMessageGateway');
    expect(messagePorts).not.toContain('MemoryMessageGatewayOptions');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/home/tests/support/memoryHomeGateway.ts'
        )
      )
    ).toBe(true);
    expect(homePorts).not.toContain('createMemoryHomeGateway');
    expect(homePorts).not.toContain('MemoryHomeGatewayOptions');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/support/tests/support/memorySupportGateway.ts'
        )
      )
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/support/tests/support/memoryNoticeDismissalStore.ts'
        )
      )
    ).toBe(true);
    expect(supportPorts).not.toContain('createMemorySupportGateway');
    expect(supportPorts).not.toContain('MemorySupportGatewayOptions');
    expect(supportPorts).not.toContain('createMemoryNoticeDismissalStore');
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'src/modules/login/tests/support/memoryLoginGateway.ts'
        )
      )
    ).toBe(true);
    expect(loginPorts).not.toContain('createMemoryLoginGateway');
    expect(loginPorts).not.toContain('MemoryLoginGatewayOptions');
    expect(weatherPorts).not.toContain('createMemoryWeatherGateway');
    expect(weatherPorts).not.toContain('MemoryWeatherGatewayOptions');

    [
      '../api/user',
      '../types/user',
      '../types/home',
      'src/api/user',
      'src/types/user',
      'src/types/home',
      'BackHomeLink',
      'story-timeline-panel-transparent-full-v1.webp',
      'views/AlbumView.vue',
      'components/album',
      'styles/pages/album.css',
      '../api/albums',
      '../types/album',
      '../composables/useAlbumUploadQueue',
      'assets/album-scrapbook',
      'views/WishesView.vue',
      '../api/wishes',
      'src/api/wishes',
      'assets/list-design',
      'styles/pages/messages-wishes.css',
      'views/DiaryView.vue',
      '../api/diary',
      'src/api/diary',
      'components/diary',
      'styles/pages/diary.css',
      '../assets/diary/',
      'views/StoryView.vue',
      '../api/story',
      'src/api/story',
      '../types/story',
      'components/story',
      'composables/useStoryRouteTransition',
      'styles/pages/story.css',
      '../assets/story/',
      'MomentEditorDrawer',
      'views/MessagesView.vue',
      '../api/messages',
      'src/api/messages',
      'components/messages',
      'composables/useFloatingMessages',
      'styles/pages/messages.css',
      'views/HomeView.vue',
      'components/HomeCozyShell.vue',
      '../api/home',
      'src/api/home',
      'composables/useHomeData',
      'composables/useHomeMotion',
      'config/homeHeroSlides',
      'styles/pages/home.css',
      'styles/components/home-motion.css',
      'styles/04-paper-system.css',
      'assets/home-hero',
      'components/UpdateNoticeFeedback.vue',
      '../api/feedback',
      'src/api/feedback',
      '../api/updateNotice',
      'src/api/updateNotice',
      'styles/components/update-notice-feedback.css',
      '.update-notice-feedback',
      'views/LoginView.vue',
      '../api/auth',
      'src/api/auth',
      'styles/pages/login.css',
      '../api/weather',
      'src/api/weather',
      '../types/weather',
      'src/types/weather',
      'composables/useWeatherAtmosphereData',
      'styles/components/sunny-weather-layer.css',
      'src/weather/',
      'views/AboutView.vue',
      'styles/pages/about.css',
      'onLogout',
      'fetchDiaryMonths',
      'uploadFeedbackImage',
      'postHomeLocation'
    ].forEach((oldReference) => {
      expect(sourceText).not.toContain(oldReference);
    });

    [
      'ChecklistEvent',
      'checklistEvents',
      'column-event',
      'event-dialog',
      'event-completion',
      'event-image-preview',
      'data-event-id',
      'data-event-key'
    ].forEach((oldWishName) => {
      expect(wishSourceText).not.toContain(oldWishName);
    });
  });
});
