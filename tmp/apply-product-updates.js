const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8212;|&#8211;|&mdash;|&ndash;|—|–/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const updates = [
  { title: 'Ruby Necklace (Othonna capensis) — Purple Red Trailing Succulent', regularPrice: 99, salePrice: 59, availability: 'In stock' },
  { title: 'Echeveria Menina — Soft Pastel Pink Ruffled Rosette Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Sedum Nussaumerianum — Warm Yellow Orange Trailing Stonecrop', regularPrice: 109, salePrice: 69, availability: 'In stock' },
  { title: 'Echeveria Pallida — Elegant Large Pale Green Ruffled Rosette', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Haworthiopsis Reinwardtii — Zebra Wart Striped Indoor Succulent', regularPrice: 240, salePrice: 159, availability: 'In stock' },
  { title: 'Crassula Campfire (Crassula capitella) — Fiery Red Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Portulacaria Afra variegata — Elephant Bush Rainbow Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Graptopetalum Superbum — Pastel Purple Rosette Succulent', regularPrice: 159, salePrice: 99, availability: 'In stock' },
  { title: 'Echeveria Orion — Ice Blue Violet Tipped Rosette Succulent', regularPrice: 129, salePrice: 89, availability: 'In stock' },
  { title: 'Sedum Adolphii Firestorm — Golden Red Tipped Trailing Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Crassula Ovata Gollum — Shrek Ear Jade Plant Succulent', regularPrice: 129, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Melaco — Deep Bronze Chocolate Rosette Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Aeonium Kiwi (Aeonium haworthii) — Tricolor Variegated Rosette', regularPrice: 180, salePrice: 120, availability: 'Out of stock' },
  { title: 'Echeveria Dark Moon — Deep Black Purple Velvet Rosette Succulent', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Haworthia Limifolia — Fairy Castle Spiral Textured Succulent', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Echeveria Lola — Soft Lilac Pearl Tipped Rosette Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Crassula Perforata (String of Buttons) — Stacked Succulent', regularPrice: 129, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Black Prince — Dark Chocolate Rosette Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Senecio Rowleyanus — String of Pearls Trailing Succulent', regularPrice: 199, salePrice: 149, availability: 'In stock' },
  { title: 'Sedum Morganianum — Burro\'s Tail Trailing Succulent', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Elegans — Mexican Snow Ball Rosette Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Haworthia Fasciata — Zebra Haworthia Striped Indoor Plant', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Peacockii — Powder Blue Pink Tipped Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Crassula Ovata — Classic Jade Plant Money Tree Succulent', regularPrice: 129, salePrice: 79, availability: 'In stock' },
  { title: 'Kalanchoe Tomentosa — Panda Plant Fuzzy Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Topsy Turvy — Unique Inverted Leaf Rosette Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Graptoveria Debbie — Pastel Pinkish Purple Rosette Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Graptopetalum Paraguayense — Ghost Plant Grey Purple Rosette', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Haworthia Cymbiformis — Translucent Cathedral Window Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Sempervivum Tectorum — Hens and Chicks Hardy Rosette Succulent', regularPrice: 129, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Perle von Nurnberg — Pink Violet Shimmer Rosette', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Crassula Tetragona — Miniature Pine Tree Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Echeveria Pulvinata — Red Ruby Velvet Fuzzy Rosette Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Cotyledon Tomentosa — Bear\'s Paw Fuzzy Tipped Succulent', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Echeveria Agavoides — Molded Wax Red Edge Rosette Succulent', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Pachyphytum Oviferum — Moonstones Soft Pastel Pink Succulent', regularPrice: 189, salePrice: 139, availability: 'In stock' },
  { title: 'Senecio Radicans — String of Bananas Trailing Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Tippy — Pink Pointed Tip Mint Green Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Sansevieria Trifasciata Snake Plant — Air Purifying Indoor Succulent', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Echeveria Neon Breakers — Vibrant Ruffled Magenta Margin Rosette', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Adromischus Cristatus — Crinkle Leaf Key Lime Pie Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Echeveria Minima — Compact Multi-clustering Pink Tipped Rosette', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Aloe Haworthioides — Lace Aloe Miniature Spiky Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Pachyveria Clavata — Chunky Blue Grey Rosette Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Chroma — Variegated Swirl Bronzed Pink Rosette', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Haworthia Attenuata — Super White Zebra Striped Succulent', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Crassula Muscosa — Watch Chain Moss-like Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Echeveria Setosa — Mexican Firecracker Hairy Rosette Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Sedum Rubrotinctum — Jelly Bean Pork and Beans Succulent', regularPrice: 109, salePrice: 69, availability: 'In stock' },
  { title: 'Kalanchoe Luciae — Flapjack Paddle Plant Red Margin Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Subsessilis — Morning Beauty Powder Blue Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Haworthia Truncata — Horse\'s Teeth Square Cut Window Succulent', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Graptosedum Francesco Baldi — Golden Pink Tipped Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Echeveria Blue Atoll — Bright Cyan Blue Compact Rosette Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Euphorbia Trigona — African Milk Tree Red Cathedral Cactus', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Echeveria Doris Taylor — Woolly Rose Soft Fuzzy Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Haworthia Cooperi — Crystal Clear Jelly Bubble Window Succulent', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Crassula \'Spring Time\' — Pink Flower Cluster Stacked Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Echeveria Cubic Frost — Crested Lilac Upside-down Leaf Rosette', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Sedum Multiceps — Miniature Joshua Tree Bonsai Succulent', regularPrice: 179, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Princess Blue — Ice Mint Powdered Graceful Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Gasteria Little Warty — Tongue-shaped Bumpy Textured Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Echeveria Dondo — Orange Flowered Compact Mint Rosette', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Kalanchoe Daigremontiana — Mother of Thousands Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Echeveria Nodulosa — Painted Echeveria Red Striped Rosette', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Pachyphytum Compactus — Little Jewel Chiseled Geometric Leaves', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Haworthia Retusa — Star-shaped Translucent Window Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Hercules — Thick Pink Tipped Dusty Blue Rosette', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Peperomia Prostrata — String of Turtles Miniature Trailing Plant', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Echeveria Lilacina — Ghost Echeveria Silvery Lilac Rosette', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Crassula Red Pagoda — Crimson Stacking Geometric Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Purpusorum — Dark Mottled Green Speckled Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Aloe Christmas Carol — Deep Red Bumpy Margin Spiky Succulent', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Echeveria Raindrops — Unique Bumpy Waterdrop Leaf Rosette', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Haworthiopsis Venosa Tessellata — Veined Square Lattice Windows', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Crested Variety — Unique Fan-shaped Rare Form Succulent', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Sedum Clavatum — Sweet Scented Chubby Blue Rosette Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Subrigida — Crimson Red Margined Elegant Rosette', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Crassula Ovata Tricolor — Silver Dollar Pink Variegated Jade', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Echeveria Fleur d\'Antan — Antique Vintage Purple Rosette', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Haworthia Maughanii — Flat Top Cut Cylinder Window Succulent', regularPrice: 349, salePrice: 249, availability: 'In stock' },
  { title: 'Echeveria Laui — Snow White Thick Powdered Rare Rosette', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Senecio Peregrinus — String of Dolphins Trailing Succulent', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Echeveria Blue Bird — Silvery Pink Edge Chunky Rosette', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Kalanchoe Pink Butterflies — Variegated Mother of Thousands Pink', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Echeveria Pink Champagne — Marble Textured Pink Blushed Rosette', regularPrice: 219, salePrice: 159, availability: 'In stock' },
  { title: 'Pachyveria Scheideckeri — Ice Blue Pointed Leaf Succulent', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Tolimanensis — Cylinder Leaf Silvery Slate Rosette', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Haworthia Pygmaea — Crystallized Sugar Texturized Leaf Window', regularPrice: 219, salePrice: 159, availability: 'In stock' },
  { title: 'Echeveria Monocerotis — Sharp Red Tipped Mint Rosette Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Crassula Falcata — Propeller Plant Red Airplane Flower', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Trumpet Pink — Tubular Horn Shaped Pink Rosette', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Sedum Dasiphyllum Major — Corsican Stonecrop Tiny Blue Beads', regularPrice: 129, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria White Rose — Pure Alabaster Pale Mint Rosette', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Haworthia Springbokvlakensis — Mirrored Glossy Top Window Succulent', regularPrice: 399, salePrice: 299, availability: 'In stock' },
  { title: 'Echeveria Mexican Giant — Massive Snow White Powdered Rosette', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Graptopetalum Bellum — Deep Rose Pink Star Flowering Succulent', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Cante — Queen of Echeverias Neon Pink Edge Rosette', regularPrice: 349, salePrice: 249, availability: 'In stock' },
  { title: 'Aloe Pink Blush — Textured Coral Tipped Miniature Aloe', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Romeo — Fiery Deep Crimson Red Wax Rosette', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Crassula \'Moonglow\' — Super Stacked Velvet Soft Column', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Echeveria Sunyan — Marbled Blood Red Speckled Rosette', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Haworthia Emelyae var. Major — Silver Speckled Window Rosette', regularPrice: 269, salePrice: 189, availability: 'In stock' },
  { title: 'Echeveria Culibra — Unique Twisted Curled Leaf Mint Rosette', regularPrice: 279, salePrice: 199, availability: 'In stock' },
  { title: 'Pachyphytum Oviferum Roseum — Pink Moonstones Soft Round', regularPrice: 219, salePrice: 159, availability: 'In stock' },
  { title: 'Echeveria Ebony — Jet Black Pointed Tips Wax Agavoides', regularPrice: 269, salePrice: 189, availability: 'In stock' },
  { title: 'Kalanchoe Uniflora — Coral Trailing Bell Flower Succulent', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Echeveria Rainbow — Variegated Magenta Yellow Striped Rosette', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Haworthia Koelmaniorum — Dark Chocolate Bronze Rough Textured', regularPrice: 349, salePrice: 249, availability: 'In stock' },
  { title: 'Echeveria Bloody Maria — Intense Blood Red Edged Wax Rosette', regularPrice: 239, salePrice: 169, availability: 'In stock' },
  { title: 'Sedum Burrito — Baby Burro\'s Tail Compact Trailing Beads', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Morning Light — Pastel Pink Variegated Powder Rosette', regularPrice: 259, salePrice: 179, availability: 'In stock' },
  { title: 'Crassula \'Buddha\'s Temple\' — Perfectly Square Stacking Pagoda', regularPrice: 299, salePrice: 219, availability: 'In stock' },
  { title: 'Echeveria Fire Light — Golden Orange Crimson Edge Rosette', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Haworthia Splendens — Ultra Glossy Dark Window Flecked Silver', regularPrice: 379, salePrice: 269, availability: 'In stock' },
  { title: 'Echeveria White Sunset — Soft Cream Blushed Pastel Rosette', regularPrice: 219, salePrice: 159, availability: 'In stock' },
  { title: 'Sinocrassula Younioi — Crested Black Dragon Jet Black Crown', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Echeveria Orange Monroe — Deep Peach Orange Powdered Rosette', regularPrice: 239, salePrice: 169, availability: 'In stock' },
  { title: 'Aloe \'Oik\' — Rare Hybrid Spiky Coral Edged Succulent', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Echeveria Ice Green — Translucent Jelly Mint Tipped Rosette', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Pachyveria Royal Flush — Rich Violet Purple Chunky Rosette', regularPrice: 179, salePrice: 129, availability: 'In stock' },
  { title: 'Echeveria Red Velvet — Soft Fuzzy Crimson Center Rosette', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Haworthia Baccata — White Pearl Beaded Dark Green Succulent', regularPrice: 239, salePrice: 169, availability: 'In stock' },
  { title: 'Echeveria Sea Dragon — Carunculated Warty Purple Ruffled Rosette', regularPrice: 289, salePrice: 199, availability: 'In stock' },
  { title: 'Graptoveria Silver Star — Needle Point Tipped Compact Rosette', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Echeveria Sugar Jelly — Sweet Translucent Pink Tipped Rosette', regularPrice: 209, salePrice: 149, availability: 'In stock' },
  { title: 'Crassula Umbrella — Disk-shaped Stacking Golden Green Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Pink Granite — Chunky Rose Quartz Marble Rosette', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Haworthia Matrix — Grid-Patterned Translucent Leaf Windows', regularPrice: 329, salePrice: 229, availability: 'In stock' },
  { title: 'Echeveria Dark Ice — Silvery Obsidian Tipped Pastel Rosette', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Sedum Jelly Beans Gold — Bright Golden Yellow Sunlight Succulent', regularPrice: 119, salePrice: 79, availability: 'In stock' },
  { title: 'Echeveria Neon Pink — Electric Bright Pink Margin Rosette', regularPrice: 189, salePrice: 129, availability: 'In stock' },
  { title: 'Pachyphytum Hookeri — Long Cylinder Blue Powdered Leaves', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Echeveria Peach Pride — Smooth Peach Tipped Mint Green Rosette', regularPrice: 139, salePrice: 89, availability: 'In stock' },
  { title: 'Haworthia Marxii — Ultra Rare Dark Geometric Window Succulent', regularPrice: 499, salePrice: 349, availability: 'In stock' },
  { title: 'Echeveria Blue Elf — Multi-clustering Red Tipped Blue Rosettes', regularPrice: 159, salePrice: 109, availability: 'In stock' },
  { title: 'Kalanchoe Pumila — Silver Frost Powdered Violet Flower Succulent', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Echeveria Raspberry Ice — Translucent Pinkish Red Edged Rosette', regularPrice: 199, salePrice: 139, availability: 'In stock' },
  { title: 'Crassula Ivory Pagoda — Thick Cream Colored Column Succulent', regularPrice: 249, salePrice: 179, availability: 'In stock' },
  { title: 'Echeveria Snow Candy — Soft Pastel Pink Powdered White Rosette', regularPrice: 219, salePrice: 159, availability: 'In stock' },
  { title: 'Haworthia Black Beaded — Dark Jet Green Pearl Texturized Leaves', regularPrice: 229, salePrice: 159, availability: 'In stock' },
  { title: 'Echeveria Crimson Tide — Deep Red Frilled Margin Large Rosette', regularPrice: 269, salePrice: 189, availability: 'In stock' },
  { title: 'Pachyveria Opalina — Iridescent Pink Powdered Chunky Succulent', regularPrice: 169, salePrice: 119, availability: 'In stock' },
  { title: 'Echeveria Moon Gadonis — Bright Lime Green Pink Edged Rosette', regularPrice: 149, salePrice: 99, availability: 'In stock' },
  { title: 'Pincushion Cactus — Compact Globe Indoor Cactus', regularPrice: 210, salePrice: 150, availability: 'Out of stock' },
];

loadEnv(path.join(__dirname, '..', '.env.local'));
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('products').get();
  const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const map = new Map();
  for (const row of docs) {
    map.set(normalizeTitle(row.title), row);
  }

  const result = { updated: [], missing: [], notMatched: [] };
  for (const change of updates) {
    const key = normalizeTitle(change.title);
    const match = map.get(key);
    if (!match) {
      result.missing.push({ title: change.title, key });
      continue;
    }

    const inStock = /in stock/i.test(change.availability);
    const update = {
      price: Number(change.salePrice),
      compareAtPrice: Number(change.regularPrice),
      available: inStock,
      inventoryQuantity: inStock ? 1 : 0,
      status: inStock ? 'active' : 'sold out',
      availability: inStock ? 'InStock' : 'OutOfStock',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('products').doc(match.id).set(update, { merge: true });
    result.updated.push({
      id: match.id,
      title: match.title,
      price: update.price,
      compareAtPrice: update.compareAtPrice,
      availability: update.availability,
      status: update.status,
    });
  }

  result.notMatched = docs.filter((row) => !updates.some((change) => normalizeTitle(change.title) === normalizeTitle(row.title))).slice(0, 5).map((row) => row.title);

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
