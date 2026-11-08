# SmartLabelCrop.in 🏷️

> **Free Meesho & Flipkart 4×6 Thermal Label Cropper, SKU Rescuer & Multi-Order Pack Protector for Indian E-Commerce Sellers.**

Built with **100% Client-Side WebAssembly** using Astro, Tailwind CSS v4, `pdf-lib`, `pdfjs-dist`, and `Dexie.js`. No seller files or buyer PII ever leave the user's browser.

---

## ⚡ Key Capabilities

- **100% Vector Barcode Preservation:** Uses native PDF vector embedding (`pdfDoc.embedPage()`). Barcodes never pass through HTML5 Canvas or PNG rasterization, guaranteeing razor-sharp scans on 203-DPI thermal printers.
- **Dynamic Fold-Line SKU Rescuer:** Dynamically locates the variable-length address boundary and Tax Invoice divider line, extracting hidden SKUs, Sizes, and Colors into an enlarged 72pt bottom packing footer.
- **Inverted Black Multi-Order Alert:** Stamped automatically across any order with `qty >= 2` (`[★ MULTI-ORDER: PACK X PCS ★]`), preventing costly missing-item claims and RTO losses.
- **Apparel-Aware 4-Key Sorter:** Sorts batches hierarchically: `Courier Partner Handover (Valmo → Ekart → Delhivery) → SKU → Apparel Size (XXS → 3XL) → Order ID`.
- **Sticker #1 Thermal Picklist:** Automatically prepends a 4×6 warehouse picklist sticker featuring carrier totals and rack inventory pick quantities.
- **30-Day Duplicate AWB Safeguard:** Sub-10ms local IndexedDB lookups prevent accidental double-printing of shipping labels.
- **Dual Theme Support:** High-contrast `dub.co` design system with seamless Light and Dark mode switching.

---

## 🛠️ Tech Stack

- **Framework:** [Astro v7](https://astro.build) (Static Site Generation)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com) with `@tailwindcss/vite`
- **PDF Manipulation:** [`pdf-lib`](https://pdf-lib.js.org/) + [`@pdf-lib/fontkit`](https://github.com/Hopding/fontkit)
- **PDF Text Parsing:** [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) (with hermetic offline Web Worker)
- **Local Storage:** [`dexie`](https://dexie.org/) (IndexedDB wrapper)
- **Typography:** Plus Jakarta Sans / Satoshi, Inter, Geist Mono

---

## 🚀 Getting Started

### Prerequisites

- Node.js `v22.23.4` or later
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/manish2007ux896/label.git
cd label

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Visit [http://localhost:4321](http://localhost:4321) in your browser.

### Building for Production

```bash
# Create optimized production build
npm run build

# Preview build locally
npm run preview
```

### Running Tests

```bash
node --experimental-strip-types tests/test_engine.mjs
```

---

## 🖨️ Supported Thermal Printers

- **TVS LP-46 / 46 Neo:** Seagull Driver, Darkness 11-12, Speed 3.0 in/sec
- **TSC TE-244 / TE-200:** TSC Official Driver, Darkness 10-11, Speed 4.0 in/sec
- **Zebra ZD230 / GC420t:** ZDesigner Driver, Darkness 12-14, Speed 3.5 in/sec
- **Xprinter XP-420B / XP-460B:** Seagull Driver, Darkness 10, Speed 127 mm/sec

---

## 🔒 Privacy & Compliance

SmartLabelCrop.in processes all files purely in-memory using WebAssembly inside your browser tab. Zero buyer names, phone numbers, addresses, GSTIN numbers, or sales volumes are transmitted to any cloud servers, ensuring full compliance with the **Digital Personal Data Protection (DPDP) Act 2023**.
