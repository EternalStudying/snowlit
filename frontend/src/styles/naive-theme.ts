import type { GlobalThemeOverrides } from 'naive-ui';

export const snowlitNaiveTheme: GlobalThemeOverrides = {
  common: {
    fontFamily: '"Noto Serif SC", "Songti SC", "Microsoft YaHei", serif',
    primaryColor: '#b96b62',
    primaryColorHover: '#c87a70',
    primaryColorPressed: '#9d5149',
    primaryColorSuppl: '#d89a8f',
    borderRadius: '8px',
    borderColor: 'rgba(122, 83, 58, 0.24)',
    textColorBase: '#3c2a22',
    textColor1: '#3c2a22',
    textColor2: 'rgba(60, 42, 34, 0.78)',
    textColor3: 'rgba(60, 42, 34, 0.58)',
    placeholderColor: 'rgba(83, 69, 57, 0.55)',
    inputColor: 'rgba(255, 253, 247, 0.76)',
    modalColor: '#f7efe1',
    popoverColor: 'rgba(255, 250, 242, 0.98)',
    bodyColor: '#fffaf3',
    hoverColor: 'rgba(185, 107, 98, 0.09)',
    closeIconColor: 'rgba(82, 55, 43, 0.62)',
    closeIconColorHover: '#9d5149',
    boxShadow2: '0 18px 48px rgba(91, 61, 43, 0.16)',
    boxShadow3: '0 26px 76px rgba(78, 49, 34, 0.22)'
  },
  Button: {
    borderRadiusMedium: '8px',
    fontWeight: '800',
    textColor: '#5a3c30',
    textColorHover: '#9d5149',
    textColorPressed: '#7f3f38',
    textColorPrimary: '#fff9ef',
    textColorHoverPrimary: '#fffdf7',
    textColorPressedPrimary: '#fff6eb',
    color: 'rgba(255, 251, 244, 0.76)',
    colorHover: 'rgba(255, 247, 239, 0.92)',
    colorPressed: 'rgba(245, 230, 215, 0.86)',
    colorPrimary: '#b96b62',
    colorHoverPrimary: '#c87a70',
    colorPressedPrimary: '#9d5149',
    border: '1px solid rgba(130, 86, 58, 0.24)',
    borderHover: '1px solid rgba(185, 107, 98, 0.42)',
    borderPressed: '1px solid rgba(157, 81, 73, 0.5)',
    borderPrimary: '1px solid rgba(126, 61, 58, 0.22)',
    borderHoverPrimary: '1px solid rgba(126, 61, 58, 0.28)',
    borderPressedPrimary: '1px solid rgba(126, 61, 58, 0.34)',
    rippleColor: 'rgba(185, 107, 98, 0.24)'
  },
  Input: {
    borderRadius: '8px',
    color: 'rgba(255, 253, 247, 0.74)',
    colorFocus: 'rgba(255, 253, 248, 0.9)',
    colorDisabled: 'rgba(238, 224, 209, 0.58)',
    border: '1px solid rgba(112, 76, 47, 0.26)',
    borderHover: '1px solid rgba(146, 82, 50, 0.42)',
    borderFocus: '1px solid rgba(146, 82, 50, 0.52)',
    boxShadowFocus: '0 0 0 3px rgba(185, 107, 98, 0.13)',
    caretColor: '#9d5149',
    textColor: '#34251f',
    placeholderColor: 'rgba(83, 69, 57, 0.58)'
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '8px',
        color: 'rgba(255, 253, 247, 0.74)',
        colorActive: 'rgba(255, 253, 248, 0.9)',
        border: '1px solid rgba(112, 76, 47, 0.26)',
        borderHover: '1px solid rgba(146, 82, 50, 0.42)',
        borderActive: '1px solid rgba(146, 82, 50, 0.52)',
        boxShadowActive: '0 0 0 3px rgba(185, 107, 98, 0.13)'
      }
    }
  },
  DatePicker: {
    peers: {
      Input: {
        color: 'rgba(255, 253, 247, 0.74)',
        colorFocus: 'rgba(255, 253, 248, 0.9)'
      }
    }
  },
  Modal: {
    color: 'transparent',
    borderRadius: '8px',
    boxShadow: 'none',
    peers: {
      Dialog: {
        color: '#f7efe1',
        borderRadius: '8px'
      }
    }
  },
  Drawer: {
    color: '#f7efe1',
    borderRadius: '8px'
  },
  Dialog: {
    color: '#f7efe1',
    borderRadius: '8px',
    titleTextColor: '#3c2a22',
    contentTextColor: 'rgba(60, 42, 34, 0.78)'
  },
  Upload: {
    itemColorHover: 'rgba(185, 107, 98, 0.08)',
    itemTextColor: '#5a3c30',
    draggerBorder: '1px dashed rgba(142, 91, 58, 0.32)',
    draggerColor: 'rgba(255, 253, 247, 0.48)',
    draggerColorHover: 'rgba(255, 249, 239, 0.76)'
  },
  Tooltip: {
    color: 'rgba(255, 246, 236, 0.98)',
    textColor: '#5c3a2e',
    borderRadius: '8px',
    boxShadow: '0 12px 26px rgba(79, 49, 34, 0.18)'
  },
  Popover: {
    color: 'rgba(255, 246, 236, 0.98)',
    textColor: '#5c3a2e',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(79, 49, 34, 0.18)'
  },
  Spin: {
    color: '#b96b62',
    textColor: 'rgba(60, 42, 34, 0.72)'
  },
  Empty: {
    textColor: 'rgba(60, 42, 34, 0.58)',
    iconColor: 'rgba(185, 107, 98, 0.32)'
  },
  Alert: {
    borderRadius: '8px',
    colorError: 'rgba(185, 77, 67, 0.1)',
    borderError: '1px solid rgba(185, 77, 67, 0.22)',
    titleTextColorError: '#8d342e',
    contentTextColorError: '#8d342e',
    colorInfo: 'rgba(126, 100, 73, 0.1)',
    borderInfo: '1px solid rgba(126, 100, 73, 0.2)'
  }
};
