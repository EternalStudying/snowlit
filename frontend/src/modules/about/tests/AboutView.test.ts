import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import AboutView from '../AboutView.vue';
import { routes } from '../../../router';

async function mountAboutView() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/about');
  await router.isReady();

  const wrapper = mount(AboutView, {
    global: {
      plugins: [router]
    }
  });

  await flushPromises();
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('关于页星图导览', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('/about 配置为沉浸式路由，登录后布局会隐藏公共外壳和天气背景', () => {
    const route = routes.find((item) => item.path === '/about');

    expect(route?.meta?.immersive).toBe(true);
  });

  it('关于页是独立夜间星图，不再显示旧关于我们内容', async () => {
    const wrapper = await mountAboutView();

    expect(wrapper.find('.about-starmap-page').exists()).toBe(true);
    expect(wrapper.find('.about-starmap__viewport').exists()).toBe(true);
    expect(wrapper.find('.about-starmap__route').exists()).toBe(true);
    expect(wrapper.find('.about-section').exists()).toBe(false);
    expect(wrapper.find('.section-heading').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('About Us');
    expect(wrapper.text()).not.toContain('关于我们');
  });

  it('左下角固定返回首页入口存在并指向首页', async () => {
    const wrapper = await mountAboutView();
    const link = wrapper.get('.about-starmap__return');

    expect(link.text()).toContain('返回首页');
    expect(link.attributes('href')).toBe('/');
  });

  it('五个星点按相册、日记、清单、留言、纪念日展示，并保留半诗意半说明文案', async () => {
    const wrapper = await mountAboutView();
    const stations = wrapper.findAll('.about-starmap__station');

    expect(stations).toHaveLength(5);
    expect(stations.map((station) => station.attributes('data-station'))).toEqual([
      'album',
      'diary',
      'wishes',
      'messages',
      'anniversary'
    ]);
    expect(wrapper.text()).toContain('把某个普通下午，装进不会褪色的相纸里。');
    expect(wrapper.text()).toContain('记录那些没有被拍下来的心情。');
    expect(wrapper.text()).toContain('把想去的地方和想做的事排成星路。');
    expect(wrapper.text()).toContain('轻声说出的话，也应该有地方停靠。');
    expect(wrapper.text()).toContain('有些重要日子，还在等一颗星被正式命名。');
  });

  it('可进入站点是链接，纪念日站点点击后只显示准备中提示', async () => {
    const wrapper = await mountAboutView();

    expect(wrapper.get('[data-station="album"]').attributes('href')).toBe('/album');
    expect(wrapper.get('[data-station="diary"]').attributes('href')).toBe('/diary');
    expect(wrapper.get('[data-station="wishes"]').attributes('href')).toBe('/wishes');
    expect(wrapper.get('[data-station="messages"]').attributes('href')).toBe('/messages');

    const anniversary = wrapper.get('button[data-station="anniversary"]');
    expect(anniversary.attributes('type')).toBe('button');

    await anniversary.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.about-starmap__toast').text()).toContain('纪念日页面还在准备中');
  });

  it('聚焦或触发站点会切换当前说明卡', async () => {
    const wrapper = await mountAboutView();

    expect(wrapper.get('.about-starmap__card').attributes('data-active-station')).toBe('album');

    await wrapper.get('[data-station="messages"]').trigger('focus');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.about-starmap__card').attributes('data-active-station')).toBe('messages');
    expect(wrapper.get('.about-starmap__card').text()).toContain('留言星');
  });
});
