import {
  LayoutDashboard,
  ShoppingBag,
  Tags,
  Home,
  ShoppingCart,
  Globe,
  Image as ImageIcon,
  Megaphone,
  BarChart2,
  MessageSquarePlus,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRealtimeCollection } from "@/hooks/use-firestore-realtime";
import { orderSchema, type Order } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { where } from "firebase/firestore";
import { z } from "zod";

const dropshipperAppSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const overviewItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
];

const productItems = [
  { title: "Products", url: "/admin/products", icon: ShoppingBag },
  { title: "Categories", url: "/admin/categories", icon: Tags },
];

const orderItems = [
  { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
];

const partnerItems = [
  { title: "Dropshippers", url: "/admin/dropshippers", icon: Users },
];

const contentItems = [
  { title: "Homepage Slider", url: "/admin/homepage-slider", icon: ImageIcon },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
];

const toolItems = [
  { title: "Search Analytics", url: "/admin/search-analytics", icon: BarChart2 },
  { title: "Seed Comments", url: "/admin/seed-comments", icon: MessageSquarePlus },
  { title: "Sitemap", url: "/admin/sitemap", icon: Globe },
];

function NavGroup({
  label,
  items,
  location,
  pendingCount,
  secondaryCount,
}: {
  label: string;
  items: { title: string; url: string; icon: React.ElementType }[];
  location: string;
  pendingCount?: number;
  secondaryCount?: number;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={
                  item.url === "/admin"
                    ? location === "/admin"
                    : location.startsWith(item.url)
                }
                tooltip={item.title}
              >
                <Link href={item.url} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  {item.title === "Orders" && (pendingCount ?? 0) > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
                    >
                      {pendingCount}
                    </Badge>
                  )}
                  {item.title === "Dropshippers" && (secondaryCount ?? 0) > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
                    >
                      {secondaryCount}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { data: pendingOrders } = useRealtimeCollection<Order>(
    "orders",
    orderSchema,
    ["/api/admin/orders/pending"],
    [where("status", "==", "pending")]
  );

  const pendingCount = pendingOrders?.length || 0;

  const { data: pendingDropshippers } = useRealtimeCollection(
    "dropshipper_applications",
    dropshipperAppSchema,
    ["/admin/dropshippers/pending"],
    [where("status", "==", "pending")]
  );
  const pendingDropshipperCount = pendingDropshippers?.length || 0;

  return (
    <Sidebar>
      <SidebarContent>
        <NavGroup label="Overview" items={overviewItems} location={location} />
        <NavGroup label="Product Management" items={productItems} location={location} />
        <NavGroup label="Orders" items={orderItems} location={location} pendingCount={pendingCount} />
        <NavGroup label="Partners" items={partnerItems} location={location} secondaryCount={pendingDropshipperCount} />
        <NavGroup label="Content" items={contentItems} location={location} />
        <NavGroup label="Tools & Analytics" items={toolItems} location={location} />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to Shop">
                  <Link href="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    <span>Back to Shop</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
