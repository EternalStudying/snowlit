import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readAmapCoordinate,
  reverseGeocode,
  searchAmapLocations
} from '../internal/amapSdk';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AMap SDK boundary', () => {
  it('normalizes coordinate objects without exposing SDK shapes to callers', () => {
    expect(readAmapCoordinate({ lng: 2.29, lat: 48.86 })).toEqual({
      longitude: 2.29,
      latitude: 48.86
    });
    expect(
      readAmapCoordinate({
        getLng: () => -0.13,
        getLat: () => 51.51
      })
    ).toEqual({
      longitude: -0.13,
      latitude: 51.51
    });
    expect(readAmapCoordinate({ lng: 'invalid', lat: 48.86 })).toBeNull();
  });

  it('maps autocomplete results into stable location suggestions', async () => {
    vi.stubGlobal('AMap', {
      Map: class {},
      AutoComplete: class {
        search(
          keyword: string,
          callback: (status: string, result: unknown) => void
        ) {
          callback('complete', {
            tips: [
              {
                id: 'poi-1',
                name: `${keyword}东门`,
                district: '法国巴黎第七区',
                location: { lng: 2.29, lat: 48.86 }
              },
              {
                id: 'invalid',
                name: '无坐标结果'
              }
            ]
          });
        }
      }
    });

    await expect(searchAmapLocations('埃菲尔铁塔')).resolves.toEqual([
      {
        id: 'poi-1',
        name: '埃菲尔铁塔东门',
        address: '法国巴黎第七区',
        longitude: 2.29,
        latitude: 48.86
      }
    ]);
  });

  it('maps reverse-geocode results and degrades when the plugin is absent', async () => {
    vi.stubGlobal('AMap', {
      Map: class {},
      Geocoder: class {
        getAddress(
          _coordinate: [number, number],
          callback: (status: string, result: unknown) => void
        ) {
          callback('complete', {
            regeocode: {
              formattedAddress: '瑞士日内瓦湖畔',
              pois: [{ name: '日内瓦湖' }]
            }
          });
        }
      }
    });

    await expect(reverseGeocode(6.15, 46.21)).resolves.toEqual({
      locationName: '日内瓦湖',
      address: '瑞士日内瓦湖畔'
    });

    vi.stubGlobal('AMap', { Map: class {} });
    await expect(reverseGeocode(6.15, 46.21)).resolves.toBeNull();
  });
});
