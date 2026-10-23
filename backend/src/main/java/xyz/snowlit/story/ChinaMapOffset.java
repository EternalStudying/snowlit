package xyz.snowlit.story;

/**
 * Converts WGS84 to GCJ-02, the datum Chinese maps (and every stored moment) use inside mainland China.
 * Outside mainland China the two are the same, so callers convert only places in China.
 */
final class ChinaMapOffset {

    private static final double SEMI_MAJOR_AXIS = 6378245.0;
    private static final double ECCENTRICITY_SQUARED = 0.00669342162296594323;

    private ChinaMapOffset() {
    }

    static double[] toGcj02(double latitude, double longitude) {
        double x = longitude - 105.0;
        double y = latitude - 35.0;
        double radLatitude = latitude / 180.0 * Math.PI;
        double magic = 1 - ECCENTRICITY_SQUARED * Math.sin(radLatitude) * Math.sin(radLatitude);
        double sqrtMagic = Math.sqrt(magic);
        double deltaLatitude = latitudeShift(x, y) * 180.0
                / ((SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * Math.PI);
        double deltaLongitude = longitudeShift(x, y) * 180.0
                / (SEMI_MAJOR_AXIS / sqrtMagic * Math.cos(radLatitude) * Math.PI);
        return new double[]{latitude + deltaLatitude, longitude + deltaLongitude};
    }

    private static double latitudeShift(double x, double y) {
        double shift = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        shift += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        shift += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        shift += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return shift;
    }

    private static double longitudeShift(double x, double y) {
        double shift = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        shift += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        shift += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        shift += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return shift;
    }
}
