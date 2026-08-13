const fs = require("fs");
const path = require("path");

// Source path (default points to Cursor workspace storage where the reference image currently lives)
const DEFAULT_SOURCE =
  "C:\\Users\\hpath\\.cursor\\projects\\d-Succulent-Sphere-Website\\assets\\c__Users_hpath_AppData_Roaming_Cursor_User_workspaceStorage_367e2776ceba6748da761e9cd3b509c0_images_HOME-d0dc6f6b-7fa5-41fc-aeb3-0a152cd9caf3.png";

const src = process.env.SOURCE_IMAGE || DEFAULT_SOURCE;
const publicAssetsDir = path.join(__dirname, "..", "public", "assets");

if (!fs.existsSync(src)) {
  console.error("Source image not found:", src);
  console.error("Set SOURCE_IMAGE env var to the correct path if different.");
  process.exit(1);
}

if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

const filesToCreate = [
  { name: "hero.png" },
  { name: "product-1.jpg" },
  { name: "product-2.jpg" },
  { name: "product-3.jpg" },
  { name: "product-4.jpg" },
  { name: "category-1.jpg" },
  { name: "category-2.jpg" },
  { name: "category-3.jpg" },
  { name: "category-4.jpg" },
  { name: "brand-lifestyle.jpg" },
  { name: "ig-1.jpg" },
  { name: "ig-2.jpg" },
  { name: "ig-3.jpg" },
  { name: "ig-4.jpg" },
  { name: "ig-5.jpg" },
  { name: "ig-6.jpg" }
];

filesToCreate.forEach((f) => {
  const dest = path.join(publicAssetsDir, f.name);
  fs.copyFileSync(src, dest);
  console.log("Copied", dest);
});

console.log("Assets imported to public/assets. You can now run the dev server.");
