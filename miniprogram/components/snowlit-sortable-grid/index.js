Component({
  properties: {
    items: { type: Array, value: [] },
    columns: { type: Number, value: 3 },
    disabled: { type: Boolean, value: false }
  },
  data: { dragLayout: null, scrollOffset: 0 },
  lifetimes: { detached() { this.stopScrolling(); } },
  methods: {
    measureDrag(detail) {
      if (this.data.disabled) return;
      const query = this.createSelectorQuery();
      query.selectAll('.sortable-item').boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((result) => {
        const rects = result[0];
        if (!rects.length) return;
        const windowInfo = wx.getWindowInfo();
        this.scrollTop = result[1].scrollTop;
        this.scrollStart = this.scrollTop;
        this.setData({ scrollOffset: 0, dragLayout: { rects, index: detail.index, columns: this.data.columns,
          viewportHeight: windowInfo.windowHeight, edge: 80 * windowInfo.windowWidth / 750, revision: Date.now() } });
      });
    },
    scrollDirection(detail) {
      if (this.scrollDirectionValue === detail.direction) return;
      this.stopScrolling();
      this.scrollDirectionValue = detail.direction;
      if (!detail.direction) return;
      const step = () => {
        if (this.scrollDirectionValue !== detail.direction) return;
        const previous = this.scrollTop;
        wx.pageScrollTo({ scrollTop: Math.max(0, previous + detail.direction * 12), duration: 0, success: () => {
          const query = this.createSelectorQuery();
          query.selectViewport().scrollOffset();
          query.exec((result) => {
            if (this.scrollDirectionValue !== detail.direction) return;
            this.scrollTop = result[0].scrollTop;
            if (this.scrollTop === previous) { this.stopScrolling(); return; }
            this.setData({ scrollOffset: this.scrollTop - this.scrollStart });
            this.scrollTimer = setTimeout(step, 40);
          });
        } });
      };
      step();
    },
    stopScrolling() { clearTimeout(this.scrollTimer); this.scrollTimer = null; this.scrollDirectionValue = 0; },
    drop(detail) {
      this.stopScrolling();
      if (detail.from !== detail.to) this.triggerEvent('reorder', detail);
    },
    itemTap(detail) { if (!this.data.disabled) this.triggerEvent('itemtap', detail); }
  }
});
