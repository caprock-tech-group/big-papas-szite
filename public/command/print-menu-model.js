function cents(value) {
  const amount = Number(String(value ?? "").replace(/^\$/, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

const visible = (items) => Array.isArray(items)
  ? items.filter((item) => item && typeof item.name === "string" && item.visible !== false)
  : [];

export function printableMenu(menu) {
  if (!menu || !Array.isArray(menu.products) || !menu.board) throw new Error("The published menu could not be loaded.");
  const lunch = menu.lunchPricing?.enabled === true;
  const cooking = menu.board.tatersCooking === true;
  const friesEnabled = menu.friesEnabled !== false;
  const products = visible(menu.products).map((item) => ({
    ...item,
    printPrice: lunch ? `$${(Math.max(0, cents(item.price) - cents(menu.lunchPricing.reduction)) / 100).toFixed(2)}` : item.price,
    status: item.available === false
      ? "Sold out"
      : cooking
        ? (friesEnabled ? "Fries only · baked potatoes cooking" : "Taters cooking · temporarily sold out")
        : "",
  }));
  return {
    board: { ...menu.board },
    products,
    lunch,
    cooking,
    friesEnabled,
    addOns: visible(menu.addOns),
    drinks: menu.drinksEnabled === false ? [] : visible(menu.drinks),
    desserts: visible(menu.desserts),
    combo: menu.drinksEnabled !== false && menu.combo?.enabled !== false ? menu.combo : null,
    cobblerCombo: menu.drinksEnabled !== false
      && menu.cobblerCombo?.enabled !== false
      && visible(menu.desserts).some((item) => item.available !== false)
      ? menu.cobblerCombo || { label: "Cobbler combo", description: "Any drink + choice of cobbler", price: "$5.00" }
      : null,
    updatedAt: menu.updatedAt,
  };
}
