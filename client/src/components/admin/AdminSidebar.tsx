import { 
  LayoutDashboard, 
  Package, 
  ListTree, 
  ShoppingCart, 
  Settings, 
  LogOut,
  ChevronLeft,
  Menu,
  FileSearch,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Wand2,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Package, label: "Products", href: "/admin/products" },
  { icon: ListTree, label: "Categories", href: "/admin/categories" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: Users, label: "Dropshippers", href: "/admin/dropshippers" },
  { icon: ImageIcon, label: "Homepage Slider", href: "/admin/homepage-slider" },
  { icon: Megaphone, label: "Announcements", href: "/admin/announcements" },
  { icon: MessageSquare, label: "Seed Comments", href: "/admin/seed-comments" },
  { icon: ListTree, label: "Seed Categories", href: "/admin/seed-categories" },
  { icon: Wand2, label: "Re-categorize Products", href: "/admin/recategorize-products" },
  { icon: BarChart3, label: "Search Analytics", href: "/admin/search-analytics" },
  { icon: TrendingUp, label: "Profit Rules", href: "/admin/profit-rules" },
  { icon: FileSearch, label: "Sitemap", href: "/admin/sitemap" },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r transition-all duration-300 ease-in-out relative group",
        isCollapsed ? "w-[70px]" : "w-64"
      )}
    >
      <div className="p-4 flex items-center justify-between overflow-hidden">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-bold text-xl truncate text-primary flex items-center gap-2"
            >
              <Settings className="h-6 w-6" />
              <span>Admin Panel</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-primary transition-colors",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <Separator className="opacity-50" />

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={isCollapsed ? item.label : ""}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  !isActive && "group-hover:scale-110"
                )} />
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {isCollapsed && isActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-0 w-1 h-6 bg-primary-foreground rounded-r-full"
                  />
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      <Separator className="opacity-50" />

      <div className="p-4 space-y-4">
        <div className={cn(
          "flex items-center transition-all duration-300",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Theme</span>}
        </div>
        
        <Button
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors duration-200",
            isCollapsed ? "justify-center px-0" : "justify-start px-3"
          )}
          onClick={() => logout()}
          title={isCollapsed ? "Logout" : ""}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </Button>
      </div>
    </div>
  );
}
