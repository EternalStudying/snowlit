const { formatMonthDay } = require('../../utils/date');

Component({
  properties: {
    moment: {
      type: Object,
      value: {}
    }
  },

  data: {
    dateText: ''
  },

  observers: {
    moment(moment) {
      this.setData({
        dateText: formatMonthDay(moment && (moment.eventTime || moment.createdAt))
      });
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', {
        id: this.data.moment && this.data.moment.id,
        moment: this.data.moment
      });
    }
  }
});
