Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    // From utils/month-jump buildJumpYears: [{ year, months: [{ month, label, count, disabled, active }] }].
    years: {
      type: Array,
      value: []
    }
  },

  data: {
    mounted: false,
    activeYearAnchor: ''
  },

  observers: {
    visible(visible) {
      if (visible) {
        const years = Array.isArray(this.data.years) ? this.data.years : [];
        const activeYear = years.find((year) => (year.months || []).some((month) => month.active));
        this.setData({
          mounted: true,
          activeYearAnchor: activeYear ? `year-${activeYear.year}` : ''
        });
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

    handleMonthTap(event) {
      const { month, disabled } = event.currentTarget.dataset;
      if (!month || disabled) {
        return;
      }
      this.triggerEvent('select', { month });
    }
  }
});
