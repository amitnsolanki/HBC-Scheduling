export interface BookingResult {
  Id: number;
  Location: string;
  EventStart: string;
  EventEnd: string;
  EventName: string;
  GroupName: string;
  TimeBookingStart: string;
  StatusTypeId: number;
  GmtEnd?: string;
}

export interface Signup {
  id: string;
  eventId: number;
  uid: string;
  name: string;
  arrivalTime?: string;
  duration?: string;
  level?: string;
  time?: string;
  createdAt: any;
}

export type SkillLevel = 'National' | 'Advanced' | 'Intermediate-Advanced' | 'Intermediate' | 'Intermediate-Beginner' | 'Beginner';

export interface PlayStylePreference {
  style: 'Singles' | 'Doubles' | 'Mixed';
  preference: number; // 0 to 5
  level: SkillLevel | '';
}

export interface Racket {
  id: string;
  name: string;
  weight: '3U' | '4U' | '5U' | '6U' | '7U' | '8U' | '';
  gripSize: string;
  gripType: 'Towel' | 'Tacky' | 'Dry' | '';
  isCurrent: boolean;
  isFavorite: boolean;
  photoURL?: string;
}

export interface Shoe {
  id: string;
  name: string;
  size: string;
  isCurrent: boolean;
  isFavorite: boolean;
  photoURL?: string;
}

export interface BadmintonString {
  id: string;
  name: string;
  tensionMain: number | '';
  tensionCross: number | '';
  isCurrent: boolean;
  isFavorite: boolean;
  photoURL?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  gender?: 'Male' | 'Female';
  level: SkillLevel;
  role?: 'admin' | 'user';
  rackets?: Racket[];
  shoes?: Shoe[];
  strings?: BadmintonString[];
  playStyles?: PlayStylePreference[];
  styleOfPlay?: string[];
  dominantHand?: string;
  playingSince?: number;
  homeClub?: string;
  bio?: string;
  updatedAt: any; // Firestore Timestamp
  isOnline?: boolean;
  lastSeen?: any;
}

export interface PlayerAssessment {
  id: string;
  assessorUid: string;
  assessedUid: string;
  assessorLevel: SkillLevel | 'Unknown';
  assessedLevel?: SkillLevel;
  singlesLevel?: SkillLevel;
  doublesLevel?: SkillLevel;
  mixedLevel?: SkillLevel;
  assessedStyles?: string[];
  suggestedStyles?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface GearReview {
  id: string;
  reviewerUid: string;
  targetUid: string;
  reviewerLevel: SkillLevel | 'Unknown';
  gearType: 'racket' | 'string' | 'shoe';
  gearId: string;
  comment: string;
  createdAt: any;
  updatedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string; // Optional for group messages
  text: string;
  timestamp: any;
  read?: boolean; // Optional for group messages where read receipts are different
  context?: string;
}

export interface Chat {
  id: string; // combined uid1_uid2
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
  };
  unreadCount: Record<string, number>;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  admins: string[];
  members: string[];
  createdAt: any;
  updatedAt: any;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
  };
}

export interface GroupRequest {
  id: string;
  groupId: string;
  userId: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: any;
}

