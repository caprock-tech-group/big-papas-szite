export const metadata = {
  title: 'Menu – Big Papa’s Texas Loaded Potatoes',
  description: 'Browse our mouth‑watering menu of signature and specialty loaded potatoes, sides, drinks, and desserts.',
};

interface MenuItem {
  name: string;
  description: string;
  price: string;
}

interface MenuCategory {
  title: string;
  items: MenuItem[];
}

const menu: MenuCategory[] = [
  {
    title: 'Signature Potatoes',
    items: [
      {
        name: 'The Big Hoss',
        description: 'Brisket, queso, bacon, chives',
        price: '$12.00',
      },
      {
        name: 'Pulled Pork Papa',
        description: 'Pulled pork, BBQ sauce, cheddar cheese',
        price: '$11.00',
      },
      {
        name: 'Taco Tater',
        description: 'Seasoned ground beef, cheddar cheese, salsa, queso',
        price: '$10.50',
      },
    ],
  },
  {
    title: 'Specialty Potatoes',
    items: [
      {
        name: 'Mac Daddy',
        description: 'Mac and cheese, bacon bits',
        price: '$10.00',
      },
      {
        name: 'Pepperoni Pizza Potato',
        description: 'Pepperoni, mozzarella, marinara sauce',
        price: '$10.50',
      },
      {
        name: 'Broccoli Cheddar',
        description: 'Broccoli florets, cheddar cheese',
        price: '$9.50',
      },
    ],
  },
  {
    title: 'Sides',
    items: [
      {
        name: 'Queso & Chips',
        description: 'Warm queso served with tortilla chips',
        price: '$4.00',
      },
      {
        name: 'Brisket Bites',
        description: 'Smoked brisket burnt ends',
        price: '$6.00',
      },
      {
        name: 'Loaded Fries',
        description: 'Fries topped with queso, bacon, green onions',
        price: '$5.50',
      },
    ],
  },
  {
    title: 'Drinks',
    items: [
      {
        name: 'Sweet Tea',
        description: 'House‑brewed sweet iced tea',
        price: '$2.50',
      },
      {
        name: 'Lemonade',
        description: 'Freshly squeezed',
        price: '$2.50',
      },
      {
        name: 'Soft Drinks',
        description: 'Assorted sodas',
        price: '$2.00',
      },
    ],
  },
  {
    title: 'Desserts',
    items: [
      {
        name: 'Banana Pudding',
        description: 'Classic Southern banana pudding',
        price: '$3.50',
      },
      {
        name: 'Peach Cobbler',
        description: 'Warm peach cobbler with cinnamon',
        price: '$4.00',
      },
    ],
  },
];

export default function MenuPage() {
  return (
    <div className="py-16 bg-accent min-h-screen">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="font-display text-4xl text-primary mb-8">Menu</h1>
        {menu.map((category) => (
          <div key={category.title} className="mb-12">
            <h2 className="font-display text-2xl text-primary mb-4">{category.title}</h2>
            <div className="divide-y divide-brown bg-white rounded-lg shadow-md overflow-hidden">
              {category.items.map((item, index) => (
                <div
                  key={item.name}
                  className={`px-4 py-4 flex justify-between ${index === 0 ? '' : ''}`}
                >
                  <div>
                    <h3 className="font-display text-lg text-primary">{item.name}</h3>
                    <p className="text-secondary text-sm">{item.description}</p>
                  </div>
                  <div className="font-semibold text-primary">{item.price}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}