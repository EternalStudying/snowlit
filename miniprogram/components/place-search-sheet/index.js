// Choosing a moment's place: search by name (anywhere in the world) or drop a pin on the map.
// The page owns the search request and passes results back in; this component only presents them.
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    // From story-edit-presenter mapPlaceResults: [{ key, name, address, latitude, longitude }].
    results: {
      type: Array,
      value: []
    },
    searching: {
      type: Boolean,
      value: false
    },
    searched: {
      type: Boolean,
      value: false
    },
    message: {
      type: String,
      value: ''
    }
  },

  data: {
    mounted: false,
    query: ''
  },

  observers: {
    visible(visible) {
      if (visible) {
        this.setData({ mounted: true });
        return;
      }
      if (this.data.mounted) {
        setTimeout(() => {
          if (!this.data.visible) {
            this.setData({ mounted: false });
          }
        }, 280);
      }
    }
  },

  methods: {
    noop() {},

    handleCancel() {
      this.triggerEvent('cancel');
    },

    handleInput(event) {
      this.setData({ query: event.detail.value });
    },

    handleSearch() {
      const query = String(this.data.query || '').trim();
      if (!query || this.data.searching) {
        return;
      }
      this.triggerEvent('search', { query });
    },

    handleResultTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      const place = (this.data.results || [])[index];
      if (place) {
        this.triggerEvent('select', { place });
      }
    },

    handleMapTap() {
      this.triggerEvent('map');
    }
  }
});
