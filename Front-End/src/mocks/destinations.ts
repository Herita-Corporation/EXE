// MOCK — Home's "Special Offers" and "Popular Destinations" carousels have no
// backend today: AI-Itinerary keeps attractions/restaurants/hotels purely as
// internal RAG-retrieval data (no public "list" endpoint), and no offers/
// promotions service exists anywhere in Disa-App. Images are generic
// placeholder photography (picsum.photos) until real assets exist.

export interface Offer {
  id: string;
  icon: "cafe-outline" | "bed-outline" | "airplane-outline";
  title: string;
  location: string;
  offerText: string;
}

export interface Destination {
  id: string;
  name: string;
  region: string;
  rating: number;
  image: string;
}

export const MOCK_OFFERS: Offer[] = [
  {
    id: "offer-1",
    icon: "cafe-outline",
    title: "Highland Coffee",
    location: "Vincom Center",
    offerText: "Buy 1 – Get 1 Free",
  },
  {
    id: "offer-2",
    icon: "bed-outline",
    title: "Hotel Deal",
    location: "Da Nang Beach Resort",
    offerText: "15% Off Room Rate",
  },
  {
    id: "offer-3",
    icon: "airplane-outline",
    title: "Airport Lounge",
    location: "Tan Son Nhat T2",
    offerText: "Complimentary Access",
  },
];

export const MOCK_DESTINATIONS: Destination[] = [
  {
    id: "dest-1",
    name: "Ninh Binh",
    region: "North Vietnam",
    rating: 4.9,
    image: "https://picsum.photos/seed/disa-ninhbinh/600/400",
  },
  {
    id: "dest-2",
    name: "Da Nang",
    region: "Central Vietnam",
    rating: 4.7,
    image: "https://picsum.photos/seed/disa-danang/600/400",
  },
  {
    id: "dest-3",
    name: "Hoi An",
    region: "Central Vietnam",
    rating: 4.8,
    image: "https://picsum.photos/seed/disa-hoian2/600/400",
  },
  {
    id: "dest-4",
    name: "Ha Long Bay",
    region: "North Vietnam",
    rating: 4.9,
    image: "https://picsum.photos/seed/disa-halong2/600/400",
  },
];
