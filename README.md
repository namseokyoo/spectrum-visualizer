# Interactive Spectrum-to-Color Visualizer (ISCV)

A web-based tool for visualizing emission spectra and calculating color coordinates in CIE color spaces. Designed for OLED and display researchers to analyze spectral data and understand color reproduction.

![ISCV Screenshot](./screenshot.png)

## Features

- **Spectrum Data Input**: Upload files (CSV, TXT, TSV) or paste data directly
- **Real-time CIE Coordinate Calculation**:
  - CIE 1931 xy chromaticity coordinates
  - CIE 1976 u'v' uniform color space coordinates
  - XYZ tristimulus values
- **Interactive Wavelength Shifting**: Drag the color point or use slider to shift spectrum wavelength
- **Standard Color Gamuts**: Overlay sRGB, DCI-P3, and BT.2020 gamut triangles
- **Snapshot Comparison**: Save and compare multiple color points
- **Preset Spectra**: Built-in Blue, Green, Red, and White emission presets

## Tech Stack

- **React 19** + **TypeScript** - Modern React with type safety
- **Vite 7** - Fast development and build tooling
- **D3.js** - Scientific data visualization
- **Tailwind CSS 4** - Utility-first styling

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/namseokyoo/spectrum-visualizer.git
cd spectrum-visualizer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Build output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

### 1. Load Spectrum Data

**Option A: Use Presets**
- Select from built-in emission spectra (Blue, Green, Red, White)

**Option B: Upload File**
- Drag & drop or click to upload CSV/TXT/TSV files
- Format: two columns (wavelength, intensity) separated by comma, tab, or space

**Option C: Paste Data**
- Paste wavelength/intensity pairs directly
- One data point per line

### 2. Adjust Wavelength

- Use the slider to shift the spectrum (-100nm to +100nm)
- Or drag the color point on the CIE diagram directly
- Monitor real-time coordinate changes

### 3. Compare Colors

- Save snapshots of interesting points
- Compare multiple saved states
- Restore previous snapshots

### 4. Reference Gamuts

- Toggle sRGB, DCI-P3, BT.2020 overlays
- See if your color falls within standard display gamuts

## Data Format

The tool accepts spectrum data in the following format:

```
wavelength_nm,intensity
380,0.001
385,0.002
390,0.005
...
780,0.001
```

Supports:
- Comma, tab, or space delimiters
- With or without header row
- Wavelength range: typically 380-780nm

## Project Structure

```
src/
├── components/          # React components
│   ├── CIEDiagram.tsx   # D3.js chromaticity diagram
│   ├── DataInput.tsx    # File upload and data input
│   └── SnapshotList.tsx # Saved states management
├── lib/                 # Core calculation libraries
│   ├── chromaticity.ts  # CIE coordinate calculations
│   ├── spectrum-to-xyz.ts # Spectral integration
│   ├── wavelength-shift.ts # Spectrum shifting
│   └── color-convert.ts # XYZ to RGB conversion
├── data/
│   └── cie1931.ts       # CIE standard observer data
├── hooks/
│   └── useSnapshots.ts  # Snapshot state management
└── types/
    └── spectrum.ts      # TypeScript type definitions
```

## Color Science Background

### CIE 1931 xy Chromaticity

The CIE 1931 color space is the first mathematically defined color space, based on human color perception experiments. The xy chromaticity diagram represents all visible colors.

### CIE 1976 u'v' Uniform Color Space

The CIE 1976 u'v' color space is a perceptually more uniform transformation of the 1931 space, where equal distances represent more equal perceived color differences.

### Calculation Method

1. Spectrum data is interpolated to 1nm resolution
2. Multiplied by CIE 1931 Standard Observer (2-degree) color matching functions
3. Integrated to obtain XYZ tristimulus values
4. Converted to xy or u'v' chromaticity coordinates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- CIE Standard Observer data from CIE 15:2004
- Color gamut specifications from ITU-R BT.709, BT.2020, and DCI-P3 standards

---

Built by [SidequestLab](https://github.com/namseokyoo)
