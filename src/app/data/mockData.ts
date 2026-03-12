export interface Livestock {
  id: string;
  title: string;
  category: 'Cattle' | 'Goats' | 'Sheep' | 'Pigs' | 'Chickens' | 'Other';
  breed: string;
  currentBid: number;
  startingPrice: number;
  age: string;
  weight: string;
  location: string;
  seller: {
    name: string;
    avatar: string;
    verified: boolean;
    rating: number;
    salesCount: number;
  };
  description: string;
  imageUrl: string;
  bidCount: number;
  viewCount: number;
  timeLeft: string;
  endTime: Date;
  bids: Bid[];
  health: 'Excellent' | 'Good' | 'Fair';
  status: 'active' | 'ended';
}

export interface Bid {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  timestamp: Date;
  isWinner?: boolean;
}

export interface PaymentRecord {
  id: string;
  reference: string;
  itemTitle: string;
  amount: number;
  method: 'EcoCash' | 'OneMoney' | 'Card';
  status: 'pending' | 'paid' | 'failed';
  date: Date;
}

export interface Notification {
  id: string;
  type: 'bid' | 'message' | 'auction_ending' | 'auction_won' | 'auction_lost' | 'verification' | 'payment';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

// Current user (mock)
export const currentUser = {
  id: 'user-1',
  name: 'You',
  phone: '0771234567',
  email: 'you@example.com',
};

// Mock livestock data
export const mockLivestock: Livestock[] = [
  {
    id: '1',
    title: 'Ngoni Bull',
    category: 'Cattle',
    breed: 'Brahman',
    currentBid: 1200,
    startingPrice: 800,
    age: '3 yrs',
    weight: '450 kg',
    location: 'Harare',
    seller: {
      name: 'John M.',
      avatar: 'JM',
      verified: true,
      rating: 4.8,
      salesCount: 23,
    },
    description: 'Fine Ngoni bull, excellent breeding stock. Healthy, well-maintained, and ready for new pastures. Raised on quality feed with regular veterinary care.',
    imageUrl: 'https://images.unsplash.com/photo-1762202207738-e0b4b905922d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmFobWFuJTIwYnVsbCUyMGNhdHRsZXxlbnwxfHx8fDE3NzMzMDU4MDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 12,
    viewCount: 89,
    timeLeft: '2h',
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    bids: [
      { id: 'b1', userId: 'user-1', userName: 'You', amount: 1200, timestamp: new Date(), isWinner: true },
      { id: 'b2', userId: 'user-2', userName: 'Peter K.', amount: 1100, timestamp: new Date(Date.now() - 1000 * 60 * 30) },
      { id: 'b3', userId: 'user-3', userName: 'Sarah M.', amount: 1000, timestamp: new Date(Date.now() - 1000 * 60 * 60) },
    ],
    health: 'Excellent',
    status: 'active',
  },
  {
    id: '2',
    title: 'Boer Goat Pair',
    category: 'Goats',
    breed: 'Boer',
    currentBid: 350,
    startingPrice: 250,
    age: '2 yrs',
    weight: '65 kg each',
    location: 'Bulawayo',
    seller: {
      name: 'Grace T.',
      avatar: 'GT',
      verified: true,
      rating: 4.9,
      salesCount: 15,
    },
    description: 'Healthy pair of Boer goats. Great for breeding or meat production. Both females, well cared for.',
    imageUrl: 'https://images.unsplash.com/photo-1677974515169-06644fba2b2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2VyJTIwZ29hdCUyMGZhcm18ZW58MXx8fHwxNzczMzA1ODA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 8,
    viewCount: 56,
    timeLeft: '5h',
    endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
    bids: [
      { id: 'b4', userId: 'user-4', userName: 'Mark L.', amount: 350, timestamp: new Date(), isWinner: true },
      { id: 'b5', userId: 'user-1', userName: 'You', amount: 320, timestamp: new Date(Date.now() - 1000 * 60 * 45) },
    ],
    health: 'Good',
    status: 'active',
  },
  {
    id: '3',
    title: 'Merino Sheep',
    category: 'Sheep',
    breed: 'Merino',
    currentBid: 180,
    startingPrice: 120,
    age: '1.5 yrs',
    weight: '45 kg',
    location: 'Mutare',
    seller: {
      name: 'David N.',
      avatar: 'DN',
      verified: false,
      rating: 4.5,
      salesCount: 8,
    },
    description: 'Quality Merino sheep with excellent wool. Perfect for breeding or wool production.',
    imageUrl: 'https://images.unsplash.com/photo-1646375445707-cf5c2f2e78f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXJpbm8lMjBzaGVlcCUyMHdvb2x8ZW58MXx8fHwxNzczMzA1ODA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 5,
    viewCount: 34,
    timeLeft: '1d',
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    bids: [
      { id: 'b6', userId: 'user-5', userName: 'Jane R.', amount: 180, timestamp: new Date(), isWinner: true },
    ],
    health: 'Good',
    status: 'active',
  },
  {
    id: '4',
    title: 'Large White Pig',
    category: 'Pigs',
    breed: 'Large White',
    currentBid: 420,
    startingPrice: 300,
    age: '8 months',
    weight: '110 kg',
    location: 'Gweru',
    seller: {
      name: 'Peter S.',
      avatar: 'PS',
      verified: true,
      rating: 4.7,
      salesCount: 19,
    },
    description: 'Healthy Large White pig, ready for market. Well-fed and vaccinated.',
    imageUrl: 'https://images.unsplash.com/photo-1764943051090-991c5a82174c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYXJnZSUyMHdoaXRlJTIwcGlnJTIwZmFybXxlbnwxfHx8fDE3NzMzMDU4MDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 15,
    viewCount: 102,
    timeLeft: '3h',
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
    bids: [
      { id: 'b7', userId: 'user-1', userName: 'You', amount: 420, timestamp: new Date(), isWinner: true },
      { id: 'b8', userId: 'user-6', userName: 'Tom W.', amount: 400, timestamp: new Date(Date.now() - 1000 * 60 * 20) },
    ],
    health: 'Excellent',
    status: 'active',
  },
  {
    id: '5',
    title: 'Rhode Island Chickens',
    category: 'Chickens',
    breed: 'Rhode Island Red',
    currentBid: 80,
    startingPrice: 50,
    age: '6 months',
    weight: '10 chickens',
    location: 'Masvingo',
    seller: {
      name: 'Susan K.',
      avatar: 'SK',
      verified: true,
      rating: 4.6,
      salesCount: 31,
    },
    description: 'Set of 10 healthy Rhode Island Red chickens. Great layers, vaccinated and dewormed.',
    imageUrl: 'https://images.unsplash.com/photo-1589985002172-2fc5a9fa75b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaG9kZSUyMGlzbGFuZCUyMHJlZCUyMGNoaWNrZW5zfGVufDF8fHx8MTc3MzMwNTgwNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 6,
    viewCount: 45,
    timeLeft: '6h',
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
    bids: [
      { id: 'b9', userId: 'user-7', userName: 'Alice B.', amount: 80, timestamp: new Date(), isWinner: true },
    ],
    health: 'Good',
    status: 'active',
  },
  {
    id: '6',
    title: 'Hereford Cattle',
    category: 'Cattle',
    breed: 'Hereford',
    currentBid: 1500,
    startingPrice: 1200,
    age: '4 yrs',
    weight: '520 kg',
    location: 'Kadoma',
    seller: {
      name: 'Robert M.',
      avatar: 'RM',
      verified: true,
      rating: 4.9,
      salesCount: 27,
    },
    description: 'Premium Hereford cattle. Excellent genetics, perfect for beef production or breeding.',
    imageUrl: 'https://images.unsplash.com/photo-1554798372-9f6d1831bd96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZXJlZm9yZCUyMGNhdHRsZSUyMGJlZWZ8ZW58MXx8fHwxNzczMzA1ODA1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    bidCount: 18,
    viewCount: 134,
    timeLeft: '12h',
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
    bids: [
      { id: 'b10', userId: 'user-8', userName: 'Frank D.', amount: 1500, timestamp: new Date(), isWinner: true },
    ],
    health: 'Excellent',
    status: 'active',
  },
];

// Mock payment history
export const mockPayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    reference: 'PAY-2026-0312',
    itemTitle: 'Boer Goat',
    amount: 1260,
    method: 'EcoCash',
    status: 'paid',
    date: new Date('2026-03-12'),
  },
  {
    id: 'pay-2',
    reference: 'PAY-2026-0311',
    itemTitle: 'Ngoni Bull',
    amount: 350,
    method: 'OneMoney',
    status: 'pending',
    date: new Date('2026-03-11'),
  },
];

// Mock notifications
export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'bid',
    title: 'New bid on your listing',
    message: 'New bid on your Ngoni Bull: $1,300',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    read: false,
    priority: 'high',
  },
  {
    id: 'notif-2',
    type: 'auction_ending',
    title: 'Auction ending soon',
    message: 'Auction ending in 30 minutes',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false,
    priority: 'medium',
  },
  {
    id: 'notif-3',
    type: 'auction_won',
    title: 'Congratulations!',
    message: 'You won the auction for Boer Goat Pair',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    read: true,
    priority: 'high',
  },
];

export const locations = ['Harare', 'Bulawayo', 'Mutare', 'Masvingo', 'Gweru', 'Chinhoyi', 'Kadoma', 'Kwekwe'];
export const categories = ['Cattle', 'Goats', 'Sheep', 'Pigs', 'Chickens', 'Other'] as const;
export const healthStatuses = ['Excellent', 'Good', 'Fair'] as const;
export const durations = ['1 day', '3 days', '7 days', '14 days'] as const;