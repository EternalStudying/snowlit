Component({
  properties: {
    images: {
      type: Array,
      value: []
    },
    columns: {
      type: Number,
      value: 3
    }
  },

  methods: {
    imageUrl(image) {
      if (typeof image === 'string') {
        return image;
      }
      return image && (image.previewUrl || image.url || image.originalUrl) || '';
    },

    handlePreview(event) {
      const index = Number(event.currentTarget.dataset.index || 0);
      const urls = (this.data.images || [])
        .map((image) => this.imageUrl(image))
        .filter(Boolean);
      if (!urls.length || typeof wx === 'undefined') {
        return;
      }
      wx.previewImage({
        current: urls[index],
        urls
      });
    }
  }
});
