export const metadata = {
  title: 'About – Big Papa’s Texas Loaded Potatoes',
  description: 'Learn about the family behind Big Papa’s, our Texas roots, and our commitment to quality and community.',
};

export default function AboutPage() {
  return (
    <div className="py-16 bg-accent min-h-screen">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <h1 className="font-display text-4xl text-primary mb-4">Our Story</h1>
        <p>
          Big Papa’s Texas Loaded Potatoes began as a dream shared by our family in Claude, Texas. We wanted to bring something
          uniquely Texan to the table—hearty meals overflowing with flavor and served with genuine hospitality. Drawing on our
          ranching roots and a passion for good food, we perfected the art of the loaded potato, pairing slow‑smoked meats and
          scratch‑made toppings with the humble spud.
        </p>
        <p>
          Our menu is inspired by the traditions of Texas barbecue and the generous spirit of the Panhandle. Each potato is a
          canvas for bold ingredients: brisket smoked low and slow over mesquite wood, creamy queso crafted from real cheese,
          crispy bacon, and fresh produce sourced from local farms whenever possible. We believe that great food comes from
          great ingredients and the love you put into cooking.
        </p>
        <p>
          Beyond serving delicious food, we’re committed to our community. You’ll find us at local festivals, school events,
          and church gatherings, sharing the Big Papa’s experience with our neighbors. When you visit our trailer, you’re not
          just another customer—you’re part of the family. Come hungry and leave happy; that’s the Big Papa’s way.
        </p>
        <p className="font-display text-2xl text-primary mt-8">Come hungry.</p>
      </div>
    </div>
  );
}