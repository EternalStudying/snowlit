const { request, buildQuery } = require('../utils/request');

function hasLocation(atmosphere) {
  return ['city', 'district', 'province', 'country'].some((key) => {
    const value = String((atmosphere && atmosphere[key]) || '').trim();
    return value && !/^(unknown|未知)$/i.test(value);
  });
}

function hasWeather(atmosphere) {
  if (!atmosphere) return false;
  const temperature = atmosphere.temperature;
  const hasTemperature = (typeof temperature === 'number' || typeof temperature === 'string')
    && String(temperature).trim() !== '' && Number.isFinite(Number(temperature));
  const rawWeather = String(atmosphere.rawWeather || '').trim();
  const variant = String(atmosphere.weatherVariant || '').trim();
  return hasTemperature || Boolean(rawWeather && !/^(unknown|未知)$/i.test(rawWeather))
    || Boolean(variant && !/^(unknown|未知)$/i.test(variant));
}

function getBrowserAtmosphere(location) {
  return request({
    url: `/api/weather/atmosphere/browser${buildQuery({
      latitude: location && location.latitude,
      longitude: location && location.longitude
    })}`,
    method: 'GET',
    errorMessage: '天气状态加载失败'
  }).then((atmosphere) => {
    if (!hasLocation(atmosphere) && !hasWeather(atmosphere)) {
      throw new Error('暂时无法获取位置和天气，请稍后重试');
    }
    return atmosphere;
  });
}

function placeText(value) {
  const text = String(value || '').trim();
  return /^(unknown|未知)$/i.test(text) ? '' : text;
}

/**
 * The place a photo was taken, as "城市，国家", from its GPS position. The backend rounds the
 * coordinates before asking Geoapify. Resolves '' when no place is known or the lookup fails.
 */
function getPhotoPlaceName(position) {
  return request({
    url: `/api/weather/atmosphere/browser${buildQuery({
      latitude: position && position.latitude,
      longitude: position && position.longitude
    })}`,
    method: 'GET',
    silent: true
  }).then((atmosphere) => {
    const local = ['city', 'district', 'province'].map((key) => placeText(atmosphere && atmosphere[key])).find(Boolean) || '';
    const country = placeText(atmosphere && atmosphere.country);
    return [local, country === local ? '' : country].filter(Boolean).join('，');
  }).catch(() => '');
}

module.exports = {
  getBrowserAtmosphere,
  getPhotoPlaceName,
  hasLocation
};
