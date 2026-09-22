const udaipur =
  "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop";
const varanasi =
  "https://images.unsplash.com/photo-1768123668769-a575ec482e39?fm=jpg&q=75&w=1400&auto=format&fit=crop";
const ladakh =
  "https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop";
const jaipur =
  "https://images.unsplash.com/photo-1772533254933-ee692487aba2?fm=jpg&q=75&w=1400&auto=format&fit=crop";

export const destinations = [
  {
    id: "udaipur",
    name: "Udaipur",
    country: "Rajasthan, India",
    image: udaipur,
    rating: 4.9,
    price: 74000,
    tag: "City of Lakes",
    days: 6,
  },
  {
    id: "varanasi",
    name: "Varanasi",
    country: "Uttar Pradesh, India",
    image: varanasi,
    rating: 4.8,
    price: 60000,
    tag: "Spiritual",
    days: 5,
  },
  {
    id: "ladakh",
    name: "Ladakh",
    country: "Himalayas, India",
    image: ladakh,
    rating: 4.9,
    price: 118000,
    tag: "Adventure",
    days: 9,
  },
  {
    id: "jaipur",
    name: "Jaipur",
    country: "Rajasthan, India",
    image: jaipur,
    rating: 4.7,
    price: 54000,
    tag: "Pink City",
    days: 4,
  },
];

export const upcomingTrips = [
  {
    id: "1",
    title: "Rajasthan Royal Loop",
    destination: "Udaipur, India",
    image: udaipur,
    dates: "Jun 12 – Jun 18",
    daysLeft: 24,
    travelers: 2,
    progress: 78,
  },
  {
    id: "2",
    title: "Himalayan High",
    destination: "Ladakh, India",
    image: ladakh,
    dates: "Sep 04 – Sep 13",
    daysLeft: 138,
    travelers: 4,
    progress: 32,
  },
];

export const activity = [
  { id: 1, text: "AI drafted your Varanasi itinerary", time: "2h ago", type: "ai" },
  { id: 2, text: "Maya joined the Udaipur trip", time: "5h ago", type: "group" },
  { id: 3, text: "Flight to Leh dropped 14%", time: "yesterday", type: "deal" },
  { id: 4, text: "Booked Taj Lake Palace, Udaipur", time: "2d ago", type: "booking" },
];

export const budgetCategories = [
  { name: "Flights", spent: 28000, total: 42000, color: "var(--color-primary)" },
  { name: "Stays", spent: 35000, total: 58000, color: "var(--color-accent)" },
  { name: "Food", spent: 13000, total: 25000, color: "var(--color-secondary)" },
  { name: "Activities", spent: 12000, total: 23000, color: "var(--color-warning)" },
  { name: "Transit", spent: 4500, total: 10000, color: "var(--color-chart-5)" },
];

export const timeline = [
  {
    day: 1,
    date: "Jun 12",
    title: "Arrive in Udaipur",
    items: [
      {
        time: "10:00",
        title: "Land at Maharana Pratap Airport (UDR)",
        type: "transport",
        meta: "IndiGo 6E 5311",
      },
      { time: "12:30", title: "Check in — Taj Lake Palace", type: "stay", meta: "Lake-view suite" },
      {
        time: "18:00",
        title: "Sunset dinner at Ambrai",
        type: "food",
        meta: "Reserved · 2 guests",
      },
    ],
  },
  {
    day: 2,
    date: "Jun 13",
    title: "City Palace & Old Town",
    items: [
      {
        time: "09:00",
        title: "City Palace + Crystal Gallery",
        type: "activity",
        meta: "3 hr guided",
      },
      {
        time: "14:00",
        title: "Cooking class in Hanuman Ghat",
        type: "activity",
        meta: "Thali workshop",
      },
      {
        time: "20:30",
        title: "Live sitar at Jheel's Ginger Coffee Bar",
        type: "activity",
        meta: "Optional",
      },
    ],
  },
  {
    day: 3,
    date: "Jun 14",
    title: "Lake Pichola & Villages",
    items: [
      {
        time: "08:30",
        title: "Boat ride to Jag Mandir",
        type: "transport",
        meta: "Sunrise cruise",
      },
      { time: "13:00", title: "Lunch at Jag Mandir", type: "food", meta: "Included" },
      { time: "19:00", title: "Free evening in old Udaipur", type: "activity", meta: "" },
    ],
  },
];

export const groupMembers = [
  { name: "You", role: "Organizer", initials: "YO", color: "bg-primary text-primary-foreground" },
  {
    name: "Maya Patel",
    role: "Confirmed",
    initials: "MP",
    color: "bg-accent text-accent-foreground",
  },
  {
    name: "Arjun Mehta",
    role: "Confirmed",
    initials: "AM",
    color: "bg-secondary text-secondary-foreground",
  },
  { name: "Priya Sharma", role: "Pending", initials: "PS", color: "bg-muted text-foreground" },
];

export const chatSeed = [
  {
    role: "assistant" as const,
    text: "Namaste, I'm Advenza. Tell me where in India you'd like to go — or say 'surprise me'.",
  },
  {
    role: "user" as const,
    text: "Plan a 5-day trip through Kerala with great food and backwaters.",
  },
  {
    role: "assistant" as const,
    text: "Lovely choice. I'd suggest 2 nights in Fort Kochi (Chinese fishing nets, Mattancherry spice walk), 1 night houseboat in Alleppey backwaters, and 2 nights in Munnar for the tea estates. Want me to draft the full itinerary?",
  },
];
