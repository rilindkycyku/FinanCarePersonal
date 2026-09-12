/**
 * Named icon registry. Categories and account types persist an icon *name* in IndexedDB (a
 * component can't be stored), so this maps those names back to lucide components. Anything
 * unknown falls back to `Circle` instead of crashing the row that references it.
 *
 * The list started at the 36 names the first default categories needed. Once those categories grew
 * subcategories the shortage showed: five children of "Ushqim & Pije" all drew the same shopping
 * trolley, and a picker where half the rows look alike is a picker nobody scrolls. Widened here
 * rather than in `CATEGORY_ICONS`, which is only the order they are *offered* in - this is what
 * makes a name resolvable at all, and a name that is already saved in somebody's database must
 * never be removed from it.
 */

import {
  // The original set. Every one of these is referenced by a default category or account type.
  Utensils, Coffee, ShoppingCart, Home, Zap, Smartphone, Car, Fuel, Bus,
  HeartPulse, Pill, Film, Music, Shirt, GraduationCap, BookOpen, Plane,
  Dumbbell, Gift, PawPrint, Baby, Scissors, Wrench, CreditCard, Briefcase,
  Coins, Laptop, TrendingUp, Landmark, Banknote, PiggyBank, Sparkles, Receipt,
  MoreHorizontal, Wallet, ArrowRightLeft, Shield, Scale, Circle,
  // Food and drink, which one trolley was answering for.
  Beef, Fish, Drumstick, Apple, Carrot, Wheat, Croissant, Pizza, Sandwich,
  Soup, Salad, IceCream, Milk, CupSoda, Wine, Beer,
  // The flat and the bills it generates, each of which arrives separately.
  Lightbulb, Droplet, Flame, Trash2, Sofa, Armchair, Bed, Bath, WashingMachine,
  Refrigerator, Hammer, Paintbrush, Key, Building, Building2, Factory, Store, Trees, Flower,
  // Getting around, and going away.
  Train, Bike, Ship, TramFront, CircleParking, Truck, Caravan, Luggage, Hotel,
  Tent, Mountain, MapPin, Sun, Umbrella, Ticket,
  // Health, chemist and the care that is not medicine.
  Stethoscope, Syringe, Glasses, Activity, Bandage, Brain, Smile, Hospital, Ambulance,
  SprayCan, Footprints,
  // Devices and what they subscribe to.
  Monitor, Tablet, Headphones, Camera, Tv, Watch, Printer, HardDrive, Cloud, Cpu,
  Gamepad2, Router, Wifi,
  // Money, paperwork and work itself.
  BadgePercent, Percent, HandCoins, Calculator, LineChart, Bitcoin, Vault, Handshake,
  Package, ScrollText, Stamp, FileText,
  // People, occasions and what is done for pleasure.
  Cake, PartyPopper, Heart, Users, Dog, Cat, Bone, Palette, Popcorn, Drama, Mic,
  Book, Newspaper, Pencil, Backpack, School, ShoppingBag,
  // Sport.
  Volleyball, Trophy, Medal,
} from "lucide-react";

export const ICONS = {
  Utensils, Coffee, ShoppingCart, Home, Zap, Smartphone, Car, Fuel, Bus,
  HeartPulse, Pill, Film, Music, Shirt, GraduationCap, BookOpen, Plane,
  Dumbbell, Gift, PawPrint, Baby, Scissors, Wrench, CreditCard, Briefcase,
  Coins, Laptop, TrendingUp, Landmark, Banknote, PiggyBank, Sparkles, Receipt,
  MoreHorizontal, Wallet, ArrowRightLeft, Shield, Scale,
  Beef, Fish, Drumstick, Apple, Carrot, Wheat, Croissant, Pizza, Sandwich,
  Soup, Salad, IceCream, Milk, CupSoda, Wine, Beer,
  Lightbulb, Droplet, Flame, Trash2, Sofa, Armchair, Bed, Bath, WashingMachine,
  Refrigerator, Hammer, Paintbrush, Key, Building, Building2, Factory, Store, Trees, Flower,
  Train, Bike, Ship, TramFront, CircleParking, Truck, Caravan, Luggage, Hotel,
  Tent, Mountain, MapPin, Sun, Umbrella, Ticket,
  Stethoscope, Syringe, Glasses, Activity, Bandage, Brain, Smile, Hospital, Ambulance,
  SprayCan, Footprints,
  Monitor, Tablet, Headphones, Camera, Tv, Watch, Printer, HardDrive, Cloud, Cpu,
  Gamepad2, Router, Wifi,
  BadgePercent, Percent, HandCoins, Calculator, LineChart, Bitcoin, Vault, Handshake,
  Package, ScrollText, Stamp, FileText,
  Cake, PartyPopper, Heart, Users, Dog, Cat, Bone, Palette, Popcorn, Drama, Mic,
  Book, Newspaper, Pencil, Backpack, School, ShoppingBag,
  Volleyball, Trophy, Medal,
};

export function getIcon(name) {
  return ICONS[name] || Circle;
}
