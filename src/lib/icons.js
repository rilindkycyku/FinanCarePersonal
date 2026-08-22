/**
 * Named icon registry. Categories and account types persist an icon *name* in IndexedDB (a
 * component can't be stored), so this maps those names back to lucide components. Anything
 * unknown falls back to `Circle` instead of crashing the row that references it.
 */

import {
  Utensils, Coffee, ShoppingCart, Home, Zap, Smartphone, Car, Fuel, Bus,
  HeartPulse, Pill, Film, Music, Shirt, GraduationCap, BookOpen, Plane,
  Dumbbell, Gift, PawPrint, Baby, Scissors, Wrench, CreditCard, Briefcase,
  Coins, Laptop, TrendingUp, Landmark, Banknote, PiggyBank, Sparkles, Receipt,
  MoreHorizontal, Wallet, ArrowRightLeft, Shield, Scale, Circle,
} from "lucide-react";

export const ICONS = {
  Utensils, Coffee, ShoppingCart, Home, Zap, Smartphone, Car, Fuel, Bus,
  HeartPulse, Pill, Film, Music, Shirt, GraduationCap, BookOpen, Plane,
  Dumbbell, Gift, PawPrint, Baby, Scissors, Wrench, CreditCard, Briefcase,
  Coins, Laptop, TrendingUp, Landmark, Banknote, PiggyBank, Sparkles, Receipt,
  MoreHorizontal, Wallet, ArrowRightLeft, Shield, Scale,
};

export function getIcon(name) {
  return ICONS[name] || Circle;
}
