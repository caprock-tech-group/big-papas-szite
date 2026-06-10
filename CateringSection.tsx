export const metadata = {
  title: 'Catering – Big Papa’s Texas Loaded Potatoes',
  description: 'Request catering for your event with Big Papa’s. Perfect for weddings, corporate events, festivals, and more.',
};

export default function CateringPage() {
  return (
    <div className="py-16 bg-accent min-h-screen">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="font-display text-4xl text-primary mb-6">Catering Request</h1>
        <p className="mb-8">Tell us about your event and we’ll get back to you with a custom catering quote.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert('Thank you! We will contact you soon.');
          }}
          className="space-y-4 bg-white p-6 rounded-lg shadow-md"
        >
          <div>
            <label htmlFor="eventType" className="block font-medium mb-1">Event Type</label>
            <input
              type="text"
              id="eventType"
              required
              className="w-full px-4 py-2 border border-brown rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Corporate, Wedding, Festival..."
            />
          </div>
          <div>
            <label htmlFor="guestCount" className="block font-medium mb-1">Guest Count</label>
            <input
              type="number"
              id="guestCount"
              required
              className="w-full px-4 py-2 border border-brown rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Number of guests"
            />
          </div>
          <div>
            <label htmlFor="date" className="block font-medium mb-1">Event Date</label>
            <input
              type="date"
              id="date"
              required
              className="w-full px-4 py-2 border border-brown rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="location" className="block font-medium mb-1">Location</label>
            <input
              type="text"
              id="location"
              required
              className="w-full px-4 py-2 border border-brown rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="City or venue"
            />
          </div>
          <div>
            <label htmlFor="requests" className="block font-medium mb-1">Special Requests</label>
            <textarea
              id="requests"
              rows={4}
              className="w-full px-4 py-2 border border-brown rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Let us know about any specific menu items, dietary needs, or questions"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-md bg-primary text-accent font-semibold hover:bg-brown transition-colors"
          >
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );
}