// terminator.ts
// Mathematical computation of the Day/Night terminator polygon (GeoJSON)
// Based on NOAA Solar Calculator math.

export function getTerminator(time: Date = new Date(), resolution: number = 2) {
  const jd = time.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525.0;

  const geomMeanLongSun = (280.46646 + 36000.76983 * t) % 360;
  const geomMeanAnomSun = 357.52911 + 35999.05029 * t;

  const eccentEarthOrbit = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const sunEqOfCtr =
    Math.sin((geomMeanAnomSun * Math.PI) / 180) * (1.914602 - 0.004817 * t - 0.000014 * t * t) +
    Math.sin((2 * geomMeanAnomSun * Math.PI) / 180) * (0.019993 - 0.000101 * t) +
    Math.sin((3 * geomMeanAnomSun * Math.PI) / 180) * 0.000289;

  const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00474 * Math.sin(((125.04 - 1934.136 * t) * Math.PI) / 180);

  const meanObliqEcliptic =
    23 + (26 + (21.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 60) / 60;
  const obliqCorr = meanObliqEcliptic + 0.00256 * Math.cos(((125.04 - 1934.136 * t) * Math.PI) / 180);

  // Solar declination (degrees)
  const sunDecl =
    (Math.asin(
      Math.sin((obliqCorr * Math.PI) / 180) * Math.sin((sunAppLong * Math.PI) / 180)
    ) *
      180) /
    Math.PI;

  const varY = Math.tan(((obliqCorr / 2) * Math.PI) / 180) * Math.tan(((obliqCorr / 2) * Math.PI) / 180);
  const eqOfTime =
    4 *
    ((varY * Math.sin(2 * ((geomMeanLongSun * Math.PI) / 180)) -
      2 * eccentEarthOrbit * Math.sin((geomMeanAnomSun * Math.PI) / 180) +
      4 *
        eccentEarthOrbit *
        varY *
        Math.sin((geomMeanAnomSun * Math.PI) / 180) *
        Math.cos(2 * ((geomMeanLongSun * Math.PI) / 180)) -
      0.5 * varY * varY * Math.sin(4 * ((geomMeanLongSun * Math.PI) / 180)) -
      1.25 *
        eccentEarthOrbit *
        eccentEarthOrbit *
        Math.sin(2 * ((geomMeanAnomSun * Math.PI) / 180))) *
      180) /
    Math.PI;

  const trueSolarTime =
    (time.getUTCHours() * 60 + time.getUTCMinutes() + time.getUTCSeconds() / 60 + eqOfTime) % 1440;

  // Greenwich Hour Angle (degrees)
  let ha = trueSolarTime / 4 - 180;
  if (ha < -180) ha += 360;

  const coords: number[][] = [];
  const latRads = (lat: number) => (lat * Math.PI) / 180;
  
  // To avoid clipping bugs at poles, we create a polygon that wraps the night side.
  // We'll iterate longitudes from -180 to 180.
  for (let lon = -180; lon <= 180; lon += resolution) {
    // Hour angle at this longitude
    const haLocal = ha + lon;
    
    // Formula for latitude of the terminator where solar altitude = 0:
    // tan(lat) = -cos(haLocal) / tan(dec)
    const lat =
      Math.atan(-Math.cos((haLocal * Math.PI) / 180) / Math.tan((sunDecl * Math.PI) / 180)) *
      (180 / Math.PI);
    
    coords.push([lon, lat]);
  }

  // To close the polygon over the dark pole:
  // If sunDecl is positive (Northern hemisphere summer), the night covers the South pole (-90)
  // If sunDecl is negative, the night covers the North pole (+90)
  const isNorthernSummer = sunDecl > 0;

  if (isNorthernSummer) {
    coords.push([180, -90]);
    coords.push([-180, -90]);
  } else {
    coords.push([180, 90]);
    coords.push([-180, 90]);
  }

  coords.push(coords[0]); // Close polygon

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
        properties: {},
      },
    ],
  };
}
