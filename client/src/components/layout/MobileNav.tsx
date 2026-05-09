import { Link } from "wouter";
import { User, ShoppingBag, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logoImg from "@/assets/logo.png";
import type { Category, ParentCategory } from "@shared/schema";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  parentCategories: ParentCategory[];
  categories: Category[];
}

const PLAIN_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Collections" },
  { href: "/about", label: "Our Story" },
  { href: "/dropshipper", label: "Dropshipper Program" },
  { href: "/contact", label: "Contact" },
];

export function MobileNav({
  isOpen,
  onClose,
  parentCategories,
  categories,
}: MobileNavProps) {
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[360px] p-0 flex flex-col"
        data-testid="mobile-nav-sheet"
      >
        {/* Sheet header */}
        <SheetHeader className="px-5 py-4 border-b shrink-0 text-left">
          <SheetTitle className="p-0 m-0">
            <Link href="/" onClick={handleLinkClick}>
              <img
                src={logoImg}
                alt="PakCart"
                className="h-8 w-auto"
                data-testid="mobile-nav-logo"
              />
            </Link>
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Navigation */}
          <nav className="px-2">
            {/* Plain links */}
            {PLAIN_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={handleLinkClick}>
                <span
                  className="block py-3 px-3 border-b border-gray-100 text-base font-medium text-gray-800 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                  data-testid={`mobile-nav-link-${link.label.toLowerCase().replace(" ", "-")}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}

            {/* Categories accordion */}
            <Accordion type="single" collapsible>
              <AccordionItem value="categories" className="border-b border-gray-100">
                <AccordionTrigger
                  className="py-3 px-3 text-base font-medium text-gray-800 hover:text-green-700 hover:no-underline rounded-lg"
                  data-testid="mobile-nav-categories-trigger"
                >
                  Categories
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <Accordion type="single" collapsible>
                    {parentCategories.map((parent) => {
                      const subs = categories.filter(
                        (c) =>
                          String(c.parentCategoryId) === String(parent.id)
                      );
                      return (
                        <AccordionItem
                          key={parent.id}
                          value={String(parent.id)}
                          className="border-b-0"
                        >
                          <AccordionTrigger
                            className="py-2.5 pl-6 pr-3 text-sm font-medium text-gray-700 hover:text-green-700 hover:no-underline"
                            data-testid={`mobile-nav-parent-${parent.id}`}
                          >
                            {parent.name}
                          </AccordionTrigger>
                          <AccordionContent className="pb-1">
                            {subs.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/collections/${sub.slug}`}
                                onClick={handleLinkClick}
                              >
                                <span
                                  className="block py-2 pl-10 pr-3 text-sm text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                                  data-testid={`mobile-nav-sub-${sub.id}`}
                                >
                                  {sub.name}
                                </span>
                              </Link>
                            ))}
                            {subs.length === 0 && (
                              <span className="block py-2 pl-10 text-sm text-gray-400">
                                No subcategories
                              </span>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </nav>
        </div>

        {/* Bottom auth section */}
        <div className="px-5 py-4 border-t bg-gray-50 shrink-0 space-y-2">
          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-xl border mb-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-700 font-semibold text-sm">
                    {(user.displayName ?? user.email ?? "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {user.displayName ?? "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              {isAdmin && (
                <Link href="/admin" onClick={handleLinkClick}>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 border-primary text-primary hover:bg-primary/10"
                    data-testid="mobile-nav-admin"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Link href="/profile" onClick={handleLinkClick}>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  data-testid="mobile-nav-profile"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Button>
              </Link>
              <Link href="/orders" onClick={handleLinkClick}>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  data-testid="mobile-nav-orders"
                >
                  <ShoppingBag className="h-4 w-4" />
                  My Orders
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => { logout(); onClose(); }}
                data-testid="mobile-nav-logout"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/auth/login" onClick={handleLinkClick}>
                <Button
                  variant="outline"
                  className="w-full h-11 border-green-600 text-green-700 hover:bg-green-50"
                  data-testid="mobile-nav-login"
                >
                  Log In
                </Button>
              </Link>
              <Link href="/auth/signup" onClick={handleLinkClick}>
                <Button
                  className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-full"
                  data-testid="mobile-nav-signup"
                >
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
