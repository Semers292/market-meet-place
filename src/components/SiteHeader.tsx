import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n-dict";
import { Button } from "@/components/ui/button";
import { Sparkles, Globe, LogOut, LayoutDashboard, ShoppingBag } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, isAdmin, isSeller, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-gradient">{t("app_name")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition">{t("nav_home")}</Link>
          <Link to="/browse" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition">{t("nav_browse")}</Link>
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === lang)?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)}>{l.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin"><Button size="sm" variant="ghost" className="gap-1.5"><LayoutDashboard className="h-4 w-4" />{t("admin")}</Button></Link>
              )}
              {isSeller && (
                <Link to="/seller/dashboard"><Button size="sm" variant="ghost" className="gap-1.5"><ShoppingBag className="h-4 w-4" />{t("nav_dashboard")}</Button></Link>
              )}
              {!isSeller && !isAdmin && (
                <Link to="/buyer/dashboard"><Button size="sm" variant="ghost" className="gap-1.5"><LayoutDashboard className="h-4 w-4" />{t("nav_dashboard")}</Button></Link>
              )}
              <Button size="sm" variant="ghost" onClick={signOut} className="gap-1.5">
                <LogOut className="h-4 w-4" /><span className="hidden sm:inline">{t("nav_signout")}</span>
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="btn-hero font-medium">{t("nav_signin")}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
