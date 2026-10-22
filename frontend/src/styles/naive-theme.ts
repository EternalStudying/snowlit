import type { GlobalThemeOverrides } from 'naive-ui';

export const snowlitNaiveTheme: GlobalThemeOverrides = {
  common: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
    primaryColor: '#b8323f',
    primaryColorHover: '#c94653',
    primaryColorPressed: '#8f2430',
    primaryColorSuppl: '#d77a84',
    borderRadius: '8px',
    borderColor: 'rgba(38, 49, 59, 0.16)',
    textColorBase: '#26313b',
    textColor1: '#26313b',
    textColor2: 'rgba(38, 49, 59, 0.78)',
    textColor3: 'rgba(38, 49, 59, 0.58)',
    placeholderColor: 'rgba(38, 49, 59, 0.42)',
    inputColor: '#fcfcfa',
    modalColor: '#fcfcfa',
    popoverColor: 'rgba(252, 252, 250, 0.98)',
    bodyColor: '#f3f5f4',
    hoverColor: 'rgba(38, 49, 59, 0.06)',
    closeIconColor: 'rgba(38, 49, 59, 0.55)',
    closeIconColorHover: '#8f2430',
    boxShadow2: '0 18px 40px -16px rgba(38, 49, 59, 0.32)',
    boxShadow3: '0 28px 60px -24px rgba(38, 49, 59, 0.42)'
  },
  Button: {
    borderRadiusMedium: '8px',
    fontWeight: '600',
    textColor: '#26313b',
    textColorHover: '#8f2430',
    textColorPressed: '#8f2430',
    textColorPrimary: '#fcfcfa',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#f3f5f4',
    color: '#fcfcfa',
    colorHover: '#f3f5f4',
    colorPressed: '#e7ecec',
    colorPrimary: '#b8323f',
    colorHoverPrimary: '#c94653',
    colorPressedPrimary: '#8f2430',
    border: '1px solid rgba(38, 49, 59, 0.18)',
    borderHover: '1px solid rgba(184, 50, 63, 0.4)',
    borderPressed: '1px solid rgba(143, 36, 48, 0.5)',
    borderPrimary: '1px solid rgba(143, 36, 48, 0.2)',
    borderHoverPrimary: '1px solid rgba(143, 36, 48, 0.26)',
    borderPressedPrimary: '1px solid rgba(143, 36, 48, 0.32)',
    rippleColor: 'rgba(184, 50, 63, 0.24)'
  },
  Input: {
    borderRadius: '8px',
    color: '#fcfcfa',
    colorFocus: '#ffffff',
    colorDisabled: '#e7ecec',
    border: '1px solid rgba(38, 49, 59, 0.18)',
    borderHover: '1px solid rgba(38, 49, 59, 0.32)',
    borderFocus: '1px solid rgba(217, 154, 43, 0.8)',
    boxShadowFocus: '0 0 0 3px rgba(217, 154, 43, 0.22)',
    caretColor: '#8f2430',
    textColor: '#26313b',
    placeholderColor: 'rgba(38, 49, 59, 0.42)'
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '8px',
        color: '#fcfcfa',
        colorActive: '#ffffff',
        border: '1px solid rgba(38, 49, 59, 0.18)',
        borderHover: '1px solid rgba(38, 49, 59, 0.32)',
        borderActive: '1px solid rgba(217, 154, 43, 0.8)',
        boxShadowActive: '0 0 0 3px rgba(217, 154, 43, 0.22)'
      }
    }
  },
  DatePicker: {
    peers: {
      Input: {
        color: '#fcfcfa',
        colorFocus: '#ffffff'
      }
    }
  },
  Modal: {
    color: 'transparent',
    borderRadius: '8px',
    boxShadow: 'none',
    peers: {
      Dialog: {
        color: '#fcfcfa',
        borderRadius: '8px'
      }
    }
  },
  Drawer: {
    color: '#fcfcfa',
    borderRadius: '8px'
  },
  Dialog: {
    color: '#fcfcfa',
    borderRadius: '8px',
    titleTextColor: '#26313b',
    contentTextColor: 'rgba(38, 49, 59, 0.78)'
  },
  Upload: {
    itemColorHover: 'rgba(38, 49, 59, 0.05)',
    itemTextColor: '#26313b',
    draggerBorder: '1px dashed rgba(38, 49, 59, 0.28)',
    draggerColor: 'rgba(252, 252, 250, 0.6)',
    draggerColorHover: '#fcfcfa'
  },
  Tooltip: {
    color: 'rgba(38, 49, 59, 0.94)',
    textColor: '#f3f5f4',
    borderRadius: '8px',
    boxShadow: '0 10px 24px -12px rgba(38, 49, 59, 0.5)'
  },
  Popover: {
    color: 'rgba(38, 49, 59, 0.94)',
    textColor: '#f3f5f4',
    borderRadius: '8px',
    boxShadow: '0 10px 24px -12px rgba(38, 49, 59, 0.5)'
  },
  Spin: {
    color: '#b8323f',
    textColor: 'rgba(38, 49, 59, 0.72)'
  },
  Empty: {
    textColor: 'rgba(38, 49, 59, 0.58)',
    iconColor: 'rgba(184, 50, 63, 0.3)'
  },
  Alert: {
    borderRadius: '8px',
    colorError: 'rgba(184, 50, 63, 0.08)',
    borderError: '1px solid rgba(184, 50, 63, 0.22)',
    titleTextColorError: '#8f2430',
    contentTextColorError: '#8f2430',
    colorInfo: 'rgba(217, 154, 43, 0.12)',
    borderInfo: '1px solid rgba(217, 154, 43, 0.3)'
  }
};
