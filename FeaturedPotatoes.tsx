@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Rye&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Define CSS variables for font families */
:root {
  --font-display: 'Rye';
  --font-body: 'Inter';
}

body {
  @apply font-body bg-accent text-secondary antialiased;
}