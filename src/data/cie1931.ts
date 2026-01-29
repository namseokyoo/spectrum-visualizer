/**
 * CIE 1931 2-degree Standard Observer Color Matching Functions
 * Data range: 380nm - 780nm, 5nm intervals
 * Source: CIE 15:2018 Technical Report
 */

export interface CIEObserverData {
  wavelength: number;
  x: number;
  y: number;
  z: number;
}

// CIE 1931 2-degree Standard Observer (5nm intervals, 380-780nm)
export const CIE1931_OBSERVER: CIEObserverData[] = [
  { wavelength: 380, x: 0.001368, y: 0.000039, z: 0.006450 },
  { wavelength: 385, x: 0.002236, y: 0.000064, z: 0.010550 },
  { wavelength: 390, x: 0.004243, y: 0.000120, z: 0.020050 },
  { wavelength: 395, x: 0.007650, y: 0.000217, z: 0.036210 },
  { wavelength: 400, x: 0.014310, y: 0.000396, z: 0.067850 },
  { wavelength: 405, x: 0.023190, y: 0.000640, z: 0.110200 },
  { wavelength: 410, x: 0.043510, y: 0.001210, z: 0.207400 },
  { wavelength: 415, x: 0.077630, y: 0.002180, z: 0.371300 },
  { wavelength: 420, x: 0.134380, y: 0.004000, z: 0.645600 },
  { wavelength: 425, x: 0.214770, y: 0.007300, z: 1.039050 },
  { wavelength: 430, x: 0.283900, y: 0.011600, z: 1.385600 },
  { wavelength: 435, x: 0.328500, y: 0.016840, z: 1.622960 },
  { wavelength: 440, x: 0.348280, y: 0.023000, z: 1.747060 },
  { wavelength: 445, x: 0.348060, y: 0.029800, z: 1.782600 },
  { wavelength: 450, x: 0.336200, y: 0.038000, z: 1.772110 },
  { wavelength: 455, x: 0.318700, y: 0.048000, z: 1.744100 },
  { wavelength: 460, x: 0.290800, y: 0.060000, z: 1.669200 },
  { wavelength: 465, x: 0.251100, y: 0.073900, z: 1.528100 },
  { wavelength: 470, x: 0.195360, y: 0.090980, z: 1.287640 },
  { wavelength: 475, x: 0.142100, y: 0.112600, z: 1.041900 },
  { wavelength: 480, x: 0.095640, y: 0.139020, z: 0.812950 },
  { wavelength: 485, x: 0.058010, y: 0.169300, z: 0.616200 },
  { wavelength: 490, x: 0.032010, y: 0.208020, z: 0.465180 },
  { wavelength: 495, x: 0.014700, y: 0.258600, z: 0.353300 },
  { wavelength: 500, x: 0.004900, y: 0.323000, z: 0.272000 },
  { wavelength: 505, x: 0.002400, y: 0.407300, z: 0.212300 },
  { wavelength: 510, x: 0.009300, y: 0.503000, z: 0.158200 },
  { wavelength: 515, x: 0.029100, y: 0.608200, z: 0.111700 },
  { wavelength: 520, x: 0.063270, y: 0.710000, z: 0.078250 },
  { wavelength: 525, x: 0.109600, y: 0.793200, z: 0.057250 },
  { wavelength: 530, x: 0.165500, y: 0.862000, z: 0.042160 },
  { wavelength: 535, x: 0.225750, y: 0.914850, z: 0.029840 },
  { wavelength: 540, x: 0.290400, y: 0.954000, z: 0.020300 },
  { wavelength: 545, x: 0.359700, y: 0.980300, z: 0.013400 },
  { wavelength: 550, x: 0.433450, y: 0.994950, z: 0.008750 },
  { wavelength: 555, x: 0.512050, y: 1.000000, z: 0.005750 },
  { wavelength: 560, x: 0.594500, y: 0.995000, z: 0.003900 },
  { wavelength: 565, x: 0.678400, y: 0.978600, z: 0.002750 },
  { wavelength: 570, x: 0.762100, y: 0.952000, z: 0.002100 },
  { wavelength: 575, x: 0.842500, y: 0.915400, z: 0.001800 },
  { wavelength: 580, x: 0.916300, y: 0.870000, z: 0.001650 },
  { wavelength: 585, x: 0.978600, y: 0.816300, z: 0.001400 },
  { wavelength: 590, x: 1.026300, y: 0.757000, z: 0.001100 },
  { wavelength: 595, x: 1.056700, y: 0.694900, z: 0.001000 },
  { wavelength: 600, x: 1.062200, y: 0.631000, z: 0.000800 },
  { wavelength: 605, x: 1.045600, y: 0.566800, z: 0.000600 },
  { wavelength: 610, x: 1.002600, y: 0.503000, z: 0.000340 },
  { wavelength: 615, x: 0.938400, y: 0.441200, z: 0.000240 },
  { wavelength: 620, x: 0.854450, y: 0.381000, z: 0.000190 },
  { wavelength: 625, x: 0.751400, y: 0.321000, z: 0.000100 },
  { wavelength: 630, x: 0.642400, y: 0.265000, z: 0.000050 },
  { wavelength: 635, x: 0.541900, y: 0.217000, z: 0.000030 },
  { wavelength: 640, x: 0.447900, y: 0.175000, z: 0.000020 },
  { wavelength: 645, x: 0.360800, y: 0.138200, z: 0.000010 },
  { wavelength: 650, x: 0.283500, y: 0.107000, z: 0.000000 },
  { wavelength: 655, x: 0.218700, y: 0.081600, z: 0.000000 },
  { wavelength: 660, x: 0.164900, y: 0.061000, z: 0.000000 },
  { wavelength: 665, x: 0.121200, y: 0.044580, z: 0.000000 },
  { wavelength: 670, x: 0.087400, y: 0.032000, z: 0.000000 },
  { wavelength: 675, x: 0.063600, y: 0.023200, z: 0.000000 },
  { wavelength: 680, x: 0.046770, y: 0.017000, z: 0.000000 },
  { wavelength: 685, x: 0.032900, y: 0.011920, z: 0.000000 },
  { wavelength: 690, x: 0.022700, y: 0.008210, z: 0.000000 },
  { wavelength: 695, x: 0.015840, y: 0.005723, z: 0.000000 },
  { wavelength: 700, x: 0.011359, y: 0.004102, z: 0.000000 },
  { wavelength: 705, x: 0.008111, y: 0.002929, z: 0.000000 },
  { wavelength: 710, x: 0.005790, y: 0.002091, z: 0.000000 },
  { wavelength: 715, x: 0.004109, y: 0.001484, z: 0.000000 },
  { wavelength: 720, x: 0.002899, y: 0.001047, z: 0.000000 },
  { wavelength: 725, x: 0.002049, y: 0.000740, z: 0.000000 },
  { wavelength: 730, x: 0.001440, y: 0.000520, z: 0.000000 },
  { wavelength: 735, x: 0.001000, y: 0.000361, z: 0.000000 },
  { wavelength: 740, x: 0.000690, y: 0.000249, z: 0.000000 },
  { wavelength: 745, x: 0.000476, y: 0.000172, z: 0.000000 },
  { wavelength: 750, x: 0.000332, y: 0.000120, z: 0.000000 },
  { wavelength: 755, x: 0.000235, y: 0.000085, z: 0.000000 },
  { wavelength: 760, x: 0.000166, y: 0.000060, z: 0.000000 },
  { wavelength: 765, x: 0.000117, y: 0.000042, z: 0.000000 },
  { wavelength: 770, x: 0.000083, y: 0.000030, z: 0.000000 },
  { wavelength: 775, x: 0.000059, y: 0.000021, z: 0.000000 },
  { wavelength: 780, x: 0.000042, y: 0.000015, z: 0.000000 },
];

// Spectral Locus coordinates for CIE 1931 xy diagram
export const SPECTRAL_LOCUS_XY: { wavelength: number; x: number; y: number }[] = [
  { wavelength: 380, x: 0.1741, y: 0.0050 },
  { wavelength: 385, x: 0.1740, y: 0.0050 },
  { wavelength: 390, x: 0.1738, y: 0.0049 },
  { wavelength: 395, x: 0.1736, y: 0.0049 },
  { wavelength: 400, x: 0.1733, y: 0.0048 },
  { wavelength: 405, x: 0.1730, y: 0.0048 },
  { wavelength: 410, x: 0.1726, y: 0.0048 },
  { wavelength: 415, x: 0.1721, y: 0.0048 },
  { wavelength: 420, x: 0.1714, y: 0.0051 },
  { wavelength: 425, x: 0.1703, y: 0.0058 },
  { wavelength: 430, x: 0.1689, y: 0.0069 },
  { wavelength: 435, x: 0.1669, y: 0.0086 },
  { wavelength: 440, x: 0.1644, y: 0.0109 },
  { wavelength: 445, x: 0.1611, y: 0.0138 },
  { wavelength: 450, x: 0.1566, y: 0.0177 },
  { wavelength: 455, x: 0.1510, y: 0.0227 },
  { wavelength: 460, x: 0.1440, y: 0.0297 },
  { wavelength: 465, x: 0.1355, y: 0.0399 },
  { wavelength: 470, x: 0.1241, y: 0.0578 },
  { wavelength: 475, x: 0.1096, y: 0.0868 },
  { wavelength: 480, x: 0.0913, y: 0.1327 },
  { wavelength: 485, x: 0.0687, y: 0.2007 },
  { wavelength: 490, x: 0.0454, y: 0.2950 },
  { wavelength: 495, x: 0.0235, y: 0.4127 },
  { wavelength: 500, x: 0.0082, y: 0.5384 },
  { wavelength: 505, x: 0.0039, y: 0.6548 },
  { wavelength: 510, x: 0.0139, y: 0.7502 },
  { wavelength: 515, x: 0.0389, y: 0.8120 },
  { wavelength: 520, x: 0.0743, y: 0.8338 },
  { wavelength: 525, x: 0.1142, y: 0.8262 },
  { wavelength: 530, x: 0.1547, y: 0.8059 },
  { wavelength: 535, x: 0.1929, y: 0.7816 },
  { wavelength: 540, x: 0.2296, y: 0.7543 },
  { wavelength: 545, x: 0.2658, y: 0.7243 },
  { wavelength: 550, x: 0.3016, y: 0.6923 },
  { wavelength: 555, x: 0.3373, y: 0.6589 },
  { wavelength: 560, x: 0.3731, y: 0.6245 },
  { wavelength: 565, x: 0.4087, y: 0.5896 },
  { wavelength: 570, x: 0.4441, y: 0.5547 },
  { wavelength: 575, x: 0.4788, y: 0.5202 },
  { wavelength: 580, x: 0.5125, y: 0.4866 },
  { wavelength: 585, x: 0.5448, y: 0.4544 },
  { wavelength: 590, x: 0.5752, y: 0.4242 },
  { wavelength: 595, x: 0.6029, y: 0.3965 },
  { wavelength: 600, x: 0.6270, y: 0.3725 },
  { wavelength: 605, x: 0.6482, y: 0.3514 },
  { wavelength: 610, x: 0.6658, y: 0.3340 },
  { wavelength: 615, x: 0.6801, y: 0.3197 },
  { wavelength: 620, x: 0.6915, y: 0.3083 },
  { wavelength: 625, x: 0.7006, y: 0.2993 },
  { wavelength: 630, x: 0.7079, y: 0.2920 },
  { wavelength: 635, x: 0.7140, y: 0.2859 },
  { wavelength: 640, x: 0.7190, y: 0.2809 },
  { wavelength: 645, x: 0.7230, y: 0.2770 },
  { wavelength: 650, x: 0.7260, y: 0.2740 },
  { wavelength: 655, x: 0.7283, y: 0.2717 },
  { wavelength: 660, x: 0.7300, y: 0.2700 },
  { wavelength: 665, x: 0.7311, y: 0.2689 },
  { wavelength: 670, x: 0.7320, y: 0.2680 },
  { wavelength: 675, x: 0.7327, y: 0.2673 },
  { wavelength: 680, x: 0.7334, y: 0.2666 },
  { wavelength: 685, x: 0.7340, y: 0.2660 },
  { wavelength: 690, x: 0.7344, y: 0.2656 },
  { wavelength: 695, x: 0.7346, y: 0.2654 },
  { wavelength: 700, x: 0.7347, y: 0.2653 },
  { wavelength: 705, x: 0.7347, y: 0.2653 },
  { wavelength: 710, x: 0.7347, y: 0.2653 },
  { wavelength: 715, x: 0.7347, y: 0.2653 },
  { wavelength: 720, x: 0.7347, y: 0.2653 },
  { wavelength: 725, x: 0.7347, y: 0.2653 },
  { wavelength: 730, x: 0.7347, y: 0.2653 },
  { wavelength: 735, x: 0.7347, y: 0.2653 },
  { wavelength: 740, x: 0.7347, y: 0.2653 },
  { wavelength: 745, x: 0.7347, y: 0.2653 },
  { wavelength: 750, x: 0.7347, y: 0.2653 },
  { wavelength: 755, x: 0.7347, y: 0.2653 },
  { wavelength: 760, x: 0.7347, y: 0.2653 },
  { wavelength: 765, x: 0.7347, y: 0.2653 },
  { wavelength: 770, x: 0.7347, y: 0.2653 },
  { wavelength: 775, x: 0.7347, y: 0.2653 },
  { wavelength: 780, x: 0.7347, y: 0.2653 },
];

// Standard color gamut definitions
export const COLOR_GAMUTS = {
  sRGB: {
    name: 'sRGB',
    vertices: [
      { x: 0.64, y: 0.33 },  // Red
      { x: 0.30, y: 0.60 },  // Green
      { x: 0.15, y: 0.06 },  // Blue
    ],
    whitePoint: { x: 0.3127, y: 0.3290 },  // D65
  },
  'DCI-P3': {
    name: 'DCI-P3',
    vertices: [
      { x: 0.680, y: 0.320 },  // Red
      { x: 0.265, y: 0.690 },  // Green
      { x: 0.150, y: 0.060 },  // Blue
    ],
    whitePoint: { x: 0.3127, y: 0.3290 },  // D65
  },
  'BT.2020': {
    name: 'BT.2020',
    vertices: [
      { x: 0.708, y: 0.292 },  // Red
      { x: 0.170, y: 0.797 },  // Green
      { x: 0.131, y: 0.046 },  // Blue
    ],
    whitePoint: { x: 0.3127, y: 0.3290 },  // D65
  },
  'AdobeRGB': {
    name: 'Adobe RGB',
    vertices: [
      { x: 0.6400, y: 0.3300 },  // Red
      { x: 0.2100, y: 0.7100 },  // Green
      { x: 0.1500, y: 0.0600 },  // Blue
    ],
    whitePoint: { x: 0.3127, y: 0.3290 },  // D65
  },
};
