/**
 * The app's icon set: Hugeicons free (stroke), one weight. Per-icon named imports keep the bundle small.
 * Import icons from here so the set stays consistent:
 *   - decorative by default (aria-hidden); give a `label` for icon-only buttons instead
 *   - 1.5 stroke, 1.25em size → sits on the text baseline in both Vazirmatn and Inter
 *
 * Direction-aware arrows: "forward"/"back" follow reading direction. In RTL (ku, ar) forward points left.
 * Done with a CSS mirror (`rtl:-scale-x-100`) so one server-rendered tree serves both directions.
 */
import { createElement } from "react";

/** Hugeicons data shape: [tag, attrs][] (same as @hugeicons/react renders; we render it ourselves to save ~5 KiB JS). */
type IconSvgElement = readonly (readonly [string, { readonly [k: string]: string | number }])[];
import {
  Add01Icon,
  Alert02Icon,
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CreditCardIcon,
  Delete02Icon,
  DiscountTag01Icon,
  Download01Icon,
  DropletIcon,
  FireIcon,
  Home01Icon,
  Invoice01Icon,
  LinkSquare02Icon,
  Location01Icon,
  Menu01Icon,
  Message01Icon,
  Money03Icon,
  PackageIcon,
  PaintBoardIcon,
  PrinterIcon,
  QrCodeIcon,
  RotateLeft01Icon,
  Scissor01Icon,
  Search01Icon,
  Settings02Icon,
  Share08Icon,
  ShirtIcon,
  ShoppingBag01Icon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  SparklesIcon,
  Tag01Icon,
  Tick02Icon,
  TruckIcon,
  Undo02Icon,
  UserGroupIcon
} from "@hugeicons/core-free-icons";

export const ChartColumnIncreasing = Analytics01Icon;
export const Check = Tick02Icon;
export const Copy = Copy01Icon;
export const CircleCheck = CheckmarkCircle02Icon;
export const CreditCard = CreditCardIcon;
export const ExternalLink = LinkSquare02Icon;
export const House = Home01Icon;
export const Menu = Menu01Icon;
export const MessageCircle = Message01Icon;
export const Package = PackageIcon;
export const Plus = Add01Icon;
export const Printer = PrinterIcon;
export const Receipt = Invoice01Icon;
export const RotateCcw = RotateLeft01Icon;
export const Scissors = Scissor01Icon;
export const Shirt = ShirtIcon;
export const ShoppingBag = ShoppingBag01Icon;
export const ShoppingCart = ShoppingCart01Icon;
export const Smartphone = SmartPhone01Icon;
export const TriangleAlert = Alert02Icon;
export const Sparkles = SparklesIcon;
export const Tags = Tag01Icon;
export const Trash2 = Delete02Icon;
export const Truck = TruckIcon;
export const Users = UserGroupIcon;
export const Settings = Settings02Icon;
export const X = Cancel01Icon;
export const Droplet = DropletIcon;
export const Palette = PaintBoardIcon;
export const MapPin = Location01Icon;
export const Search = Search01Icon;
export const Share2 = Share08Icon;
export const Clock = Clock01Icon;
export const Banknote = Money03Icon;
export const Undo2 = Undo02Icon;
export const TicketPercent = DiscountTag01Icon;
export const Flame = FireIcon;
export const Download = Download01Icon;
export const QrCode = QrCodeIcon;
export const ArrowRight = ArrowRight01Icon;
export const ArrowLeft = ArrowLeft01Icon;
export const ChevronRight = ArrowRight01Icon;
export const ChevronLeft = ArrowLeft01Icon;

export type LucideIcon = IconSvgElement;
export type IconProps = { label?: string; className?: string; size?: number | string; strokeWidth?: number };

/** Wrap any Hugeicons icon with the house defaults + accessible labelling. */
export function Icon({ as, label, className, size = "1.25em", strokeWidth = 1.5 }: IconProps & { as: IconSvgElement }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
      className={["inline-block shrink-0 align-[-0.2em]", className].filter(Boolean).join(" ")}
    >
      {as.map(([tag, attrs], i) => {
        const { key: _k, ...rest } = attrs as Record<string, string | number>;
        void _k;
        return createElement(tag, { ...rest, key: i, stroke: "currentColor", strokeWidth });
      })}
    </svg>
  );
}

const MIRROR = "rtl:-scale-x-100";
const withMirror = (c?: string) => [MIRROR, c].filter(Boolean).join(" ");

/** → in LTR, ← in RTL ("next", "continue", "checkout"). */
export function ArrowForward({ className, ...p }: IconProps) {
  return <Icon as={ArrowRight01Icon} className={withMirror(className)} {...p} />;
}
/** ← in LTR, → in RTL ("back"). */
export function ArrowBack({ className, ...p }: IconProps) {
  return <Icon as={ArrowLeft01Icon} className={withMirror(className)} {...p} />;
}
export function ChevronForward({ className, ...p }: IconProps) {
  return <Icon as={ArrowRight01Icon} className={withMirror(className)} {...p} />;
}
export function ChevronBack({ className, ...p }: IconProps) {
  return <Icon as={ArrowLeft01Icon} className={withMirror(className)} {...p} />;
}
