function pad(value) {
  return String(value).padStart(2, '0');
}

function buildRange(start, end) {
  const result = [];
  for (let value = start; value <= end; value += 1) {
    result.push(pad(value));
  }
  return result;
}

function parseTime(value) {
  const text = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(text)) {
    return null;
  }
  const [hour, minute] = text.split(':').map((item) => Number(item));
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function currentTimeParts() {
  const now = new Date();
  return {
    hour: now.getHours(),
    minute: now.getMinutes()
  };
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '选择时间'
    },
    value: {
      type: String,
      value: ''
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    confirmText: {
      type: String,
      value: '确定'
    }
  },

  data: {
    mounted: false,
    hours: buildRange(0, 23),
    minutes: buildRange(0, 59),
    pickerValue: [0, 0],
    selectedValue: ''
  },

  observers: {
    'visible,value': function onVisibleChange(visible, value) {
      if (visible) {
        this.prepare(value);
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

    prepare(value) {
      const parsed = parseTime(value) || currentTimeParts();
      this.setData({
        pickerValue: [parsed.hour, parsed.minute],
        selectedValue: `${pad(parsed.hour)}:${pad(parsed.minute)}`
      });
    },

    handleCancel() {
      this.triggerEvent('cancel');
    },

    handleConfirm() {
      this.triggerEvent('confirm', {
        value: this.data.selectedValue
      });
    },

    handleChange(event) {
      const value = event.detail.value || [0, 0];
      const hour = Math.max(0, Math.min(23, Number(value[0]) || 0));
      const minute = Math.max(0, Math.min(59, Number(value[1]) || 0));
      this.setData({
        pickerValue: [hour, minute],
        selectedValue: `${pad(hour)}:${pad(minute)}`
      });
    }
  }
});
