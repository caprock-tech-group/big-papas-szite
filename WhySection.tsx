export const metadata = {
  title: 'Locations & Events – Big Papa’s Texas Loaded Potatoes',
  description: 'Find out where Big Papa’s trailer will be next. See our current location and upcoming events in the Texas Panhandle.',
};

interface EventItem {
  date: string;
  title: string;
  location: string;
}

const events: EventItem[] = [
  {
    date: 'June 15, 2026',
    title: 'Claude Farmer’s Market',
    location: 'Main Street, Claude, TX',
  },
  {
    date: 'June 21, 2026',
    title: 'Amarillo Food Truck Rally',
    location: 'Downtown Amarillo, TX',
  },
  {
    date: 'July 4, 2026',
    title: 'Fourth of July Festival',
    location: 'Claude Community Park, Claude, TX',
  },
];

export default function LocationsPage() {
  return (
    <div className="py-16 bg-accent min-h-screen">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="font-display text-4xl text-primary mb-6">Locations &amp; Events</h1>
        <div className="mb-8">
          <h2 className="font-display text-2xl text-primary mb-2">Current Location</h2>
          <p>Find us today at <strong>Main Street, Claude, TX</strong> from 11am to 8pm.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl text-primary mb-4">Upcoming Events</h2>
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.title} className="bg-white p-4 rounded-md shadow-md flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl text-primary">{event.title}</h3>
                  <p className="text-secondary text-sm">{event.location}</p>
                </div>
                <div className="text-primary font-semibold">{event.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}