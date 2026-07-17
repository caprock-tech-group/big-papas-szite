export const siteConfig = {
  name: "Big Papa's Texas Loaded Potatoes",
  shortName: "Big Papa's",
  tagline: "Big Portions. Bold Flavor. Texas Style.",
  description:
    "Texas-sized loaded baked potatoes served from a family-owned mobile kitchen based in Claude, Texas and rolling across the Texas Panhandle.",
  homeBase: "Claude, Texas",
  serviceArea: "Claude, Amarillo & the Texas Panhandle",
  facebookUrl: "https://www.facebook.com/bigpapastaters/",
  messengerUrl: "https://m.me/bigpapastaters",
  siteUrl: (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://bigpapastaters.com"
  ).replace(/\/+$/, ""),
  onlineOrderUrl: "https://online.skytab.com/s/bigpapastexasloadedpotatoes",
};

export const menuItems = [
  {
    name: "The Big Hoss",
    eyebrow: "Signature potato",
    price: "$18.99",
    description: "Smoked brisket, smoked queso, bacon, butter, sour cream, green onions, jalapeños, BBQ drizzle.",
    accent: "red",
    isNew: false,
  },
  {
    name: "Pulled Pork Papa",
    eyebrow: "Slow-cooked favorite",
    price: "$15.99",
    description: "Pulled pork, cheddar, butter, sour cream, jalapeños, crispy onions, BBQ sauce.",
    accent: "blue",
    isNew: false,
  },
  {
    name: "Taco Tater",
    eyebrow: "Tex-Mex favorite",
    price: "$14.99",
    description: "Seasoned taco meat, queso, cheddar, lettuce, pico, sour cream, jalapeños, tortilla strips.",
    accent: "gold",
    isNew: false,
  },
  {
    name: "Mac Daddy",
    eyebrow: "Comfort on comfort",
    price: "$13.99",
    description: "Mac & cheese, cheddar, bacon, sour cream, green onions.",
    accent: "red",
    isNew: false,
  },
  {
    name: "Pepperoni Pizza Potato",
    eyebrow: "Pizza night, reloaded",
    price: "$13.99",
    description: "Marinara, mozzarella, pepperoni, parmesan.",
    accent: "blue",
    isNew: false,
  },
  {
    name: "Broccoli Cheddar",
    eyebrow: "A classic combination",
    price: "$12.99",
    description: "Broccoli, cheddar cheese sauce, cheddar, butter, sour cream.",
    accent: "gold",
    isNew: false,
  },
  {
    name: "Chicken Fried Steak Tater",
    eyebrow: "Country comfort",
    price: "$15.99",
    description: "Chicken fried steak, country gravy, shredded cheese.",
    accent: "red",
    isNew: true,
  },
  {
    name: "Breakfast Tater",
    eyebrow: "Breakfast, loaded",
    price: "$14.99",
    description: "Sausage, bacon, egg, country gravy, shredded cheese.",
    accent: "blue",
    isNew: true,
  },
] as const;

export const menuAddOns = [
  { name: "Extra meat", price: "$3.00" },
  { name: "Extra cheese", price: "$1.00" },
  { name: "Bacon", price: "$1.50" },
  { name: "Jalapeños", price: "$0.75" },
  { name: "Sour cream", price: "$0.75" },
  { name: "BBQ sauce", price: "$0.75" },
  { name: "Ranch", price: "$0.75" },
  { name: "Green onions", price: "$0.50" },
] as const;

export const drinks = [
  { name: "Water", price: "$2.00" },
  { name: "Lemonade", price: "$3.00" },
  { name: "Soda", price: "$3.00" },
  { name: "Sweet tea", price: "$3.00" },
] as const;
