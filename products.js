// ===== SHOP SETTINGS (ikkada marchukovachu) =====
const SHOP = {
  name: "Oo_Sathyabhama",
  whatsapp: "919392271439", // country code 91 + number
  currency: "₹",
  sizes: ["S", "M", "L", "XL", "XXL"],
  // PhonePe / UPI payment (manual verification). Put your business UPI ID here.
  // Example: vpa: "oosathyabhama@ybl". Leave "" to take payment details on WhatsApp instead.
  upi: { vpa: "9392271439@ybl", name: "Oo_Sathyabhama" },
  deliveryCharge: 50,
  // false = if the database has no active products, show an empty shop (recommended).
  // true  = show the 6 sample dresses below (old behaviour). Sample items cannot be bought online.
  useDemoFallback: false
};

// ===== PRODUCTS: price, name ikkada marchandi =====
// Kotta dress add cheyalante images folder lo photo petti, ikkada oka line add cheyandi.
const PRODUCTS = [
  { id: 1, name: "Mustard Yellow Kurta Set", desc: "Soft cotton kurta with floral kalamkari-style dupatta", price: 1150, image: "images/dress1.jpg" },
  { id: 2, name: "Royal Blue Kurta Set", desc: "Cotton kurta with zari border printed dupatta", price: 1150, image: "images/dress2.jpg" },
  { id: 3, name: "Green Floral Kurta Set", desc: "Cotton kurta with shaded green floral dupatta", price: 1150, image: "images/dress3.jpg" },
  { id: 4, name: "Red Floral Kurta Set", desc: "Cotton kurta with red floral shaded dupatta", price: 1150, image: "images/dress4.jpg" },
  { id: 5, name: "Bottle Green Tassel Dupatta Set", desc: "Kurta with elephant motif dupatta and tassels", price: 1150, image: "images/dress5.jpg" },
  { id: 6, name: "Mustard Check Tassel Dupatta Set", desc: "Checked kurta with elephant motif dupatta and tassels", price: 1150, image: "images/dress6.jpg" }
];
