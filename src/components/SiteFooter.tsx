import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-24 border-t border-border/60 bg-background/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {t("app_name")}. {t("tagline")}</p>
          <p className="text-xs">Built with care · Multilingual · Free to use</p>
        </div>
      </div>
    </footer>
  );
}
