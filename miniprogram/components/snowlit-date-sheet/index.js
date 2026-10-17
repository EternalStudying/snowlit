function pad(value) {
  return String(value).padStart(2, '0');
}

function buildRange(start, end, formatter) {
  const result = [];
  for (let value = start; value <= end; value += 1) {
    result.push(formatter ? formatter(value) : value);
  }
  return result;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseDate(value) {
  const text = String(value || '').trim().replace(/\./g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const [year, month, day] = text.split('-').map((item) => Number(item));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

function todayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
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
      value: '选择日期'
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
    },
    startYear: {
      type: Number,
      value: 2020
    },
    endYear: {
      type: Number,
      value: 2035
    }
  },

  data: {
    mounted: false,
    years: [],
    months: buildRange(1, 12, pad),
    days: buildRange(1, 31, pad),
    pickerValue: [0, 0, 0],
    selectedValue: ''
  },

  observers: {
    'visible,value,startYear,endYear': function onVisibleChange(visible, value) {
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
      const parsed = parseDate(value) || todayParts();
      const minYear = Math.min(Number(this.data.startYear) || 2020, parsed.year);
      const maxYear = Math.max(Number(this.data.endYear) || 2035, parsed.year);
      const years = buildRange(minYear, maxYear);
      const monthDays = buildRange(1, daysInMonth(parsed.year, parsed.month), pad);

      this.setData({
        years,
        days: monthDays,
        pickerValue: [
          Math.max(0, years.indexOf(parsed.year)),
          parsed.month - 1,
          parsed.day - 1
        ],
        selectedValue: `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`
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
      const value = event.detail.value || [0, 0, 0];
      const year = this.data.years[value[0]] || this.data.years[0];
      const month = value[1] + 1;
      const maxDay = daysInMonth(year, month);
      const day = Math.min(value[2] + 1, maxDay);
      const days = buildRange(1, maxDay, pad);

      this.setData({
        days,
        pickerValue: [value[0], value[1], day - 1],
        selectedValue: `${year}-${pad(month)}-${pad(day)}`
      });
    }
  }
});
