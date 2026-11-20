import type { AstroComponent } from "@lucide/astro";
import BadgeCheck from "@lucide/astro/icons/badge-check";
import BuildingComplex from "@lucide/astro/icons/building-complex";
import CalendarCheck from "@lucide/astro/icons/calendar-check";
import Columns2 from "@lucide/astro/icons/columns-2";
import Construction from "@lucide/astro/icons/construction";
import Cpu from "@lucide/astro/icons/cpu";
import DoorOpen from "@lucide/astro/icons/door-open";
import Dumbbell from "@lucide/astro/icons/dumbbell";
import Flame from "@lucide/astro/icons/flame";
import GraduationCap from "@lucide/astro/icons/graduation-cap";
import Headset from "@lucide/astro/icons/headset";
import Landmark from "@lucide/astro/icons/landmark";
import Layers from "@lucide/astro/icons/layers";
import LayoutGrid from "@lucide/astro/icons/layout-grid";
import Library from "@lucide/astro/icons/library";
import Plug from "@lucide/astro/icons/plug";
import PlugZap from "@lucide/astro/icons/plug-zap";
import QrCode from "@lucide/astro/icons/qr-code";
import Receipt from "@lucide/astro/icons/receipt";
import Rotate3d from "@lucide/astro/icons/rotate-3d";
import ScanFace from "@lucide/astro/icons/scan-face";
import ShieldCheck from "@lucide/astro/icons/shield-check";
import SquareParking from "@lucide/astro/icons/square-letter-p";
import Tag from "@lucide/astro/icons/tag";
import Ticket from "@lucide/astro/icons/ticket";
import Truck from "@lucide/astro/icons/truck";
import UsersRound from "@lucide/astro/icons/users-round";
import Wrench from "@lucide/astro/icons/wrench";
import Zap from "@lucide/astro/icons/zap";

import BookOpen from "@lucide/astro/icons/book-open";
import Car from "@lucide/astro/icons/car";
import Cloud from "@lucide/astro/icons/cloud";
import Code from "@lucide/astro/icons/code";
import Contact from "@lucide/astro/icons/contact";
import DoorClosed from "@lucide/astro/icons/door-closed";
import KeyRound from "@lucide/astro/icons/key-round";
import Languages from "@lucide/astro/icons/languages";
import UserCheck from "@lucide/astro/icons/user-check";
import MessageCircle from "@lucide/astro/icons/message-circle";
import Target from "@lucide/astro/icons/target";
import Eye from "@lucide/astro/icons/eye";
import Award from "@lucide/astro/icons/award";
import HeartHandshake from "@lucide/astro/icons/heart-handshake";
import Lightbulb from "@lucide/astro/icons/lightbulb";
import Users from "@lucide/astro/icons/users";
import MapPin from "@lucide/astro/icons/map-pin";
import Phone from "@lucide/astro/icons/phone";
import Mail from "@lucide/astro/icons/mail";
import Clock from "@lucide/astro/icons/clock";
import Factory from "@lucide/astro/icons/factory";
import Briefcase from "@lucide/astro/icons/briefcase";
import Server from "@lucide/astro/icons/server";
import Smartphone from "@lucide/astro/icons/smartphone";
import Rocket from "@lucide/astro/icons/rocket";
import Handshake from "@lucide/astro/icons/handshake";
import Sparkles from "@lucide/astro/icons/sparkles";
import Globe from "@lucide/astro/icons/globe";

import Nfc from "@lucide/astro/icons/nfc";
import ScanLine from "@lucide/astro/icons/scan-line";
import Crosshair from "@lucide/astro/icons/crosshair";
import FlaskConical from "@lucide/astro/icons/flask-conical";
import MoveHorizontal from "@lucide/astro/icons/move-horizontal";

/** Lucide icons referenced by name from content/data files. */
export const icons = {
  "badge-check": BadgeCheck,
  "building-2": BuildingComplex, // renamed to building-complex in Lucide v1
  "calendar-check": CalendarCheck,
  "columns-2": Columns2,
  construction: Construction,
  cpu: Cpu,
  "door-open": DoorOpen,
  dumbbell: Dumbbell,
  flame: Flame,
  "graduation-cap": GraduationCap,
  headset: Headset,
  landmark: Landmark,
  layers: Layers,
  "layout-grid": LayoutGrid,
  library: Library,
  plug: Plug,
  "plug-zap": PlugZap,
  "qr-code": QrCode,
  receipt: Receipt,
  "rotate-3d": Rotate3d,
  "scan-face": ScanFace,
  "shield-check": ShieldCheck,
  "square-parking": SquareParking,
  tag: Tag,
  ticket: Ticket,
  truck: Truck,
  "users-round": UsersRound,
  wrench: Wrench,
  zap: Zap,
  "book-open": BookOpen,
  "car": Car,
  "cloud": Cloud,
  "code": Code,
  "contact": Contact,
  "door-closed": DoorClosed,
  "key-round": KeyRound,
  "languages": Languages,
  "user-check": UserCheck,
  "message-circle": MessageCircle,
  "target": Target,
  "eye": Eye,
  "award": Award,
  "heart-handshake": HeartHandshake,
  "lightbulb": Lightbulb,
  "users": Users,
  "map-pin": MapPin,
  "phone": Phone,
  "mail": Mail,
  "clock": Clock,
  "factory": Factory,
  "briefcase": Briefcase,
  "server": Server,
  "smartphone": Smartphone,
  "rocket": Rocket,
  "handshake": Handshake,
  "sparkles": Sparkles,
  "globe": Globe,
  "nfc": Nfc,
  "scan-line": ScanLine,
  "crosshair": Crosshair,
  "flask-conical": FlaskConical,
  "move-horizontal": MoveHorizontal,
} satisfies Record<string, AstroComponent>;

export type IconName = keyof typeof icons;
