/**
 * The app's icon set: lucide-react SVGs (named ESM imports, `sideEffects: false` → only the icons used are bundled).
 * Import icons from here, not from lucide-react directly, so the set stays small and consistent:
 *   - decorative by default (aria-hidden); give a `label` for icon-only buttons instead
 *   - 1.75 stroke, 1.25em size → sits on the text baseline in both Vazirmatn and Inter
 *
 * Direction-aware arrows: "forward"/"back" follow reading direction. In RTL (ku, ar) forward points left.
 * Done with a CSS mirror (`rtl:-scale-x-100`) so one server-rendered tree serves both directions.
 */
import type { LucideIcon, LucideProps } from "lucide-react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export {
  ChartColumnIncreasing,
  Check,
  CircleCheck,
  CreditCard,
  ExternalLink,
  House,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  TriangleAlert,
  Sparkles,
  Tags,
  Trash2,
  Truck,
  Users,
  Settings,
  X,
  Droplet,
  Palette,
  MapPin,
  Search,
  Share2,
  Clock,
  Banknote,
  Undo2,
  TicketPercent,
  Download,
  QrCode,
} from "lucide-react";
export type { LucideIcon };

export type IconProps = Omit<LucideProps, "ref"> & { label?: string };

/** Wrap any lucide icon with the house defaults + accessible labelling. */
export function Icon({ as: Cmp, label, className, ...rest }: IconProps & { as: LucideIcon }) {
  return (
    <Cmp
      size="1.25em"
      strokeWidth={1.75}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
      className={["inline-block shrink-0 align-[-0.2em]", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

const MIRROR = "rtl:-scale-x-100";
const withMirror = (c?: string) => [MIRROR, c].filter(Boolean).join(" ");

/** → in LTR, ← in RTL ("next", "continue", "checkout"). */
export function ArrowForward({ className, ...p }: IconProps) {
  return <Icon as={ArrowRight} className={withMirror(className)} {...p} />;
}
/** ← in LTR, → in RTL ("back"). */
export function ArrowBack({ className, ...p }: IconProps) {
  return <Icon as={ArrowLeft} className={withMirror(className)} {...p} />;
}
export function ChevronForward({ className, ...p }: IconProps) {
  return <Icon as={ChevronRight} className={withMirror(className)} {...p} />;
}
export function ChevronBack({ className, ...p }: IconProps) {
  return <Icon as={ChevronLeft} className={withMirror(className)} {...p} />;
}
