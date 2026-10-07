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
  const products = visible(menu.products).map((item) => ({
    ...item,
    printPrice: lunch ? `$${(Math.max(0, cents(item.price) - cents(menu.lunchPricing.reduction)) / 100).toFixed(2)}` : item.price,
    status: item.available === false ? "Sold out" : cooking ? "Taters cooking · temporarily sold out" : "",
  }));
  return {
    board: { ...menu.board },
    products,
    lunch,
    cooking,
    addOns: visible(menu.addOns),
    drinks: menu.drinksEnabled === false ? [] : visible(menu.drinks),
    combo: menu.drinksEnabled !== false && menu.combo?.enabled !== false ? menu.combo : null,
    updatedAt: menu.updatedAt,
  };
}
